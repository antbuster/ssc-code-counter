import path from 'path';
import { getBaseDir } from 'ee-core/ps';
import type { Config } from 'ee-core';

/**
 * 默认配置
 */
export default (): Partial<Config> => {
  return {
    openDevTools: false,
    singleLock: true,
    windowsOption: {
      title: 'SCC 代码统计',
      width: 1280,
      height: 860,
      minWidth: 1024,
      minHeight: 680,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
      frame: true,
      show: true,
      icon: path.join(getBaseDir(), 'public', 'images', 'logo-32.png'),
    },
    logger: {
      level: 'info',
      rotator: 'daily',
      dateFormat: 'yyyy-MM-dd',
      maxSize: '100m',
      redact: [],
      redactCensor: '[Redacted]',
      timestamp: true,
      depthLimit: 5,
      timezone: 'Asia/Shanghai',
      name: 'scc-code-counter',
      appLogName: 'scc-code-counter.log',
      coreLogName: 'ee-core.log',
      errorLogName: 'ee-error.log'
    },
    remote: {
      enable: false,
      url: ''
    },
    // 本地统计工具，无需对外网络服务，全部关闭
    socketServer: {
      enable: false,
      port: 7070,
      path: "/socket.io/",
      connectTimeout: 45000,
      pingTimeout: 30000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8,
      transports: ["polling", "websocket"],
      cors: {
        origin: true,
      },
      channel: 'socket-channel'
    },
    httpServer: {
      enable: false,
      https: {
        enable: false,
        key: '',
        cert: ''
      },
      protocol: 'http://',
      host: '127.0.0.1',
      port: 7071,
      cors: { origin: '*' },
      body: {
        multipart: false,
        formidable: { keepExtensions: false }
      },
      filterRequest: {
        uris: [],
        returnData: ''
      },
    },
    mainServer: {
      protocol: 'file://',
      indexPath: '/public/dist/index.html',
      channelSeparator: '/',
    }
  }
}
