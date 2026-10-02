import { sccService } from '../service/scc';
import { clocService } from '../service/cloc';
import { importService } from '../service/import';
import { storageService } from '../service/storage';
import { logger } from 'ee-core/log';
import type { RunOptions, StatsEngine } from '../types';

/**
 * 代码统计控制器：SCC / CLOC 引擎运行、校验、取消、导入解析
 */
class CodestatsController {
  /** 归一化引擎参数（默认 scc） */
  private engineOf(v: any): StatsEngine {
    return v === 'cloc' ? 'cloc' : 'scc';
  }

  /**
   * 执行统计（engine: 'scc' | 'cloc'）
   */
  async run(args: any = {}): Promise<any> {
    try {
      const cfg = storageService.get();
      const engine = this.engineOf(args.engine || cfg.engine);
      const opts: RunOptions = {
        dirs: Array.isArray(args.dirs) ? args.dirs : [],
        excludeDirs: Array.isArray(args.excludeDirs) ? args.excludeDirs : cfg.defaultExcludeDirs,
        excludeExts: Array.isArray(args.excludeExts) ? args.excludeExts : cfg.defaultExcludeExts,
        includeExts: Array.isArray(args.includeExts) ? args.includeExts : [],
        byFile: args.byFile !== false,
        noIgnore: !!args.noIgnore,
        noGitignore: !!args.noGitignore,
        noDuplicates: !!args.noDuplicates
      };
      const result = engine === 'cloc'
        ? await clocService.run(opts, cfg.cloc.customPath, cfg.cloc.useBuiltin)
        : await sccService.run(opts, cfg.scc.customPath, cfg.scc.useBuiltin);
      // 成功结果持久化为 lastResult，便于下次启动恢复
      if (result.ok) {
        try { storageService.save({ lastResult: result } as any); } catch (e) { /* 忽略持久化失败 */ }
      }
      return result;
    } catch (e: any) {
      logger.error('[codestats] run failed:', e && e.message ? e.message : e);
      return { ok: false, engine: 'scc', message: `统计执行异常：${e && e.message ? e.message : e}` };
    }
  }

  /**
   * 取消进行中的统计（两个引擎都尝试）
   */
  async cancel(): Promise<any> {
    const a = sccService.cancel();
    const b = clocService.cancel();
    return { ok: true, canceled: a || b };
  }

  /**
   * 校验引擎可用性（内置或自定义路径）
   */
  async checkScc(args: any = {}): Promise<any> {
    const cfg = storageService.get();
    const engine = this.engineOf(args.engine || cfg.engine);
    if (engine === 'cloc') {
      const useBuiltin = args.useBuiltin !== undefined ? !!args.useBuiltin : cfg.cloc.useBuiltin;
      const customPath = args.customPath !== undefined ? String(args.customPath || '') : cfg.cloc.customPath;
      return await clocService.check(customPath, useBuiltin);
    }
    const useBuiltin = args.useBuiltin !== undefined ? !!args.useBuiltin : cfg.scc.useBuiltin;
    const customPath = args.customPath !== undefined ? String(args.customPath || '') : cfg.scc.customPath;
    return await sccService.check(customPath, useBuiltin);
  }

  /**
   * 解析当前生效的引擎路径（不做执行校验）
   */
  async resolveScc(args: any = {}): Promise<any> {
    const cfg = storageService.get();
    const engine = this.engineOf(args.engine || cfg.engine);
    if (engine === 'cloc') {
      const r = clocService.resolve(cfg.cloc.customPath, cfg.cloc.useBuiltin);
      return { ...r, engine, hasBuiltin: clocService.hasBuiltin() };
    }
    const r = sccService.resolve(cfg.scc.customPath, cfg.scc.useBuiltin);
    return { ...r, engine, hasBuiltin: sccService.hasBuiltin() };
  }

  /**
   * 导入 SCC 导出的统计文件（JSON / CSV）
   */
  async parseImportFile(args: any = {}): Promise<any> {
    try {
      return importService.parse(String(args.filePath || ''));
    } catch (e: any) {
      return { ok: false, engine: 'scc', message: `导入解析异常：${e && e.message ? e.message : e}` };
    }
  }

  /**
   * 查询导入支持的扩展名
   */
  async importSupport(): Promise<any> {
    return { ok: true, extensions: importService.supportExts() };
  }
}

export default CodestatsController;
