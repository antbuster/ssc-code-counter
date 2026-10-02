import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { logger } from 'ee-core/log';
import { defaultConfig, AppConfig } from '../types';

/**
 * 配置持久化服务：JSON 文件存储于用户数据目录，跨平台安全
 */
class StorageService {
  private file: string = '';
  private cache: AppConfig | null = null;

  private filePath(): string {
    if (!this.file) {
      this.file = path.join(app.getPath('userData'), 'storage', 'scc-config.json');
    }
    return this.file;
  }

  /** 读取配置（带默认值合并） */
  get(): AppConfig {
    if (this.cache) return this.cache;
    const def = defaultConfig();
    try {
      const fp = this.filePath();
      if (fs.existsSync(fp)) {
        const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        this.cache = {
          ...def,
          ...raw,
          engine: raw.engine === 'cloc' ? 'cloc' : (raw.engine === 'scc' ? 'scc' : def.engine),
          scc: { ...def.scc, ...(raw.scc || {}) },
          cloc: { ...def.cloc, ...(raw.cloc || {}) },
          options: { ...def.options, ...(raw.options || {}) },
          estimation: { ...def.estimation, ...(raw.estimation || {}) }
        };
      } else {
        this.cache = def;
      }
    } catch (e: any) {
      logger.error('[storage] load failed:', e && e.message ? e.message : e);
      this.cache = def;
    }
    return this.cache!;
  }

  /** 保存配置补丁（浅合并各顶层字段） */
  save(patch: Partial<AppConfig>): AppConfig {
    const cur = this.get();
    const next: AppConfig = {
      ...cur,
      ...patch,
      scc: { ...cur.scc, ...(patch.scc || {}) },
      cloc: { ...cur.cloc, ...(patch.cloc || {}) },
      options: { ...cur.options, ...(patch.options || {}) },
      estimation: { ...cur.estimation, ...(patch.estimation || {}) }
    };
    try {
      const fp = this.filePath();
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(next, null, 2), 'utf-8');
      this.cache = next;
    } catch (e: any) {
      logger.error('[storage] save failed:', e && e.message ? e.message : e);
      throw new Error(`配置保存失败：${e && e.message ? e.message : e}`);
    }
    return next;
  }
}

export const storageService = new StorageService();
