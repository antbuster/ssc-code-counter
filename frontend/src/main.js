import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { appStore } from '@/store';
import './assets/global.css';

// 全局错误兜底：未捕获异常与 Promise 拒绝输出到控制台，便于排查
window.addEventListener('error', e => {
  console.error('[global-error]', e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', e => {
  console.error('[unhandled-rejection]', e.reason && (e.reason.stack || e.reason.message) || e.reason);
});

const app = createApp(App);
app.config.errorHandler = (err, instance, info) => {
  console.error('[vue-error]', err && (err.stack || err.message), info);
};
app.use(router);
app.mount('#app');

// 开发调试：控制台可直接查看全局状态
if (import.meta.env.DEV) {
  window.__appStore = appStore;
}
