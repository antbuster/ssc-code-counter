<template>
  <div class="page">
    <h1 class="page-title">代码统计</h1>
    <p class="page-desc">选择一个或多个目录，调用 SCC 统计引擎完成代码规模分析；也可导入 SCC 导出的统计文件。</p>

    <!-- 统计设置 -->
    <n-card class="card-block" :bordered="true" size="small">
      <template #header>
        <span style="font-size: 14px">统计设置</span>
      </template>
      <template #header-extra>
        <n-space size="small" align="center">
          <n-radio-group :value="currentEngine" size="small" @update:value="onEngineChange">
            <n-radio-button value="scc">SCC 引擎</n-radio-button>
            <n-radio-button value="cloc">CLOC 引擎</n-radio-button>
          </n-radio-group>
          <n-button size="small" @click="addDirsMulti" :disabled="running">批量添加目录</n-button>
          <n-button size="small" @click="addDirSingle" :disabled="running">添加目录</n-button>
          <n-button size="small" @click="saveAsCommonDir" :disabled="running || !draft.dirs.length">存为常用目录</n-button>
        </n-space>
      </template>

      <!-- 目录列表 -->
      <div class="dir-list">
        <n-empty v-if="!draft.dirs.length" description="尚未添加统计目录，点击右上角「添加目录」开始" size="small" />
        <div v-for="(d, i) in draft.dirs" :key="d" class="dir-row">
          <n-input-group>
            <n-input :value="d" readonly placeholder="目录路径" size="small" class="mono" />
            <n-button size="small" @click="replaceDir(i)" :disabled="running">更换</n-button>
            <n-button size="small" type="error" ghost @click="removeDir(i)" :disabled="running">移除</n-button>
          </n-input-group>
        </div>
      </div>

      <!-- 过滤规则 -->
      <n-grid :cols="3" :x-gap="12" :y-gap="8" style="margin-top: 12px">
        <n-gi>
          <div class="field-label">排除目录（名称，逗号或回车分隔）</div>
          <n-select
            v-model:value="draft.excludeDirs"
            multiple filterable tag :show="false" :show-arrow="false"
            placeholder="如 node_modules, dist"
            :options="excludeDirOptions"
            :disabled="running"
            size="small"
          />
        </n-gi>
        <n-gi>
          <div class="field-label">排除扩展名</div>
          <n-select
            v-model:value="draft.excludeExts"
            multiple filterable tag :show="false" :show-arrow="false"
            placeholder="如 exe, dll, min.js"
            :options="[]"
            :disabled="running"
            size="small"
          />
        </n-gi>
        <n-gi>
          <div class="field-label">仅包含扩展名（留空为全部）</div>
          <n-select
            v-model:value="draft.includeExts"
            multiple filterable tag :show="false" :show-arrow="false"
            placeholder="如 go, java, vue"
            :options="[]"
            :disabled="running"
            size="small"
          />
        </n-gi>
      </n-grid>

      <!-- 选项 -->
      <n-space size="medium" style="margin-top: 10px" align="center">
        <n-checkbox v-model:checked="draft.options.byFile" :disabled="running">文件明细 (--by-file)</n-checkbox>
        <n-tooltip :disabled="currentEngine !== 'cloc'" trigger="hover">
          <template #trigger>
            <n-checkbox v-model:checked="draft.options.noIgnore" :disabled="running || currentEngine === 'cloc'">忽略 .ignore 规则</n-checkbox>
          </template>
          仅 SCC 引擎支持
        </n-tooltip>
        <n-tooltip :disabled="currentEngine !== 'cloc'" trigger="hover">
          <template #trigger>
            <n-checkbox v-model:checked="draft.options.noGitignore" :disabled="running || currentEngine === 'cloc'">忽略 .gitignore 规则</n-checkbox>
          </template>
          仅 SCC 引擎支持
        </n-tooltip>
        <n-tooltip :disabled="currentEngine !== 'cloc'" trigger="hover">
          <template #trigger>
            <n-checkbox v-model:checked="draft.options.noDuplicates" :disabled="running || currentEngine === 'cloc'">剔除重复文件</n-checkbox>
          </template>
          仅 SCC 引擎支持
        </n-tooltip>
      </n-space>
      <n-alert v-if="currentEngine === 'cloc'" type="info" :bordered="false" style="margin-top: 10px">
        CLOC 引擎：不提供圈复杂度 / 字节数统计，默认不应用 .gitignore 规则；Windows 使用内置独立程序，Linux/macOS 通过系统 Perl 运行（需已安装 Perl）。提示：Windows 下 cloc 可能漏计非 ASCII（中文）文件名的文件，此类项目建议使用 SCC。
      </n-alert>

      <!-- 操作 -->
      <n-space style="margin-top: 14px" align="center">
        <n-button type="primary" :loading="running" @click="startStats" :disabled="!draft.dirs.length">
          {{ running ? '统计中…' : '开始统计' }}
        </n-button>
        <n-button v-if="running" type="warning" ghost @click="doCancel">取消</n-button>
        <n-button @click="importFile" :disabled="running">导入统计文件（JSON / CSV）</n-button>
        <n-text depth="3" style="font-size: 12px">
          引擎：{{ appStore.engineStatus.ok ? (appStore.engineStatus.isBuiltin ? `内置 ${engineName(currentEngine)} ${appStore.engineStatus.version}` : `自定义 ${engineName(currentEngine)} ${appStore.engineStatus.version}`) : `${engineName(currentEngine)} 未就绪（前往设置页配置）` }}
        </n-text>
      </n-space>
    </n-card>

    <!-- 错误提示 -->
    <n-alert v-if="runError && !running" type="error" closable class="card-block" @close="runError = ''">
      {{ runError }}
    </n-alert>

    <!-- 结果 -->
    <template v-if="appStore.result && appStore.result.ok">
      <n-card class="card-block" size="small">
        <template #header><span style="font-size: 14px">统计结果</span></template>
        <template #header-extra>
          <n-space size="small" align="center">
            <n-tag size="small" :type="appStore.result.source === 'import' ? 'info' : 'success'">
              {{ appStore.result.source === 'import' ? '导入数据' : (engineName(appStore.result.engine) + ' 实测') }}
            </n-tag>
            <n-text depth="3" style="font-size: 12px">
              耗时 {{ fmt2(appStore.result.durationMs / 1000) }}s · {{ fmtTime(appStore.result.generatedAt) }}
            </n-text>
          </n-space>
        </template>

        <summary-cards :summary="appStore.result.summary" :engine="appStore.result.engine" />

        <n-collapse class="meta-collapse">
          <n-collapse-item title="运行详情（命令 / 目录 / 警告）" name="meta">
            <n-descriptions bordered :column="1" size="small" label-placement="left">
              <n-descriptions-item label="统计目录">
                <div v-for="d in appStore.result.dirs" :key="d" class="mono">{{ d }}</div>
              </n-descriptions-item>
              <n-descriptions-item label="执行命令"><span class="mono">{{ appStore.result.cmd || '-' }}</span></n-descriptions-item>
              <n-descriptions-item label="引擎路径"><span class="mono">{{ appStore.result.sccPath || '-' }}（{{ engineName(appStore.result.engine) }} · {{ appStore.result.isBuiltin ? '内置' : '自定义' }} {{ appStore.result.sccVersion }}）</span></n-descriptions-item>
              <n-descriptions-item v-if="appStore.result.warnings" label="警告输出"><span class="mono">{{ appStore.result.warnings }}</span></n-descriptions-item>
            </n-descriptions>
          </n-collapse-item>
        </n-collapse>

        <!-- 目录汇总 -->
        <template v-if="appStore.result.rootDirs && appStore.result.rootDirs.length">
          <h3 class="section-title">目录汇总</h3>
          <n-data-table :columns="dirColumns" :data="appStore.result.rootDirs" size="small" striped :pagination="false" :max-height="260" />
        </template>

        <!-- 语言统计 -->
        <h3 class="section-title">语言统计</h3>
        <lang-stats-table :languages="appStore.result.languages" :total-code="appStore.result.summary.code" :max-height="340" />

        <!-- 文件明细 -->
        <template v-if="appStore.result.files && appStore.result.files.length">
          <h3 class="section-title">文件明细（{{ fmt0(appStore.result.files.length) }} 个文件）</h3>
          <n-data-table
            :columns="fileColumns"
            :data="appStore.result.files"
            size="small"
            striped
            :pagination="{ pageSize: 15, showSizePicker: true, pageSizes: [15, 30, 50, 100] }"
            :max-height="460"
          />
        </template>
        <n-alert v-else type="info" style="margin-top: 12px">
          当前结果未包含文件明细（未启用 --by-file），图表分析中的文件排行与目录对比不可用。
        </n-alert>
      </n-card>
    </template>

    <n-card v-else-if="!running && !(runError)" class="card-block" size="small">
      <n-empty description="还没有统计数据，添加目录后点击「开始统计」，或导入 SCC 导出的统计文件">
        <template #extra>
          <n-button size="small" @click="importFile">导入统计文件</n-button>
        </template>
      </n-empty>
    </n-card>
  </div>
