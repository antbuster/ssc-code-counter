import { dialog, shell } from 'electron';
import { getMainWindow } from 'ee-core/electron';
import { app } from 'electron';
import { sccService } from '../service/scc';

/**
 * 通用控制器：对话框、shell、应用信息、连通性
 */
class CommonController {
  /**
   * 连通性测试 + 应用信息
   */
  async ping(): Promise<any> {
    return {
      ok: true,
      message: 'pong',
      appVersion: app.getVersion(),
      electron: process.versions.electron,
      platform: process.platform,
      arch: process.arch,
      hasBuiltinScc: sccService.hasBuiltin()
    };
  }

  /**
   * 选择目录（单个或多个）
   */
  async selectDirectory(args: any = {}): Promise<any> {
    const win = getMainWindow();
    const props: any[] = ['openDirectory'];
    if (args.multi) props.push('multiSelections');
    if (args.defaultPath) props.push('createDirectory');
    const opts: any = {
      title: args.title || '选择目录',
      properties: props
    };
    if (args.defaultPath) opts.defaultPath = args.defaultPath;
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (r.canceled || !r.filePaths || !r.filePaths.length) {
      return { ok: false, canceled: true, paths: [] };
    }
    return { ok: true, canceled: false, paths: r.filePaths };
  }

  /**
   * 选择文件
   */
  async selectFile(args: any = {}): Promise<any> {
    const win = getMainWindow();
    const opts: any = {
      title: args.title || '选择文件',
      properties: ['openFile']
    };
    if (args.filters) opts.filters = args.filters;
    if (args.defaultPath) opts.defaultPath = args.defaultPath;
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (r.canceled || !r.filePaths || !r.filePaths.length) {
      return { ok: false, canceled: true, path: '' };
    }
    return { ok: true, canceled: false, path: r.filePaths[0] };
  }

  /**
   * 选择保存文件路径
   */
  async selectSaveFile(args: any = {}): Promise<any> {
    const win = getMainWindow();
    const opts: any = {
      title: args.title || '保存文件'
    };
    if (args.defaultName) opts.defaultPath = args.defaultName;
    if (args.filters) opts.filters = args.filters;
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (r.canceled || !r.filePath) {
      return { ok: false, canceled: true, path: '' };
    }
    return { ok: true, canceled: false, path: r.filePath };
  }

  /**
   * 使用系统默认程序打开路径
   */
  async openPath(args: any = {}): Promise<any> {
    const p = String(args.path || '');
    if (!p) return { ok: false, message: '路径为空' };
    const err = await shell.openPath(p);
    return err ? { ok: false, message: err } : { ok: true };
  }

  /**
   * 在文件管理器中显示
   */
  async revealItem(args: any = {}): Promise<any> {
    const p = String(args.path || '');
    if (!p) return { ok: false, message: '路径为空' };
    shell.showItemInFolder(p);
    return { ok: true };
  }
}

export default CommonController;
