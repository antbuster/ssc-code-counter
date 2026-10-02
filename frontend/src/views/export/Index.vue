<template>
  <div class="page">
    <h1 class="page-title">数据导出</h1>
    <p class="page-desc">将统计结果与生产力估算导出为 JSON / Excel / HTML 报告，所有数据仅写入本地文件。</p>

    <template v-if="hasResult">
      <!-- 导出配置 -->
      <n-card size="small" class="card-block">
        <template #header><span style="font-size: 14px">导出配置</span></template>
        <n-grid :cols="2" :x-gap="24" :y-gap="12">
          <n-gi>
            <div class="field-label">导出格式</div>
            <n-radio-group v-model:value="format">
              <n-space vertical size="medium">
                <n-radio value="excel">
                  Excel 工作簿（.xlsx）
                  <span class="radio-desc">多工作表：摘要 / 语言统计 / 目录汇总 / 文件明细 / 生产力估算</span>
                </n-radio>
                <n-radio value="html">
                  HTML 报告（.html）
                  <span class="radio-desc">自包含单文件报告，内联样式离线可开，可直接打印为 PDF</span>
                </n-radio>
                <n-radio value="json">
                  JSON 数据（.json）
                  <span class="radio-desc">完整结构化数据（含摘要与明细），可再次导入本应用</span>
                </n-radio>
              </n-space>
            </n-radio-group>
          </n-gi>
          <n-gi>
            <div class="field-label">包含内容</div>
            <n-space vertical size="medium">
              <n-checkbox v-model:checked="sections.languages">语言统计</n-checkbox>
              <n-checkbox v-model:checked="sections.dirs" :disabled="!rootDirs.length">
                目录汇总{{ rootDirs.length ? '' : '（无多目录数据）' }}
              </n-checkbox>
              <n-checkbox v-model:checked="sections.files" :disabled="!files.length">
                文件明细{{ files.length ? `（${fmt0(files.length)} 条）` : '（无文件明细数据）' }}
              </n-checkbox>
              <n-checkbox v-model:checked="sections.estimation">生产力估算</n-checkbox>
            </n-space>
          </n-gi>
        </n-grid>

        <n-space style="margin-top: 18px" align="center">
          <n-button type="primary" :loading="exporting" @click="doExport">选择位置并导出</n-button>
          <template v-if="lastExport && lastExport.ok">
            <n-tag type="success" size="small">已导出</n-tag>
            <n-button size="small" @click="openExport">打开文件</n-button>
            <n-button size="small" @click="revealExport">打开所在文件夹</n-button>
          </template>
        </n-space>
        <n-alert v-if="exportError" type="error" style="margin-top: 12px" closable @close="exportError = ''">
          {{ exportError }}
        </n-alert>
      </n-card>

      <!-- 数据预览 -->
      <n-card size="small" class="card-block">
        <template #header><span style="font-size: 14px">数据预览</span></template>
        <n-tabs type="line" animated>
          <n-tab name="p-summary" tab="摘要">
            <summary-cards :summary="appStore.result.summary" :engine="appStore.result.engine" />
            <n-descriptions bordered :column="1" size="small" label-placement="left" style="margin-top: 16px">
              <n-descriptions-item label="统计目录">
                <div v-for="d in appStore.result.dirs" :key="d" class="mono">{{ d }}</div>
              </n-descriptions-item>
              <n-descriptions-item label="数据来源">
                {{ appStore.result.source === 'import' ? '导入的统计文件' : engineName(appStore.result.engine) }}
                {{ appStore.result.sccVersion ? `（v${appStore.result.sccVersion}）` : '' }}
              </n-descriptions-item>
              <n-descriptions-item label="生成时间">{{ fmtTime(appStore.result.generatedAt) }}</n-descriptions-item>
            </n-descriptions>
          </n-tab>
          <n-tab name="p-langs" tab="语言统计">
            <lang-stats-table :languages="appStore.result.languages" :total-code="appStore.result.summary.code" :max-height="420" />
          </n-tab>
          <n-tab v-if="rootDirs.length" name="p-dirs" tab="目录汇总">
            <n-data-table :columns="dirColumns" :data="rootDirs" size="small" striped :pagination="false" :max-height="420" />
          </n-tab>
          <n-tab v-if="files.length" name="p-files" tab="文件明细">
            <n-data-table
              :columns="fileColumns"
              :data="files"
              size="small"
              striped
              :pagination="{ pageSize: 15 }"
              :max-height="420"
            />
          </n-tab>
          <n-tab v-if="sections.estimation" name="p-est" tab="生产力估算">
            <n-data-table :columns="estColumns" :data="estRows" size="small" striped :pagination="false" />
          </n-tab>
        </n-tabs>
      </n-card>
    </template>

    <n-card v-else class="card-block" size="small">
      <n-empty description="暂无统计数据，请先在「代码统计」页完成统计或导入">
        <template #extra>
          <n-button type="primary" size="small" @click="router.push({ name: 'stats' })">前往统计</n-button>
        </template>
      </n-empty>
    </n-card>
  </div>
</template>

<script setup>
import { computed, h, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NButton, NSpace, NGrid, NGi, NRadioGroup, NRadio, NCheckbox,
  NTabs, NTab, NDataTable, NEmpty, NAlert, NTag, NDescriptions, NDescriptionsItem, useMessage
} from 'naive-ui';
import SummaryCards from '@/components/SummaryCards.vue';
import LangStatsTable from '@/components/LangStatsTable.vue';
import { appStore, hasResult, engineName } from '@/store';
import { computeEstimation } from '@/utils/estimate';
import { ipcApiRoute, invoke } from '@/api';
import { fmt0, fmt2, fmtBytes, fmtTime } from '@/utils/format';

