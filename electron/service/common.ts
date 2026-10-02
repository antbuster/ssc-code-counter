import path from 'path';
import os from 'os';
import type { FileStat, DirStat, SummaryStat } from '../types';

export function zeroSummary(): SummaryStat {
  return { lines: 0, code: 0, comment: 0, blank: 0, complexity: 0, bytes: 0, count: 0, uloc: 0 };
}

export function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 路径归一化：统一正斜杠，Windows 下转小写用于比较
 */
export function normPath(p: string): string {
  let s = String(p || '').replace(/\\/g, '/');
  if (os.platform() === 'win32') s = s.toLowerCase();
  return s;
}

/** 目录去重并移除互相嵌套的目录，避免重复统计 */
export function dedupeDirs(dirs: string[]): { kept: string[]; removed: string[] } {
  const uniq = Array.from(new Set(dirs.map(d => String(d || '').trim()).filter(Boolean)));
  const sorted = [...uniq].sort((a, b) => normPath(a).length - normPath(b).length);
  const kept: string[] = [];
  const removed: string[] = [];
  for (const d of sorted) {
    const nd = normPath(d);
    const contained = kept.some(k => {
      const nk = normPath(k);
      return nd === nk || nd.startsWith(nk + '/');
    });
    if (contained) { removed.push(d); continue; }
    kept.push(d);
  }
  return { kept, removed };
}

/** 依据文件归属计算各选中目录的汇总 */
export function computeRootDirs(dirs: string[], files: FileStat[]): DirStat[] {
  const roots = dirs.map(d => ({ raw: d, n: normPath(d) }));
  const acc = new Map<string, SummaryStat>();
  for (const f of files) {
    const loc = normPath(f.location);
    // 匹配最长的根目录前缀
    let hit = '';
    for (const r of roots) {
      if (loc === r.n || loc.startsWith(r.n + '/') || loc.startsWith(r.n.replace(/\/$/, '') + '/')) {
        if (r.n.length > hit.length) hit = r.n;
      }
    }
    if (!hit) continue;
    const cur = acc.get(hit) || zeroSummary();
    cur.lines += f.lines; cur.code += f.code; cur.comment += f.comment;
    cur.blank += f.blank; cur.complexity += f.complexity; cur.bytes += f.bytes;
    cur.count += 1; cur.uloc += f.uloc;
    acc.set(hit, cur);
  }
  return roots
    .filter(r => acc.has(r.n))
    .map(r => ({
      path: r.raw,
      label: path.basename(r.raw.replace(/[\\/]+$/, '')) || r.raw,
      summary: acc.get(r.n)!
    }));
}

/** 按语言聚合统计汇总 */
export function sumLanguages(languages: { lines: number; code: number; comment: number; blank: number; complexity: number; bytes: number; count: number; uloc: number }[]): SummaryStat {
  return languages.reduce((acc, l) => ({
    lines: acc.lines + l.lines, code: acc.code + l.code, comment: acc.comment + l.comment,
    blank: acc.blank + l.blank, complexity: acc.complexity + l.complexity, bytes: acc.bytes + l.bytes,
    count: acc.count + l.count, uloc: acc.uloc + l.uloc
  }), zeroSummary());
}
