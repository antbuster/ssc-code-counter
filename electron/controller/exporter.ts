import { exportService } from '../service/export';

/**
 * 导出控制器：JSON / Excel / HTML
 */
class ExporterController {
  /**
   * 保存导出文件
   * payload: {format, result, estimation, sections}
   */
  async save(args: any = {}): Promise<any> {
    const filePath = String(args.filePath || '');
    const payload = args.payload || {};
    return exportService.save(filePath, payload);
  }
}

export default ExporterController;
