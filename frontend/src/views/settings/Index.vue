<template>
  <div class="page">
    <h1 class="page-title">设置</h1>
    <p class="page-desc">统计引擎配置、生产力估算参数与数据管理，全部配置保存在本机。</p>

    <!-- 统计引擎 -->
    <n-card size="small" class="card-block">
      <template #header><span style="font-size: 14px">统计引擎</span></template>
      <template #header-extra>
        <n-radio-group :value="defaultEngine" size="small" @update:value="onDefaultEngineChange">
          <n-radio-button value="scc">默认使用 SCC</n-radio-button>
          <n-radio-button value="cloc">默认使用 CLOC</n-radio-button>
        </n-radio-group>
      </template>

      <!-- SCC -->
      <n-divider title-placement="left" style="margin: 8px 0 12px">SCC（Succinct Code Counter）</n-divider>
      <n-space vertical size="medium">
        <n-radio-group :value="sccMode" @update:value="onSccModeChange">
          <n-radio value="builtin" :disabled="!appStore.appInfo.hasBuiltinScc">
            使用内置 SCC
            <span class="radio-desc">
              {{ appStore.appInfo.hasBuiltinScc ? '随应用打包的多平台 SCC 可执行文件，无需安装' : '当前平台未检测到内置 SCC，请使用自定义路径' }}
            </span>
          </n-radio>
          <n-radio value="custom">
            使用自定义 SCC 路径
            <span class="radio-desc">指定本机 SCC 可执行文件（或其所在目录），保存后自动校验可用性</span>
          </n-radio>
        </n-radio-group>

        <div v-if="sccMode === 'custom'">
          <n-input-group>
            <n-input v-model:value="sccCustomPath" placeholder="SCC 可执行文件路径，如 D:/tools/scc/scc.exe" class="mono" />
            <n-button @click="browseEngine('scc')">浏览…</n-button>
            <n-button type="primary" ghost :loading="checking === 'scc'" @click="checkNow('scc')">校验</n-button>
          </n-input-group>
        </div>

        <n-descriptions :column="1" size="small" bordered label-placement="left" style="max-width: 720px">
          <n-descriptions-item label="当前生效路径">
            <span class="mono">{{ sccResolved.path || '-' }}</span>
            <n-tag size="tiny" :type="sccCheck && sccCheck.ok ? 'success' : 'error'" style="margin-left: 6px">
              {{ sccCheck ? (sccCheck.ok ? `可用 ${sccCheck.version}` : '不可用') : '未校验' }}
            </n-tag>
          </n-descriptions-item>
        </n-descriptions>
      </n-space>

      <!-- CLOC -->
      <n-divider title-placement="left" style="margin: 16px 0 12px">CLOC（Count Lines of Code）</n-divider>
      <n-space vertical size="medium">
        <n-radio-group :value="clocMode" @update:value="onClocModeChange">
          <n-radio value="builtin" :disabled="!clocHasBuiltin">
            使用内置 CLOC
            <span class="radio-desc">
              {{ clocHasBuiltin ? (isWin ? '内置官方 Windows 独立程序，无需安装' : '内置官方单文件脚本，通过系统 Perl 运行（需已安装 Perl）') : '当前平台未检测到内置 CLOC，请使用自定义路径' }}
            </span>
          </n-radio>
          <n-radio value="custom">
            使用自定义 CLOC 路径
            <span class="radio-desc">指定 cloc 可执行文件或 cloc.pl 脚本（.pl 需系统 Perl），保存后自动校验</span>
          </n-radio>
        </n-radio-group>

        <div v-if="clocMode === 'custom'">
          <n-input-group>
            <n-input v-model:value="clocCustomPath" placeholder="CLOC 路径，如 D:/tools/cloc/cloc.exe 或 /usr/local/bin/cloc.pl" class="mono" />
            <n-button @click="browseEngine('cloc')">浏览…</n-button>
            <n-button type="primary" ghost :loading="checking === 'cloc'" @click="checkNow('cloc')">校验</n-button>
          </n-input-group>
        </div>

        <n-descriptions :column="1" size="small" bordered label-placement="left" style="max-width: 720px">
          <n-descriptions-item label="当前生效路径">
            <span class="mono">{{ clocResolved.path || '-' }}</span>
            <n-tag size="tiny" :type="clocCheck && clocCheck.ok ? 'success' : 'error'" style="margin-left: 6px">
              {{ clocCheck ? (clocCheck.ok ? `可用 ${clocCheck.version}` : '不可用') : '未校验' }}
            </n-tag>
          </n-descriptions-item>
        </n-descriptions>

        <n-alert type="info" :bordered="false">
          引擎差异：SCC 支持圈复杂度、字节数、.gitignore/.ignore 规则与去重；CLOC 无这些能力但语言覆盖面广。切换入口在「代码统计」页右上角。
        </n-alert>
      </n-space>
    </n-card>

    <!-- 估算参数 -->
    <n-card size="small" class="card-block">
      <template #header><span style="font-size: 14px">生产力估算默认参数</span></template>
      <template #header-extra>
        <n-button size="small" @click="resetEst">恢复默认</n-button>
      </template>
      <estimation-params-form v-model="estParams">
        <template #actions>
          <n-text depth="3" style="font-size: 12px">作为「生产力估算」页的初始参数，调整后立即保存。</n-text>
        </template>
      </estimation-params-form>
    </n-card>

    <!-- 数据管理 -->
    <n-card size="small" class="card-block">
      <template #header><span style="font-size: 14px">数据管理</span></template>
      <n-space vertical size="medium">
        <n-space align="center">
          <n-button size="small" @click="clearHistory">清除统计历史</n-button>
          <n-text depth="3" style="font-size: 12px">删除最近一次统计/导入结果的本地缓存，不影响配置</n-text>
        </n-space>
        <n-space align="center">
          <n-button size="small" type="error" ghost @click="resetAll">重置全部配置</n-button>
          <n-text depth="3" style="font-size: 12px">恢复出厂设置：清除常用目录、引擎路径、过滤规则与估算参数</n-text>
        </n-space>
        <n-alert type="info" :bordered="false">
          所有统计数据与配置仅保存在本机用户数据目录，不会上传至任何远程服务器。
        </n-alert>
      </n-space>
    </n-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NButton, NSpace, NText, NRadioGroup, NRadioButton, NInput, NInputGroup,
  NAlert, NDescriptions, NDescriptionsItem, NTag, NDivider, useMessage, useDialog
} from 'naive-ui';
import EstimationParamsForm from '@/components/EstimationParamsForm.vue';
import { appStore, saveConfig, refreshEngineStatus, engineName } from '@/store';
import { ipcApiRoute, invoke } from '@/api';
import { DEFAULT_ESTIMATION } from '@/api/defaults';

