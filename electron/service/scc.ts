import { spawn, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getBaseDir, getExtraResourcesDir } from 'ee-core/ps';
import { logger } from 'ee-core/log';
import type { RunOptions, StatsResult, SccCheckResult, LangStat, FileStat, SummaryStat } from '../types';
import { computeRootDirs, dedupeDirs, num, zeroSummary } from './common';

/**
 * SCC 服务：解析内置/自定义 SCC 可执行文件、拼装参数执行统计、解析结果
 */
class SccService {
  private child: any = null;

  /** 平台对应的内置 SCC 目录名 */
  builtinDirName(): string | null {
    const p = process.platform;
    const a = process.arch;
    if (p === 'win32') return a === 'ia32' ? 'windows-x86' : 'windows-x64';
    if (p === 'linux') return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
    if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    return null;
  }

  /** 内置 SCC 的候选路径（打包后资源目录 / 开发目录） */
  builtinCandidates(): string[] {
    const dir = this.builtinDirName();
    if (!dir) return [];
    const exe = process.platform === 'win32' ? 'scc.exe' : 'scc';
    const candidates: string[] = [];
    try {
      candidates.push(path.join(getExtraResourcesDir(), 'scc', dir, exe));
    } catch (e) { /* ignore */ }
    try {
      candidates.push(path.join(getBaseDir(), 'build', 'extraResources', 'scc', dir, exe));
    } catch (e) { /* ignore */ }
    return candidates;
  }

  /** 当前平台是否提供了内置 SCC */
  hasBuiltin(): boolean {
    return this.builtinCandidates().some(p => fs.existsSync(p));
  }

  /**
   * 解析生效的 SCC 路径：自定义优先（useBuiltin=false 时），否则内置
   */
  resolve(customPath: string = '', useBuiltin: boolean = true): { path: string; isBuiltin: boolean; error: string } {
    const custom = (customPath || '').trim();
    if (!useBuiltin && custom) {
      // 允许直接指向可执行文件，或指向包含 scc 可执行文件的目录
      let p = custom;
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const exe = process.platform === 'win32' ? 'scc.exe' : 'scc';
        const inDir = path.join(p, exe);
        if (fs.existsSync(inDir)) p = inDir;
      }
      if (fs.existsSync(p)) {
        return { path: p, isBuiltin: false, error: '' };
      }
      return { path: custom, isBuiltin: false, error: `自定义 SCC 路径不存在：${custom}` };
    }

