const Renderer = (window.require && window.require('electron')) || window.electron || {};

/**
 * ipc
 * 官方api说明：https://www.electronjs.org/zh/docs/latest/api/ipc-renderer
 *
 * 属性/方法
 * ipc.invoke(channel, param) - 发送异步消息（invoke/handle 模型）
 * ipc.sendSync(channel, param) - 发送同步消息（send/on 模型）
 */
const ipc = Renderer.ipcRenderer || undefined;

/**
 * 是否为EE环境（Electron 应用内）
 */
const isEE = ipc ? true : false;

export {
  Renderer, ipc, isEE
};
