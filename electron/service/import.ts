import fs from 'fs';
import { logger } from 'ee-core/log';
import type { StatsResult, LangStat, FileStat } from '../types';

/**
 * 导入服务：解析 SCC 导出的 JSON / CSV 统计文件，归一化为应用内部结构
 */
class ImportService {
  /** 支持的扩展名 */
  supportExts(): string[] {
    return ['json', 'csv'];
  }

  /**
   * 解析导入文件
   */
  parse(filePath: string): StatsResult {
    const base = {
      engine: ('scc' as const),
      source: 'import' as const,
      cmd: `import: ${filePath}`,
      sccPath: '',
      isBuiltin: false,
      sccVersion: '',
      durationMs: 0,
      dirs: [filePath],
      warnings: '',
      generatedAt: new Date().toISOString()
    };
    const fail = (message: string): StatsResult => ({
      ok: false, engine: 'scc', source: 'import', cmd: base.cmd, sccPath: '', isBuiltin: false, sccVersion: '',
      durationMs: 0, dirs: [filePath], summary: zeroSummary(), languages: [], files: [], rootDirs: [],
      warnings: '', message, generatedAt: base.generatedAt
    });

    if (!filePath || !fs.existsSync(filePath)) {
      return fail(`文件不存在：${filePath}`);
    }
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (e: any) {
      return fail(`文件读取失败：${e && e.message ? e.message : e}`);
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return fail('文件内容为空');
    }

    // JSON 优先尝试
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed);
        const r = this.normalizeJson(json);
        if (r) {
          return { ok: true, ...base, ...r };
        }
        return fail('JSON 结构无法识别：未找到语言统计数据');
      } catch (e: any) {
        logger.info('[import] json parse failed, try csv:', e && e.message ? e.message : e);
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          return fail(`JSON 解析失败：${e && e.message ? e.message : e}`);
        }
      }
    }

    // CSV
    if (trimmed.includes(',')) {
      const r = this.parseCsv(trimmed);
      if (r) {
        return { ok: true, ...base, ...r };
      }
      return fail('CSV 结构无法识别：表头需为 SCC 导出格式（Language,Lines,Code,...）');
    }

    return fail('无法识别的文件格式，支持 SCC 导出的 JSON 与 CSV');
  }

  /** 归一化 JSON：支持 scc --format json 数组、json2 对象、本应用导出格式 */
  normalizeJson(json: any): { summary: any; languages: LangStat[]; files: FileStat[]; rootDirs: any[]; sccVersion: string } | null {
    // 本应用导出格式
    if (json && json.meta && json.meta.type === 'scc-code-counter-export' && json.result) {
      const r = json.result;
      return {
        engine: r.engine === 'cloc' ? 'cloc' : 'scc',
        summary: r.summary || zeroSummary(),
        languages: r.languages || [],
        files: r.files || [],
        rootDirs: r.rootDirs || [],
        sccVersion: (json.meta && json.meta.sccVersion) || ''
      };
    }
    const langs: any[] = Array.isArray(json)
      ? json
      : (Array.isArray(json?.languageSummary) ? json.languageSummary : (Array.isArray(json?.Languages) ? json.Languages : []));
    if (!langs.length) return null;
    const languages = langs.map(l => ({
      name: String(l.Name ?? l.name ?? 'Unknown'),
      lines: num(l.Lines ?? l.lines), code: num(l.Code ?? l.code),
      comment: num(l.Comment ?? l.comment), blank: num(l.Blank ?? l.blank),
      complexity: num(l.Complexity ?? l.complexity), bytes: num(l.Bytes ?? l.bytes),
      count: num(l.Count ?? l.count), uloc: num(l.ULOC ?? l.Uloc ?? l.uloc)
    })).sort((a, b) => b.code - a.code || b.lines - a.lines);
    return {
      summary: sumLanguages(languages),
      languages,
      files: this.extractFiles(langs),
      rootDirs: [],
      sccVersion: ''
    };
  }

  extractFiles(langs: any[]): FileStat[] {
    const files: FileStat[] = [];
    for (const l of langs) {
      const list = l.Files || l.files || [];
      for (const f of list) {
        files.push({
          filename: String(f.Filename ?? f.filename ?? ''),
          extension: String(f.Extension ?? f.extension ?? ''),
          location: String(f.Location ?? f.location ?? f.Provider ?? f.provider ?? ''),
          language: String(f.Language ?? f.language ?? l.Name ?? ''),
          lines: num(f.Lines ?? f.lines), code: num(f.Code ?? f.code),
          comment: num(f.Comment ?? f.comment), blank: num(f.Blank ?? f.blank),
          complexity: num(f.Complexity ?? f.complexity), bytes: num(f.Bytes ?? f.bytes),
          uloc: num(f.Uloc ?? f.ULOC ?? f.uloc),
          binary: !!(f.Binary ?? f.binary), minified: !!(f.Minified ?? f.minified), generated: !!(f.Generated ?? f.generated)
        });
      }
    }
    files.sort((a, b) => b.code - a.code || b.lines - a.lines);
    return files;
  }

  /** 解析 SCC 导出的 CSV（汇总格式或 by-file 格式） */
  parseCsv(text: string): { summary: any; languages: LangStat[]; files: FileStat[]; rootDirs: any[]; sccVersion: string } | null {
    const rows = this.parseCsvRows(text);
    if (!rows.length) return null;
    const header = rows[0].map(h => h.trim().toLowerCase());
    const col = (names: string[]) => names.findIndex(n => header.includes(n));

    if (header[0] === 'language' && header.includes('provider')) {
      // by-file 格式：Language,Provider,Filename,Lines,Code,Comments,Blanks,Complexity,Bytes,ULOC
      const iLang = 0;
      const iLoc = header.indexOf('provider');
      const iFile = header.indexOf('filename');
      const iLines = col(['lines']);
      const iCode = col(['code']);
      const iComment = col(['comments', 'comment']);
      const iBlank = col(['blanks', 'blank']);
      const iCx = col(['complexity']);
      const iBytes = col(['bytes']);
      const iUloc = col(['uloc']);
      const files: FileStat[] = [];
      const langs = new Map<string, LangStat>();
      for (const row of rows.slice(1)) {
        if (!row.length || !row[iLang]) continue;
        const f: FileStat = {
          filename: (iFile >= 0 ? row[iFile] : '') || '',
          extension: extOf(iFile >= 0 ? row[iFile] : ''),
          location: (iLoc >= 0 ? row[iLoc] : '') || '',
          language: row[iLang] || '',
          lines: num(row[iLines]), code: num(row[iCode]), comment: num(row[iComment]),
          blank: num(row[iBlank]), complexity: num(row[iCx]), bytes: num(row[iBytes]),
          uloc: num(row[iUloc]), binary: false, minified: false, generated: false
        };
        files.push(f);
        const cur = langs.get(f.language) || {
          name: f.language, lines: 0, code: 0, comment: 0, blank: 0,
          complexity: 0, bytes: 0, count: 0, uloc: 0
        };
        cur.lines += f.lines; cur.code += f.code; cur.comment += f.comment;
        cur.blank += f.blank; cur.complexity += f.complexity; cur.bytes += f.bytes;
        cur.count += 1; cur.uloc += f.uloc;
        langs.set(f.language, cur);
      }
      const languages = [...langs.values()].sort((a, b) => b.code - a.code || b.lines - a.lines);
      return { summary: sumLanguages(languages), languages, files, rootDirs: [], sccVersion: '' };
    }

    if (header[0] === 'language' && header.includes('files')) {
      // 汇总格式：Language,Lines,Code,Comments,Blanks,Complexity,Bytes,Files,ULOC
      const iLines = col(['lines']);
      const iCode = col(['code']);
      const iComment = col(['comments', 'comment']);
      const iBlank = col(['blanks', 'blank']);
      const iCx = col(['complexity']);
      const iBytes = col(['bytes']);
      const iCount = header.indexOf('files');
      const iUloc = col(['uloc']);
      const languages: LangStat[] = [];
      for (const row of rows.slice(1)) {
        if (!row.length || !row[0]) continue;
        languages.push({
          name: row[0] || 'Unknown',
          lines: num(row[iLines]), code: num(row[iCode]), comment: num(row[iComment]),
          blank: num(row[iBlank]), complexity: num(row[iCx]), bytes: num(row[iBytes]),
          count: num(row[iCount]), uloc: num(row[iUloc])
        });
      }
      languages.sort((a, b) => b.code - a.code || b.lines - a.lines);
      return { summary: sumLanguages(languages), languages, files: [], rootDirs: [], sccVersion: '' };
    }
    return null;
  }

  /** 简易 CSV 行解析（支持引号包裹与转义） */
  parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuote) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuote = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || (row[0] && row[0].trim() !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      if (row.length > 1 || (row[0] && row[0].trim() !== '')) rows.push(row);
    }
    return rows;
  }
}

function extOf(filename: string): string {
  const m = String(filename || '').match(/\.([A-Za-z0-9_\-]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function num(v: any): number {
  const n = Number(String(v ?? '').replace(/[",\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sumLanguages(languages: LangStat[]): any {
  return languages.reduce((acc, l) => ({
    lines: acc.lines + l.lines, code: acc.code + l.code, comment: acc.comment + l.comment,
    blank: acc.blank + l.blank, complexity: acc.complexity + l.complexity, bytes: acc.bytes + l.bytes,
    count: acc.count + l.count, uloc: acc.uloc + l.uloc
  }), zeroSummary());
}

function zeroSummary(): any {
  return { lines: 0, code: 0, comment: 0, blank: 0, complexity: 0, bytes: 0, count: 0, uloc: 0 };
}

export const importService = new ImportService();