</template>

<script setup>
import { computed, h, onMounted, reactive } from 'vue';
import {
  NCard, NButton, NSpace, NGrid, NGi, NCheckbox, NSelect, NInput, NInputGroup,
  NEmpty, NAlert, NDataTable, NTag, NText, NCollapse, NCollapseItem,
  NDescriptions, NDescriptionsItem, NRadioGroup, NRadioButton, NTooltip,
  useMessage, useDialog
} from 'naive-ui';
import SummaryCards from '@/components/SummaryCards.vue';
import LangStatsTable from '@/components/LangStatsTable.vue';
import { appStore, runStats, cancelStats, importStatsFile, saveConfig, refreshEngineStatus, engineName } from '@/store';
import { ipcApiRoute, invoke } from '@/api';
import { fmt0, fmt2, fmtBytes, fmtTime } from '@/utils/format';

const message = useMessage();
const dialog = useDialog();

const state = reactive({
  runError: ''
});
const running = computed(() => appStore.running);
const draft = appStore.draft;
const runError = computed({
  get: () => state.runError || appStore.runError,
  set: v => { state.runError = v; appStore.runError = ''; }
});

const currentEngine = computed(() => (appStore.config.engine === 'cloc' ? 'cloc' : 'scc'));

async function onEngineChange(v) {
  await saveConfig({ engine: v === 'cloc' ? 'cloc' : 'scc' });
  await refreshEngineStatus();
  message.success(`已切换为 ${engineName(v)} 引擎`);
}

