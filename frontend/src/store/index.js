import { reactive, computed } from 'vue';
import { ipcApiRoute, invoke } from '@/api';
import { isEE } from '@/utils/ipcRenderer';
import { defaultLocalConfig } from '@/api/defaults';

/**
 * 全局响应式状态（轻量 store，跨视图共享统计结果与配置）
 */
export const appStore = reactive({
  ready: false,
  bootError: '',
  isEE,
  appInfo: {
    appVersion: '-',
    electron: '-',
    platform: '-',
    arch: '-',
    hasBuiltinScc: false
  },
  config: defaultLocalConfig(),
  /** 最近一次统计/导入的归一化结果 */
  result: null,
  /** 统计表单草稿（跨视图保留） */
  draft: {
    dirs: [],
    excludeDirs: [],
    excludeExts: [],
    includeExts: [],
    options: { byFile: true, noIgnore: false, noGitignore: false, noDuplicates: false }
  },
  running: false,
  runError: '',
  lastRunMeta: null,
  /** 当前引擎状态（设置页/顶栏展示） */
  engineStatus: { engine: 'scc', ok: false, version: '', isBuiltin: true, path: '', message: '' }
});

/** 引擎显示名 */
export function engineName(engine) {
  return engine === 'cloc' ? 'CLOC' : 'SCC';
}

/** 代码总行数（估算数据来源） */
export const codeLines = computed(() => (appStore.result && appStore.result.summary ? appStore.result.summary.code : 0));

/** 是否已有统计数据 */
export const hasResult = computed(() => !!(appStore.result && appStore.result.ok));

/**
 * 刷新当前统计引擎可用状态
 */
export async function refreshEngineStatus() {
  const engine = appStore.config.engine === 'cloc' ? 'cloc' : 'scc';
  const res = await invoke(ipcApiRoute.resolveScc, { engine });
  if (res && res.path !== undefined) {
    const check = await invoke(ipcApiRoute.checkScc, { engine });
    appStore.engineStatus = {
      engine,
      ok: !!check.ok,
      version: check.version || '',
      isBuiltin: !!check.isBuiltin,
      path: check.resolvedPath || res.path || '',
      message: check.message || res.error || ''
    };
    console.log(`[frontend] ${engine} status: ok=${appStore.engineStatus.ok} version=${appStore.engineStatus.version} builtin=${appStore.engineStatus.isBuiltin}`);
  }
  return appStore.engineStatus;
}

/**
 * 初始化：探测环境 + 拉取配置（含最近统计结果）
 */
export async function initStore() {
  try {
    const ping = await invoke(ipcApiRoute.ping);
    if (ping && ping.ok) {
      appStore.appInfo = {
        appVersion: ping.appVersion || '-',
        electron: ping.electron || '-',
        platform: ping.platform || '-',
        arch: ping.arch || '-',
        hasBuiltinScc: !!ping.hasBuiltinScc
      };
    }
    const res = await invoke(ipcApiRoute.storageGet);
    if (res && res.ok && res.config) {
      appStore.config = { ...defaultLocalConfig(), ...res.config };
      if (res.config.lastResult && res.config.lastResult.ok) {
        appStore.result = res.config.lastResult;
      }
      // 草稿默认取默认排除规则
      appStore.draft.excludeDirs = [...appStore.config.defaultExcludeDirs];
      appStore.draft.excludeExts = [...(appStore.config.defaultExcludeExts || [])];
    }
  } catch (e) {
    appStore.bootError = e && e.stack ? e.stack : String(e);
    console.error('[initStore]', e);
  }
  appStore.ready = true;
  refreshEngineStatus();
  return appStore;
}

/**
 * 持久化配置补丁
 */
export async function saveConfig(patch) {
  const res = await invoke(ipcApiRoute.storageSave, { patch });
  if (res && res.ok && res.config) {
    appStore.config = { ...defaultLocalConfig(), ...res.config };
  }
  return res;
}

/**
 * 写入统计结果（供 run / import 共用）
 */
export function setResult(result) {
  appStore.result = result;
  if (result && result.ok) {
    appStore.lastRunMeta = {
      time: result.generatedAt,
      cmd: result.cmd,
      durationMs: result.durationMs,
      source: result.source,
      sccVersion: result.sccVersion
    };
  }
}

/**
 * 执行 SCC 统计（使用当前草稿）
 */
export async function runStats(extra = {}) {
  appStore.running = true;
  appStore.runError = '';
  try {
    const payload = {
      engine: appStore.config.engine === 'cloc' ? 'cloc' : 'scc',
      dirs: [...appStore.draft.dirs],
      excludeDirs: [...appStore.draft.excludeDirs],
      excludeExts: [...appStore.draft.excludeExts],
      includeExts: [...appStore.draft.includeExts],
      ...appStore.draft.options,
      ...extra
    };
    const res = await invoke(ipcApiRoute.runStats, payload);
    if (res && res.ok) {
      setResult(res);
      // 运行成功后把选项固化为默认（不含目录）
      saveConfig({ options: { ...appStore.draft.options } });
      return res;
    }
    appStore.runError = (res && res.message) || '统计失败';
    return res;
  } catch (e) {
    appStore.runError = e && e.message ? e.message : String(e);
    return { ok: false, message: appStore.runError };
  } finally {
    appStore.running = false;
  }
}

/**
 * 取消统计
 */
export async function cancelStats() {
  return invoke(ipcApiRoute.cancelStats);
}

/**
 * 导入 SCC 统计文件
 */
export async function importStatsFile(filePath) {
  appStore.running = true;
  appStore.runError = '';
  try {
    const res = await invoke(ipcApiRoute.parseImportFile, { filePath });
    if (res && res.ok) {
      setResult(res);
      return res;
    }
    appStore.runError = (res && res.message) || '导入失败';
    return res;
  } finally {
    appStore.running = false;
  }
}
