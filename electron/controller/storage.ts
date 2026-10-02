import { storageService } from '../service/storage';

/**
 * 配置存储控制器
 */
class StorageController {
  /**
   * 读取全部配置
   */
  async get(): Promise<any> {
    return { ok: true, config: storageService.get() };
  }

  /**
   * 保存配置补丁
   */
  async save(args: any = {}): Promise<any> {
    try {
      const patch = args && typeof args === 'object' ? (args.patch || args) : {};
      const config = storageService.save(patch);
      return { ok: true, config };
    } catch (e: any) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  }
}

export default StorageController;