const excludeDirOptions = computed(() => appStore.config.defaultExcludeDirs.map(d => ({ label: d, value: d })));

onMounted(() => {
  runError.value = appStore.runError;
});

// ---------- 目录操作 ----------
async function pickDirectory(multi) {
  const res = await invoke(ipcApiRoute.selectDirectory, { multi });
  if (res && res.ok && res.paths && res.paths.length) {
    return res.paths;
  }
  return null;
}

async function addDirSingle() {
  const paths = await pickDirectory(false);
  if (paths) addToDraft(paths);
}

async function addDirsMulti() {
  const paths = await pickDirectory(true);
  if (paths) addToDraft(paths);
}

async function replaceDir(i) {
  const paths = await pickDirectory(false);
  if (paths) {
    draft.dirs.splice(i, 1, paths[0]);
  }
}

function addToDraft(paths) {
  for (const p of paths) {
    if (!draft.dirs.includes(p)) draft.dirs.push(p);
  }
  // 记录到常用目录
  touchCommonDirs(paths);
  message.success(`已添加 ${paths.length} 个目录`);
}

function removeDir(i) {
  draft.dirs.splice(i, 1);
}

async function touchCommonDirs(paths) {
  const map = new Map((appStore.config.commonDirs || []).map(d => [d.path, d]));
  for (const p of paths) {
    const cur = map.get(p);
    if (cur) {
      cur.lastUsedAt = new Date().toISOString();
    } else {
      map.set(p, {
        path: p,
        label: p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p,
        note: '',
        lastUsedAt: new Date().toISOString()
      });
    }
  }
  await saveConfig({ commonDirs: [...map.values()] });
}