const router = useRouter();
const message = useMessage();

const format = ref('excel');
const exporting = ref(false);
const exportError = ref('');
const lastExport = ref(null);
const sections = reactive({ languages: true, dirs: true, files: true, estimation: true });

const files = computed(() => (appStore.result && appStore.result.files) || []);
const rootDirs = computed(() => (appStore.result && appStore.result.rootDirs) || []);

const formatMeta = computed(() => ({
  excel: { ext: 'xlsx', filter: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }] },
  html: { ext: 'html', filter: [{ name: 'HTML 报告', extensions: ['html'] }] },
  json: { ext: 'json', filter: [{ name: 'JSON 数据', extensions: ['json'] }] }
}[format.value]));

function defaultName() {
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return `SCC统计报告-${ts}.${formatMeta.value.ext}`;
}

async function doExport() {
  exporting.value = true;
  exportError.value = '';
  try {
    const sel = await invoke(ipcApiRoute.selectSaveFile, {
      title: '保存统计报告',
      defaultName: defaultName(),
      filters: formatMeta.value.filter
    });
    if (!sel || !sel.ok) return;
    const payload = {
      format: format.value,
      result: appStore.result,
      estimation: sections.estimation ? buildEstimationPayload() : null,
      sections
    };
    const res = await invoke(ipcApiRoute.exportSave, { filePath: sel.path, payload });
    if (res && res.ok) {
      lastExport.value = res;
      message.success(`导出成功：${res.filePath}`);
    } else {
      exportError.value = (res && res.message) || '导出失败';
    }
  } finally {
    exporting.value = false;
  }
}

function buildEstimationPayload() {
  const params = appStore.config.estimation;
  const codeLines = appStore.result && appStore.result.summary ? appStore.result.summary.code : 0;
  return computeEstimation(params, codeLines);
}

function openExport() {
  if (lastExport.value) invoke(ipcApiRoute.openPath, { path: lastExport.value.filePath });
}

function revealExport() {
  if (lastExport.value) invoke(ipcApiRoute.revealItem, { path: lastExport.value.filePath });
}

// ---------- 预览表格 ----------
const dirColumns = [
  { title: '目录', key: 'path', ellipsis: { tooltip: true }, render: r => h('span', { class: 'mono' }, r.path) },
  { title: '文件数', key: 'count', align: 'right', render: r => fmt0(r.summary.count) },
  { title: '代码行', key: 'code', align: 'right', render: r => fmt0(r.summary.code) },
  { title: '注释行', key: 'comment', align: 'right', render: r => fmt0(r.summary.comment) },
  { title: '总行数', key: 'lines', align: 'right', render: r => fmt0(r.summary.lines) },
  { title: '圈复杂度', key: 'complexity', align: 'right', render: r => fmt0(r.summary.complexity) },
  { title: '大小', key: 'bytes', align: 'right', render: r => fmtBytes(r.summary.bytes) }
];

const fileColumns = [
  { title: '文件名', key: 'filename', ellipsis: { tooltip: true } },
  { title: '扩展名', key: 'extension', width: 90 },
  { title: '语言', key: 'language', width: 110 },
  { title: '代码行', key: 'code', align: 'right', width: 90, sorter: (a, b) => a.code - b.code, defaultSortOrder: 'descend', render: r => fmt0(r.code) },
  { title: '注释行', key: 'comment', align: 'right', width: 90, render: r => fmt0(r.comment) },
  { title: '总行数', key: 'lines', align: 'right', width: 90, render: r => fmt0(r.lines) },
  { title: '圈复杂度', key: 'complexity', align: 'right', width: 95, render: r => fmt0(r.complexity) },
  { title: '路径', key: 'location', ellipsis: { tooltip: true }, render: r => h('span', { class: 'mono' }, r.location) }
];

const estColumns = [
  { title: '估算项', key: 'label' },
  { title: '数值', key: 'value', align: 'right', render: r => fmt2(r.value) },
  { title: '单位', key: 'unit', width: 110 },
  { title: '计算方式', key: 'formula' }
];

const estRows = computed(() => {
  const est = buildEstimationPayload();
  const m = est.metrics;
  return [
    { label: '有效代码行数', value: m.codeLines, unit: '行', formula: '统计结果' },
    { label: '编码工作量', value: m.codingEffortDays, unit: '人日', formula: '代码行数 ÷ 编码生产率' },
    { label: '编码工时', value: m.codingEffortHours, unit: '小时', formula: '编码工作量 × 每日工时' },
    { label: '总工作量（人日）', value: m.totalEffortDays, unit: '人日', formula: '编码工作量 ÷ 设计编码占比' },
    { label: '总工作量（人月）', value: m.totalEffortMonths, unit: '人月', formula: '总工作量 ÷ 人月折算人日' },
    { label: '项目工期', value: m.durationMonths, unit: '月', formula: '总工作量 ÷ 团队人数 ÷ 人月折算人日' },
    { label: '测试用例数', value: m.testCases, unit: '个', formula: '代码行数 ÷ 1000 × 测试用例密度' },
    { label: '预计缺陷数', value: m.defects, unit: '个', formula: '代码行数 ÷ 1000 × 缺陷密度' },
    { label: '预估人力成本', value: m.totalCost, unit: '元', formula: '总工作量（人月） × 人力成本单价' }
  ];
});
</script>

<style scoped>
.field-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.radio-desc {
  display: block;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}
</style>