    for (const p of this.builtinCandidates()) {
      if (fs.existsSync(p)) {
        return { path: p, isBuiltin: true, error: '' };
      }
    }
    return { path: '', isBuiltin: true, error: '未找到内置 SCC 可执行文件，请在设置中配置自定义 SCC 路径' };
  }

  /** 执行 scc --version 校验可用性 */
  check(customPath: string = '', useBuiltin: boolean = true): Promise<SccCheckResult> {
    return new Promise((resolve) => {
      const r = this.resolve(customPath, useBuiltin);
      if (!r.path || r.error) {
        resolve({ ok: false, resolvedPath: r.path, isBuiltin: r.isBuiltin, version: '', message: r.error });
        return;
      }
      execFile(r.path, ['--version'], { timeout: 15000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
        const out = String(stdout || '') + String(stderr || '');
        if (err) {
          resolve({
            ok: false, resolvedPath: r.path, isBuiltin: r.isBuiltin, version: '',
            message: `SCC 可执行文件校验失败：${err.message} ${out}`.trim()
          });
          return;
        }
        const m = out.match(/scc\s+version\s+([\w.\-]+)/i);
        const version = m ? m[1] : out.trim().split(/\r?\n/)[0] || 'unknown';
        if (!/scc/i.test(out)) {
          resolve({
            ok: false, resolvedPath: r.path, isBuiltin: r.isBuiltin, version,
            message: `该程序输出无法识别为 SCC：${out.trim().slice(0, 200)}`
          });
          return;
        }
        resolve({ ok: true, resolvedPath: r.path, isBuiltin: r.isBuiltin, version, message: '校验通过' });
      });
    });
  }

  /** 取消进行中的统计 */
  cancel(): boolean {
    const c = this.child;
    if (c) {
      try { c.kill(); } catch (e) { /* ignore */ }
      this.child = null;
      logger.info('[scc] stats canceled by user');
      return true;
    }
    return false;
  }

  isRunning(): boolean {
    return !!this.child;
  }

  /**
   * 执行 SCC 统计
   */
  run(opts: RunOptions, customPath: string = '', useBuiltin: boolean = true): Promise<StatsResult> {
    return new Promise((resolve) => {
      const started = Date.now();
      const empty = (message: string, extra: Partial<StatsResult> = {}): StatsResult => ({
        ok: false, engine: 'scc', source: 'scc', cmd: '', sccPath: '', isBuiltin: false, sccVersion: '',
        durationMs: Date.now() - started, dirs: [], summary: zeroSummary(), languages: [], files: [], rootDirs: [],
        warnings: '', message, generatedAt: new Date().toISOString(), ...extra
      });

      const dirs = dedupeDirs(opts.dirs || []);
      if (!dirs.kept.length) {
        resolve(empty('请至少选择一个统计目录'));
        return;
      }
      if (dirs.removed.length) {
        logger.info('[scc] nested dirs removed:', dirs.removed.join(', '));
      }

      const r = this.resolve(customPath, useBuiltin);
      if (!r.path || r.error) {
        resolve(empty(r.error || '未找到可用的 SCC 可执行文件', { sccPath: r.path, isBuiltin: r.isBuiltin }));
        return;
      }

      // linux/mac 下保证可执行权限
      if (process.platform !== 'win32') {
        try { fs.accessSync(r.path, fs.constants.X_OK); } catch (e) {
          try { fs.chmodSync(r.path, 0o755); } catch (e2) { /* ignore */ }
        }
      }

      const args = this.buildArgs(opts, dirs.kept);
      const cmd = `${r.path} ${args.join(' ')}`;
      logger.info('[scc] exec:', cmd);

      let stdout = '';
      let stderr = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          try { this.child && this.child.kill(); } catch (e) { /* ignore */ }
        }
      }, 10 * 60 * 1000);

      try {
        this.child = spawn(r.path, args, { windowsHide: true });
      } catch (e: any) {
        clearTimeout(timeout);
        this.child = null;
        resolve(empty(`SCC 启动失败：${e && e.message ? e.message : String(e)}`, { cmd, sccPath: r.path, isBuiltin: r.isBuiltin }));
        return;
      }

      this.child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
      this.child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
      this.child.on('error', (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.child = null;
        resolve(empty(`SCC 执行出错：${err.message}`, { cmd, sccPath: r.path, isBuiltin: r.isBuiltin }));
      });
      this.child.on('close', (code: number, signal: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.child = null;
        const base = {
          cmd, sccPath: r.path, isBuiltin: r.isBuiltin,
          durationMs: Date.now() - started,
          dirs: dirs.kept,
          warnings: stderr.trim().split(/\r?\n/).slice(-10).join('\n')
        };
        if (signal) {
          resolve(empty('统计已取消', { ...base }));
          return;
        }
        if (code !== 0) {
          resolve(empty(`SCC 退出码 ${code}：${stderr.trim().slice(0, 500) || '无错误输出'}`, { ...base }));
          return;
        }
        try {
          const json = JSON.parse(stdout);
          const result = this.normalize(json, base);
          resolve(result);
        } catch (e: any) {
          resolve(empty(`SCC 输出解析失败：${e && e.message ? e.message : String(e)}`, { ...base }));
        }
      });
    });
  }

  /** 拼装 SCC 参数 */
  buildArgs(opts: RunOptions, dirs: string[]): string[] {
    const args: string[] = [];
    if (opts.byFile !== false) args.push('--by-file');
    args.push('--format', 'json');
    if (opts.noIgnore) args.push('--no-ignore');
    if (opts.noGitignore) args.push('--no-gitignore');
    if (opts.noDuplicates) args.push('--no-duplicates');
    // scc 的 --exclude-dir 传入后会覆盖默认值，这里合并 scc 默认排除项
    const excludeDirs = Array.from(new Set([...['.git', '.hg', '.svn'], ...(opts.excludeDirs || [])]
      .map(s => String(s || '').trim()).filter(Boolean)));
    if (excludeDirs.length) args.push('--exclude-dir', excludeDirs.join(','));
    const excludeExts = (opts.excludeExts || []).map(s => String(s || '').trim().replace(/^\./, '')).filter(Boolean);
    if (excludeExts.length) args.push('--exclude-ext', excludeExts.join(','));
    const includeExts = (opts.includeExts || []).map(s => String(s || '').trim().replace(/^\./, '')).filter(Boolean);
    if (includeExts.length) args.push('--include-ext', includeExts.join(','));
    args.push(...dirs);
    return args;
  }

  /**
   * 将 SCC JSON 输出归一化为应用内部结构
   */
  normalize(json: any, base: Partial<StatsResult> = {}): StatsResult {
    const langs: any[] = Array.isArray(json) ? json : (Array.isArray(json?.languageSummary) ? json.languageSummary : []);
    const languages: LangStat[] = langs.map(l => ({
      name: String(l.Name ?? l.name ?? 'Unknown'),
      lines: num(l.Lines), code: num(l.Code), comment: num(l.Comment),
      blank: num(l.Blank), complexity: num(l.Complexity), bytes: num(l.Bytes),
      count: num(l.Count), uloc: num(l.ULOC ?? l.Uloc)
    })).sort((a, b) => b.code - a.code || b.lines - a.lines);

    const files: FileStat[] = [];
    for (const l of langs) {
      for (const f of (l.Files || [])) {
        files.push({
          filename: String(f.Filename ?? f.filename ?? ''),
          extension: String(f.Extension ?? f.extension ?? ''),
          location: String(f.Location ?? f.location ?? ''),
          language: String(f.Language ?? f.language ?? ''),
          lines: num(f.Lines), code: num(f.Code), comment: num(f.Comment),
          blank: num(f.Blank), complexity: num(f.Complexity), bytes: num(f.Bytes),
          uloc: num(f.Uloc ?? f.ULOC),
          binary: !!(f.Binary), minified: !!(f.Minified), generated: !!(f.Generated)
        });
      }
    }
    files.sort((a, b) => b.code - a.code || b.lines - a.lines);

    const summary: SummaryStat = languages.reduce((acc, l) => ({
      lines: acc.lines + l.lines,
      code: acc.code + l.code,
      comment: acc.comment + l.comment,
      blank: acc.blank + l.blank,
      complexity: acc.complexity + l.complexity,
      bytes: acc.bytes + l.bytes,
      count: acc.count + l.count,
      uloc: acc.uloc + l.uloc
    }), zeroSummary());

    const dirs = base.dirs || [];
    const rootDirs = dirs.length > 1 && files.length ? computeRootDirs(dirs, files) : [];

    return {
      ok: true, engine: 'scc', source: 'scc', cmd: '', sccPath: '', isBuiltin: false, sccVersion: '',
      durationMs: 0, dirs, summary, languages, files, rootDirs, warnings: '',
      generatedAt: new Date().toISOString(),
      ...base
    } as StatsResult;
  }
}

export const sccService = new SccService();