const message = useMessage();
const dialog = useDialog();
const router = useRouter();

const isWin = computed(() => (typeof process !== 'undefined' && process.platform === 'win32') || appStore.appInfo.platform === 'win32');
const defaultEngine = computed(() => (appStore.config.engine === 'cloc' ? 'cloc' : 'scc'));

const sccMode = ref('builtin');
const sccCustomPath = ref('');
const sccCheck = ref(null);
const sccResolved = ref({ path: '' });

const clocMode = ref('builtin');
const clocCustomPath = ref('');
const clocCheck = ref(null);
const clocResolved = ref({ path: '' });
const clocHasBuiltin = ref(false);

const checking = ref('');
const estParams = ref({ ...DEFAULT_ESTIMATION, ...appStore.config.estimation });

onMounted(async () => {
  sccMode.value = appStore.config.scc.useBuiltin ? 'builtin' : 'custom';
  sccCustomPath.value = appStore.config.scc.customPath || '';
  clocMode.value = appStore.config.cloc.useBuiltin ? 'builtin' : 'custom';
  clocCustomPath.value = appStore.config.cloc.customPath || '';
  estParams.value = { ...DEFAULT_ESTIMATION, ...appStore.config.estimation };
  await refreshResolves();
});

async function refreshResolves() {
  // 分别解析两个引擎的生效路径与可用性
  const rs = await invoke(ipcApiRoute.resolveScc, { engine: 'scc' });
  sccResolved.value = rs || { path: '' };
  if (rs && rs.path) sccCheck.value = await invoke(ipcApiRoute.checkScc, { engine: 'scc' });
  const rc = await invoke(ipcApiRoute.resolveScc, { engine: 'cloc' });
  clocResolved.value = rc || { path: '' };
  clocHasBuiltin.value = !!(rc && rc.hasBuiltin);
  if (rc && rc.path) clocCheck.value = await invoke(ipcApiRoute.checkScc, { engine: 'cloc' });
  await refreshEngineStatus();
}