async function saveAsCommonDir() {
  await touchCommonDirs(draft.dirs);
  message.success('已保存为常用目录，可在「目录管理」中查看');
}

// ---------- 统计 ----------
async function startStats() {
  if (!draft.dirs.length) {
    message.warning('请先添加统计目录');
    return;
  }
  const res = await runStats();
  if (res && res.ok) {
    message.success(`统计完成：${fmt0(res.summary.count)} 个文件，${fmt0(res.summary.code)} 行代码`);
  }
}

async function doCancel() {
  await cancelStats();
  message.info('已发送取消请求');
}

// ---------- 导入 ----------
function importFile() {
  dialog.info({
    title: '导入 SCC 统计文件',
    content: '支持 SCC 命令行导出的 JSON（--format json）与 CSV（--format csv）文件，以及本应用导出的 JSON 报告。',
    positiveText: '选择文件',
    onPositiveClick: async () => {
      const res = await invoke(ipcApiRoute.selectFile, {
        title: '选择 SCC 统计文件',
        filters: [
          { name: 'SCC 统计文件', extensions: ['json', 'csv'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });
      if (res && res.ok && res.path) {
        const r = await importStatsFile(res.path);
        if (r && r.ok) {
          message.success(`导入成功：${fmt0(r.summary.count)} 个文件，${fmt0(r.summary.code)} 行代码`);
        }
      }
    }
  });
}

// ---------- 表格列 ----------
const dirColumns = [
  { title: '目录', key: 'path', ellipsis: { tooltip: true }, render: r => h('span', { class: 'mono' }, r.path) },
  { title: '文件数', key: 'count', align: 'right', width: 90, render: r => fmt0(r.summary.count) },
  { title: '代码行', key: 'code', align: 'right', sorter: (a, b) => a.summary.code - b.summary.code, render: r => fmt0(r.summary.code) },
  { title: '注释行', key: 'comment', align: 'right', render: r => fmt0(r.summary.comment) },
  { title: '空白行', key: 'blank', align: 'right', render: r => fmt0(r.summary.blank) },
  { title: '总行数', key: 'lines', align: 'right', render: r => fmt0(r.summary.lines) },
  { title: '圈复杂度', key: 'complexity', align: 'right', render: r => fmt0(r.summary.complexity) },
  { title: '大小', key: 'bytes', align: 'right', render: r => fmtBytes(r.summary.bytes) }
];

const fileColumns = [
  { title: '文件名', key: 'filename', sorter: (a, b) => a.filename.localeCompare(b.filename), ellipsis: { tooltip: true } },
  { title: '扩展名', key: 'extension', width: 90, sorter: (a, b) => a.extension.localeCompare(b.extension) },
  { title: '语言', key: 'language', width: 110, sorter: (a, b) => a.language.localeCompare(b.language) },
  { title: '代码行', key: 'code', align: 'right', width: 90, sorter: (a, b) => a.code - b.code, defaultSortOrder: 'descend', render: r => fmt0(r.code) },
  { title: '注释行', key: 'comment', align: 'right', width: 90, sorter: (a, b) => a.comment - b.comment, render: r => fmt0(r.comment) },
  { title: '空白行', key: 'blank', align: 'right', width: 90, render: r => fmt0(r.blank) },
  { title: '总行数', key: 'lines', align: 'right', width: 90, sorter: (a, b) => a.lines - b.lines, render: r => fmt0(r.lines) },
  { title: '圈复杂度', key: 'complexity', align: 'right', width: 95, sorter: (a, b) => a.complexity - b.complexity, render: r => fmt0(r.complexity) },
  { title: '大小', key: 'bytes', align: 'right', width: 90, render: r => fmtBytes(r.bytes) },
  { title: '路径', key: 'location', ellipsis: { tooltip: true }, render: r => h('span', { class: 'mono' }, r.location) }
];
</script>

<style scoped>
.dir-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dir-row .mono {
  color: #374151;
}

.field-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.meta-collapse {
  margin-top: 12px;
}

.section-title {
  font-size: 13px;
  color: #374151;
  margin: 18px 0 8px;
  padding-left: 8px;
  border-left: 3px solid #2563eb;
}
</style>
