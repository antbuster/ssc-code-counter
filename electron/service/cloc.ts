import { spawn, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getBaseDir, getExtraResourcesDir } from 'ee-core/ps';
import { logger } from 'ee-core/log';
import type { RunOptions, StatsResult, SccCheckResult, LangStat, FileStat } from '../types';
import { computeRootDirs, dedupeDirs, normPath, num, zeroSummary } from './common';

/**
 * CLOC 引擎服务
 *
 * - Windows：使用官方发布的独立可执行文件 cloc.exe（自带 Perl 运行时）
 * - Linux/macOS：使用官方单文件脚本 cloc.pl，通过系统 Perl 运行
 * - 输出：--csv（语言汇总）或 --csv --by-file（文件明细），
 *   cloc 的 CSV 不做引号转义（文件名可含逗号），采用"右侧锚定"解析（数值列固定在行尾）
 *
 * 注意：cloc 不提供圈复杂度 / 字节数 / ULOC，对应字段置 0；
 *       cloc 默认不应用 .gitignore 规则，也无去重开关（UI 中相应选项禁用）。
 */
class ClocService {
  private child: any = null;

  /** 内置 CLOC 的候选路径 */
  builtinCandidates(): { path: string; runner: 'exe' | 'perl' }[] {
    const candidates: { path: string; runner: 'exe' | 'perl' }[] = [];
    const push = (base: string) => {
      if (process.platform === 'win32') {
        candidates.push({ path: path.join(base, 'cloc', 'windows-x64', 'cloc.exe'), runner: 'exe' });
      } else {
        candidates.push({ path: path.join(base, 'cloc', 'cloc.pl'), runner: 'perl' });
      }
    };
    try { push(getExtraResourcesDir()); } catch (e) { /* ignore */ }
    try { push(path.join(getBaseDir(), 'build', 'extraResources')); } catch (e) { /* ignore */ }
    return candidates;
  }

  hasBuiltin(): boolean {
    return this.builtinCandidates().some(c => fs.existsSync(c.path));
  }

  /**
   * 解析生效的 CLOC 路径与运行方式
   * 自定义路径支持：可执行文件 / .pl 脚本 / 包含 cloc.exe 或 cloc.pl 的目录
   */
  resolve(customPath: string = '', useBuiltin: boolean = true): { path: string; runner: 'exe' | 'perl'; isBuiltin: boolean; error: string } {
    const custom = (customPath || '').trim();
    const isPl = (p: string) => /\.pl$/i.test(p);

    if (!useBuiltin && custom) {
      let p = custom;
      let runner: 'exe' | 'perl' = isPl(custom) ? 'perl' : 'exe';
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const exeName = process.platform === 'win32' ? 'cloc.exe' : 'cloc.pl';
        const inDir = path.join(p, exeName);
        if (fs.existsSync(inDir)) {
          p = inDir;
          runner = isPl(inDir) ? 'perl' : 'exe';
        }
      }
      if (fs.existsSync(p)) {
        return { path: p, runner, isBuiltin: false, error: '' };
      }
      return { path: custom, runner, isBuiltin: false, error: `自定义 CLOC 路径不存在：${custom}` };
    }

