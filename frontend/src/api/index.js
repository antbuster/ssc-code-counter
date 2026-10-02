/**
 * 主进程与渲染进程通信频道定义
 * 频道格式：controller/<控制器文件名>/<方法名>
 */
import { ipc, isEE } from '@/utils/ipcRenderer';

const ipcApiRoute = {
  // 通用
  ping: 'controller/common/ping',
  selectDirectory: 'controller/common/selectDirectory',
  selectFile: 'controller/common/selectFile',
  selectSaveFile: 'controller/common/selectSaveFile',
  openPath: 'controller/common/openPath',
  revealItem: 'controller/common/revealItem',

  // 代码统计
  runStats: 'controller/codestats/run',
  cancelStats: 'controller/codestats/cancel',
  checkScc: 'controller/codestats/checkScc',
  resolveScc: 'controller/codestats/resolveScc',
  parseImportFile: 'controller/codestats/parseImportFile',
  importSupport: 'controller/codestats/importSupport',

  // 配置存储
  storageGet: 'controller/storage/get',
  storageSave: 'controller/storage/save',

  // 数据导出
  exportSave: 'controller/exporter/save'
};

/**
 * IPC 参数净化：Electron 结构化克隆不支持 Vue reactive Proxy 等对象
 * （会抛 "An object could not be cloned"），统一深拷贝为纯 JSON 数据。
 * 注意：经此通道的参数必须是可 JSON 序列化的纯数据（本应用所有 IPC 均满足）。
 */
function toPlain(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch (e) {
    console.error('[ipc] 参数序列化失败，已降级为空参数', e);
    return {};
  }
}

/**
 * 调用主进程：统一错误兜底，返回 {ok, ...}
 */
async function invoke(route, args = {}) {
  if (!isEE) {
    // 浏览器演示模式
    const { mockInvoke } = await import('./mock');
    return mockInvoke(route, args);
  }
  try {
    const res = await ipc.invoke(route, toPlain(args));
    if (res && res.__EE_ERROR__) {
      return { ok: false, message: res.message };
    }
    return res;
  } catch (e) {
    // ipcMain.handle 抛出的异常在渲染端表现为 reject
    const msg = e && e.message ? e.message : String(e);
    return { ok: false, message: msg.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '') };
  }
}

export { ipcApiRoute, invoke };
