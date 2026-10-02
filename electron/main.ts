import { ElectronEgg } from 'ee-core';
import { Lifecycle } from './preload/lifecycle';
import { preload } from './preload';
import { runSelfTest } from './selftest';

// 自检模式：验证主进程服务链路（SCC 运行、存储、导入、导出），不影响正常启动
if (process.argv.includes('--selftest')) {
  runSelfTest();
}

// new app
const app = new ElectronEgg();

// register lifecycle
const life = new Lifecycle();
app.register("ready", life.ready);
app.register("electron-app-ready", life.electronAppReady);
app.register("window-ready", life.windowReady);
app.register("before-close", life.beforeClose);

// register preload
app.register("preload", preload);

// run
app.run();