    for (const c of this.builtinCandidates()) {
      if (fs.existsSync(c.path)) {
        return { path: c.path, runner: c.runner, isBuiltin: true, error: '' };
      }
    }
    const perlHint = process.platform === 'win32'
      ? '请使用自定义路径指定 cloc.exe'
      : '未找到内置 CLOC 脚本；Linux/macOS 也可在设置中自定义路径（需系统已安装 Perl）';
    return { path: '', runner: process.platform === 'win32' ? 'exe' : 'perl', isBuiltin: true, error: `未找到内置 CLOC，${perlHint}` };
  }

  /** 组装命令与参数：perl 模式为 [perl, script, ...]，exe 模式为 [exe, ...] */
  private command(res: { path: string; runner: 'exe' | 'perl' }, args: string[]): { cmd: string; file: string; argv: string[] } {
    if (res.runner === 'perl') {
      return { cmd: `perl ${res.path} ${args.join(' ')}`, file: 'perl', argv: [res.path, ...args] };
    }
    return { cmd: `${res.path} ${args.join(' ')}`, file: res.path, argv: args };
  }

  /** 检查系统 Perl（perl 运行方式时） */
  private ensurePerl(): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile('perl', ['-v'], { timeout: 10000, windowsHide: true }, (err) => {
        if (err) reject(new Error('未检测到系统 Perl，无法运行 CLOC 脚本；请安装 Perl（apt install perl / 系统自带）或改用 SCC 引擎'));
        else resolve();
      });
    });
  }

  /** 执行 cloc --version 校验可用性 */
  async check(customPath: string = '', useBuiltin: boolean = true): Promise<SccCheckResult> {
    const r = this.resolve(customPath, useBuiltin);
    if (!r.path || r.error) {
      return { ok: false, resolvedPath: r.path, isBuiltin: r.isBuiltin, version: '', message: r.error };
    }
    if (r.runner === 'perl') {
      try { await this.ensurePerl(); } catch (e: any) {
        return { ok: false, resolvedPath: r.path, isBuiltin: r.isBuiltin, version: '', message: e.message };
      }
    }
    const { file, argv } = this.command(r, ['--version']);
    return new Promise((resolve) => {
      execFile(file, argv, { timeout: 20000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
        const out = String(stdout || '') + String(stderr || '');
        if (err) {
          resolve({ ok: false, resolvedPath: r.path, isBuiltin: r.isBuiltin, version: '', message: `CLOC 可执行文件校验失败：${err.message} ${out}`.trim() });
          return;
        }
        const m = out.match(/(\d+\.\d+)/);
        const version = m ? m[1] : out.trim().split(/\r?\n/)[0] || 'unknown';
        resolve({ ok: true, resolvedPath: r.path, isBuiltin: r.isBuiltin, version, message: '校验通过' });
      });
    });
  }

  cancel(): boolean {
    const c = this.child;
    if (c) {
      try { c.kill(); } catch (e) { /* ignore */ }
      this.child = null;
      logger.info('[cloc] stats canceled by user');
      return true;
    }
    return false;
  }

  isRunning(): boolean {
    return !!this.child;
  }

  /**
   * 执行 CLOC 统计
   */
  run(opts: RunOptions, customPath: string = '', useBuiltin: boolean = true): Promise<StatsResult> {
    return new Promise(async (resolve) => {
      const started = Date.now();
      const empty = (message: string, extra: Partial<StatsResult> = {}): StatsResult => ({
        ok: false, engine: 'cloc', source: 'scc', cmd: '', sccPath: '', isBuiltin: false, sccVersion: '',
        durationMs: Date.now() - started, dirs: [], summary: zeroSummary(), languages: [], files: [], rootDirs: [],
        warnings: '', message, generatedAt: new Date().toISOString(), ...extra
      });

      const dirs = dedupeDirs(opts.dirs || []);
      if (!dirs.kept.length) {
        resolve(empty('请至少选择一个统计目录'));
        return;
      }

      const res = this.resolve(customPath, useBuiltin);
      if (!res.path || res.error) {
        resolve(empty(res.error || '未找到可用的 CLOC', { sccPath: res.path, isBuiltin: res.isBuiltin }));
        return;
      }
      if (res.runner === 'perl') {
        try { await this.ensurePerl(); } catch (e: any) {
          resolve(empty(e.message, { sccPath: res.path, isBuiltin: res.isBuiltin }));
          return;
        }
      }

      // linux/mac 下保证脚本可读
      if (process.platform !== 'win32') {
        try { fs.accessSync(res.path, fs.constants.R_OK); } catch (e) { /* ignore */ }
      }

      const args = this.buildArgs(opts, dirs.kept);
      const { cmd, file, argv } = this.command(res, args);
      logger.info('[cloc] exec:', cmd);

      let stdout = '';
      let stderr = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          try { this.child && this.child.kill(); } catch (e) { /* ignore */ }
        }
      }, 10 * 60 * 1000);

      try {
        this.child = spawn(file, argv, { windowsHide: true });
      } catch (e: any) {
        clearTimeout(timeout);
        this.child = null;
        resolve(empty(`CLOC 启动失败：${e && e.message ? e.message : String(e)}`, { cmd, sccPath: res.path, isBuiltin: res.isBuiltin }));
        return;
      }

      this.child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
      this.child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
      this.child.on('error', (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.child = null;
        resolve(empty(`CLOC 执行出错：${err.message}`, { cmd, sccPath: res.path, isBuiltin: res.isBuiltin }));
      });
      this.child.on('close', (code: number, signal: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.child = null;
        const base = {
          cmd, sccPath: res.path, isBuiltin: res.isBuiltin,
          durationMs: Date.now() - started,
          dirs: dirs.kept,
          warnings: stderr.trim().split(/\r?\n/).slice(-10).join('\n')
        };
        if (signal) {
          resolve(empty('统计已取消', { ...base }));
          return;
        }
        if (code !== 0) {
          resolve(empty(`CLOC 退出码 ${code}：${stderr.trim().slice(0, 500) || '无错误输出'}`, { ...base }));
          return;
        }
        try {
          const result = this.parseCsv(stdout, byFile(opts), base);
          resolve(result);
        } catch (e: any) {
          resolve(empty(`CLOC 输出解析失败：${e && e.message ? e.message : String(e)}`, { ...base }));
        }
      });
    });
  }

  /** 拼装 CLOC 参数（noIgnore/noGitignore/noDuplicates 为 SCC 专属，此处忽略） */
  buildArgs(opts: RunOptions, dirs: string[]): string[] {
    const args: string[] = ['--csv'];
    if (opts.byFile !== false) args.push('--by-file');
    // 与 SCC 一致：显式合并常见 VCS 目录（cloc 默认亦排除部分 VCS 目录）
    const excludeDirs = Array.from(new Set([...['.git', '.hg', '.svn'], ...(opts.excludeDirs || [])]
      .map(s => String(s || '').trim()).filter(Boolean)));
    if (excludeDirs.length) args.push(`--exclude-dir=${excludeDirs.join(',')}`);
    const excludeExts = (opts.excludeExts || []).map(s => String(s || '').trim().replace(/^\./, '')).filter(Boolean);
    if (excludeExts.length) args.push(`--exclude-ext=${excludeExts.join(',')}`);
    const includeExts = (opts.includeExts || []).map(s => String(s || '').trim().replace(/^\./, '')).filter(Boolean);
    if (includeExts.length) args.push(`--include-ext=${includeExts.join(',')}`);
    args.push(...dirs);
    return args;
  }

  /**
   * 解析 cloc CSV 输出（右侧锚定：每行末尾 3 列固定为 blank, comment, code）
   * by-file 行：language, filename(可含逗号), blank, comment, code
   * 汇总行：files, language, blank, comment, code；末尾 SUM 行作为总计
   */
  parseCsv(stdout: string, byFile: boolean, base: Partial<StatsResult> = {}): StatsResult {
    const lines = String(stdout || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error('输出为空或缺少数据行');
    }
    const languages = new Map<string, LangStat>();
    const files: FileStat[] = [];
    let sumRow: { blank: number; comment: number; code: number; count: number } | null = null;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 4) continue;
      const code = num(cols[cols.length - 1]);
      const comment = num(cols[cols.length - 2]);
      const blank = num(cols[cols.length - 3]);

      if (byFile) {
        // 行结构：language, filename..., blank, comment, code
        const language = (cols[0] || '').trim();
        const filename = cols.slice(1, cols.length - 3).join(',');
        if (language === 'SUM' || !language) {
          if (language === 'SUM') sumRow = { blank, comment, code, count: files.length };
          continue;
        }
        const location = normPath(filename);
        const base2 = location.split('/').pop() || filename;
        const stat: FileStat = {
          filename: base2,
          extension: extOf(base2),
          location,
          language,
          lines: blank + comment + code,
          code, comment, blank,
          complexity: 0, bytes: 0, uloc: 0,
          binary: false, minified: false, generated: false
        };
        files.push(stat);
        addLang(languages, language, stat);
      } else {
        // 行结构：files, language, blank, comment, code
        const count = num(cols[0]);
        const language = (cols[1] || '').trim();
        if (language === 'SUM' || !language) {
          if (language === 'SUM') sumRow = { blank, comment, code, count };
          continue;
        }
        const cur = languages.get(language) || {
          name: language, lines: 0, code: 0, comment: 0, blank: 0,
          complexity: 0, bytes: 0, count: 0, uloc: 0
        };
        cur.code += code; cur.comment += comment; cur.blank += blank;
        cur.lines += blank + comment + code;
        cur.count += count;
        languages.set(language, cur);
      }
    }

    const langList = [...languages.values()].sort((a, b) => b.code - a.code || b.lines - a.lines);
    const summary = sumRow
      ? {
          lines: sumRow.blank + sumRow.comment + sumRow.code,
          code: sumRow.code, comment: sumRow.comment, blank: sumRow.blank,
          complexity: 0, bytes: 0, count: sumRow.count, uloc: 0
        }
      : {
          ...sumLanguagesOf(langList)
        };

    const dirs = base.dirs || [];
    const rootDirs = dirs.length > 1 && files.length ? computeRootDirs(dirs, files) : [];

    return {
      ok: true, engine: 'cloc', source: 'scc', cmd: '', sccPath: '', isBuiltin: false, sccVersion: '',
      durationMs: 0, dirs, summary, languages: langList, files, rootDirs, warnings: '',
      generatedAt: new Date().toISOString(),
      ...base
    } as StatsResult;
  }
}

function byFile(opts: RunOptions): boolean {
  return opts.byFile !== false;
}

function extOf(filename: string): string {
  const m = String(filename || '').match(/\.([A-Za-z0-9_\-]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function addLang(map: Map<string, LangStat>, language: string, f: FileStat): void {
  const cur = map.get(language) || {
    name: language, lines: 0, code: 0, comment: 0, blank: 0,
    complexity: 0, bytes: 0, count: 0, uloc: 0
  };
  cur.code += f.code; cur.comment += f.comment; cur.blank += f.blank;
  cur.lines += f.lines; cur.count += 1;
  map.set(language, cur);
}

function sumLanguagesOf(langList: LangStat[]) {
  return langList.reduce((acc, l) => ({
    lines: acc.lines + l.lines, code: acc.code + l.code, comment: acc.comment + l.comment,
    blank: acc.blank + l.blank, complexity: 0, bytes: 0,
    count: acc.count + l.count, uloc: 0
  }), zeroSummary());
}

export const clocService = new ClocService();
