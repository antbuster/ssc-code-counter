<template>
  <div class="page">
    <h1 class="page-title">目录管理</h1>
    <p class="page-desc">维护常用统计目录与默认过滤规则，支持一键快速统计。</p>

    <!-- 常用目录 -->
    <n-card class="card-block" size="small">
      <template #header><span style="font-size: 14px">常用目录</span></template>
      <template #header-extra>
        <n-space size="small">
          <n-button size="small" @click="addSingle">添加目录</n-button>
          <n-button size="small" @click="addMulti">批量添加</n-button>
        </n-space>
      </template>

      <n-data-table
        :columns="dirColumns"
        :data="commonDirs"
        size="small"
        striped
        :pagination="false"
        :max-height="380"
        :bordered="false"
      >
        <template #empty>
          <n-empty description="暂无常用目录，点击右上角添加" />
        </template>
      </n-data-table>
    </n-card>

    <!-- 默认过滤规则 -->
    <n-card class="card-block" size="small">
      <template #header><span style="font-size: 14px">默认过滤规则</span></template>
      <template #header-extra>
        <n-space size="small">
          <n-button size="small" @click="resetFilters">恢复默认</n-button>
        </n-space>
      </template>

      <n-grid :cols="2" :x-gap="16" :y-gap="8">
        <n-gi>
          <div class="field-label">默认排除目录</div>
          <n-select
            v-model:value="defaultExcludeDirs"
            multiple filterable tag :show="false" :show-arrow="false"
            placeholder="输入目录名后回车，如 node_modules"
            size="small"
          />
        </n-gi>
        <n-gi>
          <div class="field-label">默认排除扩展名</div>
          <n-select
            v-model:value="defaultExcludeExts"
            multiple filterable tag :show="false" :show-arrow="false"
            placeholder="输入扩展名后回车，如 exe"
            size="small"
          />
        </n-gi>
      </n-grid>
      <n-text depth="3" style="font-size: 12px; display: block; margin-top: 8px">
        默认规则将自动应用到「代码统计」页的过滤条件；修改后立即保存。
      </n-text>
    </n-card>

    <!-- 快速统计确认弹窗 -->
    <n-modal
      v-model:show="quick.show"
      preset="dialog"
      type="info"
      title="快速统计"
      :content="`使用默认过滤规则统计：${quick.dirPath}`"
      positive-text="开始统计"
      negative-text="取消"
      :loading="running"
      @positive-click="doQuickStats"
    />
  </div>
</template>

<script setup>
import { computed, h, reactive } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NButton, NSpace, NGrid, NGi, NSelect, NDataTable, NEmpty, NInput,
  NModal, NText, NPopconfirm, useMessage
} from 'naive-ui';
import { appStore, saveConfig, runStats } from '@/store';
import { ipcApiRoute, invoke } from '@/api';
import { fmt0, fmtTime } from '@/utils/format';

const message = useMessage();
const router = useRouter();

const quick = reactive({ show: false, dirPath: '' });
const running = computed(() => appStore.running);
const commonDirs = computed(() => appStore.config.commonDirs || []);

const defaultExcludeDirs = computed({
  get: () => appStore.config.defaultExcludeDirs || [],
  set: v => { saveConfig({ defaultExcludeDirs: v }); }
});
const defaultExcludeExts = computed({
  get: () => appStore.config.defaultExcludeExts || [],
  set: v => { saveConfig({ defaultExcludeExts: v }); }
});

async function pick(multi) {
  const res = await invoke(ipcApiRoute.selectDirectory, { multi });
  return res && res.ok ? res.paths || [] : [];
}

async function addSingle() {
  const paths = await pick(false);
  if (paths.length) await addDirs(paths);
}

async function addMulti() {
  const paths = await pick(true);
  if (paths.length) await addDirs(paths);
}

async function addDirs(paths) {
  const map = new Map(commonDirs.value.map(d => [d.path, d]));
  for (const p of paths) {
    if (!map.has(p)) {
      map.set(p, {
        path: p,
        label: p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p,
        note: '',
        lastUsedAt: new Date().toISOString()
      });
    }
  }
  await saveConfig({ commonDirs: [...map.values()] });
  message.success(`已保存 ${paths.length} 个常用目录`);
}

function removeDir(path) {
  const next = commonDirs.value.filter(d => d.path !== path);
  saveConfig({ commonDirs: next });
  message.success('已删除');
}

async function updateNote(path, note) {
  const next = commonDirs.value.map(d => (d.path === path ? { ...d, note } : d));
  await saveConfig({ commonDirs: next });
}

function fillToStats(path) {
  if (!appStore.draft.dirs.includes(path)) {
    appStore.draft.dirs.push(path);
  }
  message.success('已填入代码统计页');
  router.push({ name: 'stats' });
}

function askQuickStats(path) {
  quick.dirPath = path;
  quick.show = true;
}

async function doQuickStats() {
  appStore.draft.dirs = [quick.dirPath];
  appStore.draft.excludeDirs = [...appStore.config.defaultExcludeDirs];
  appStore.draft.excludeExts = [...(appStore.config.defaultExcludeExts || [])];
  const res = await runStats();
  if (res && res.ok) {
    message.success(`统计完成：${fmt0(res.summary.count)} 个文件`);
    router.push({ name: 'analysis' });
  } else {
    message.error(appStore.runError || '统计失败');
  }
}

function resetFilters() {
  saveConfig({
    defaultExcludeDirs: ['node_modules', 'dist', 'build', 'out', '.git', '.hg', '.svn', '.idea', '.vscode', 'vendor', 'target', '__pycache__'],
    defaultExcludeExts: []
  });
  message.success('已恢复默认过滤规则');
}

const dirColumns = [
  {
    title: '目录',
    key: 'path',
    ellipsis: { tooltip: true },
    render: r => h('span', { class: 'mono' }, r.path)
  },
  {
    title: '备注',
    key: 'note',
    width: 220,
    render: r => h(NInput, {
      value: r.note || '',
      placeholder: '添加备注',
      size: 'small',
      onBlur: e => updateNote(r.path, e.target.value),
      'onUpdate:value': v => { r.note = v; }
    })
  },
  { title: '最近使用', key: 'lastUsedAt', width: 170, render: r => fmtTime(r.lastUsedAt) },
  {
    title: '操作',
    key: 'actions',
    width: 250,
    render: r => h(NSpace, { size: 'small' }, () => [
      h(NButton, { size: 'tiny', type: 'primary', ghost: true, onClick: () => askQuickStats(r.path) }, () => '快速统计'),
      h(NButton, { size: 'tiny', onClick: () => fillToStats(r.path) }, () => '填入统计'),
      h(NButton, { size: 'tiny', onClick: () => invoke(ipcApiRoute.openPath, { path: r.path }) }, () => '打开'),
      h(NPopconfirm, { onPositiveClick: () => removeDir(r.path) }, {
        trigger: () => h(NButton, { size: 'tiny', type: 'error', ghost: true }, () => '删除'),
        default: () => '确定删除该常用目录？'
      })
    ])
  }
];
</script>

<style scoped>
.field-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}
</style>