async function onDefaultEngineChange(v) {
  await saveConfig({ engine: v === 'cloc' ? 'cloc' : 'scc' });
  await refreshEngineStatus();
  message.success(`默认引擎已切换为 ${engineName(v)}`);
}

async function persistEngineConfig(engine) {
  if (engine === 'cloc') {
    await saveConfig({
      cloc: { useBuiltin: clocMode.value === 'builtin', customPath: clocCustomPath.value.trim() }
    });
  } else {
    await saveConfig({
      scc: { useBuiltin: sccMode.value === 'builtin', customPath: sccCustomPath.value.trim() }
    });
  }
}

async function onSccModeChange() {
  sccCheck.value = null;
  await persistEngineConfig('scc');
  await refreshResolves();
}

async function onClocModeChange() {
  clocCheck.value = null;
  await persistEngineConfig('cloc');
  await refreshResolves();
}

async function browseEngine(engine) {
  const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
  const res = await invoke(ipcApiRoute.selectFile, {
    title: engine === 'cloc' ? '选择 CLOC 可执行文件 / cloc.pl 脚本' : '选择 SCC 可执行文件',
    filters: isWindows
      ? [{ name: '可执行文件 / 脚本', extensions: ['exe', 'pl'] }]
      : [{ name: '所有文件', extensions: ['*'] }]
  });
  if (res && res.ok && res.path) {
    if (engine === 'cloc') clocCustomPath.value = res.path;
    else sccCustomPath.value = res.path;
    await persistEngineConfig(engine);
    await checkNow(engine);
  }
}

async function checkNow(engine) {
  checking.value = engine;
  try {
    await persistEngineConfig(engine);
    const res = await invoke(ipcApiRoute.checkScc, {
      engine,
      useBuiltin: (engine === 'cloc' ? clocMode : sccMode).value === 'builtin',
      customPath: (engine === 'cloc' ? clocCustomPath : sccCustomPath).value.trim()
    });
    if (engine === 'cloc') clocCheck.value = res;
    else sccCheck.value = res;
    if (res && res.ok) message.success(`${engineName(engine)} ${res.version} 校验通过`);
    await refreshEngineStatus();
  } finally {
    checking.value = '';
  }
}

function resetEst() {
  estParams.value = { ...DEFAULT_ESTIMATION };
}

async function clearHistory() {
  await saveConfig({ lastResult: null });
  appStore.result = null;
  message.success('已清除统计历史');
}

function resetAll() {
  dialog.warning({
    title: '重置全部配置',
    content: '将清除常用目录、引擎路径配置、默认过滤规则、估算参数与统计历史，恢复默认设置。该操作不可恢复，确定继续？',
    positiveText: '确定重置',
    negativeText: '取消',
    onPositiveClick: async () => {
      await saveConfig({
        engine: 'scc',
        scc: { useBuiltin: true, customPath: '' },
        cloc: { useBuiltin: true, customPath: '' },
        commonDirs: [],
        defaultExcludeDirs: ['node_modules', 'dist', 'build', 'out', '.git', '.hg', '.svn', '.idea', '.vscode', 'vendor', 'target', '__pycache__'],
        defaultExcludeExts: [],
        options: { byFile: true, noIgnore: false, noGitignore: false, noDuplicates: false },
        estimation: { ...DEFAULT_ESTIMATION },
        lastResult: null
      });
      appStore.result = null;
      appStore.draft.dirs = [];
      appStore.draft.excludeDirs = [...appStore.config.defaultExcludeDirs];
      appStore.draft.excludeExts = [];
      sccMode.value = 'builtin';
      sccCustomPath.value = '';
      clocMode.value = 'builtin';
      clocCustomPath.value = '';
      sccCheck.value = null;
      clocCheck.value = null;
      estParams.value = { ...DEFAULT_ESTIMATION };
      await refreshResolves();
      message.success('已恢复默认配置');
    }
  });
}
</script>

<style scoped>
.radio-desc {
  display: block;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}
</style>
