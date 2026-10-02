<template>
  <div class="page">
    <h1 class="page-title">生产力估算</h1>
    <p class="page-desc">基于代码行数与经验参数估算工时、工期、测试用例、缺陷与人力成本；所有参数可手工调整，结果保留 2 位小数。</p>

    <!-- 数据来源 -->
    <n-card size="small" class="card-block">
      <template #header><span style="font-size: 14px">数据来源</span></template>
      <n-space align="center" size="large">
        <n-form-item label="有效代码行数" label-placement="left" :show-feedback="false" style="margin: 0">
          <n-input-number
            v-model:value="codeLinesInput"
            :min="0"
            :max="100000000"
            :step="1000"
            style="width: 220px"
          />
        </n-form-item>
        <n-button size="small" @click="useStatsLines" :disabled="!hasResult">
          使用统计结果（{{ fmt0(statsCodeLines) }} 行）
        </n-button>
        <n-text depth="3" style="font-size: 12px">
          {{ hasResult ? `来自最近统计：${statsSourceLabel}` : '暂无统计数据，可手动输入' }}
        </n-text>
      </n-space>
    </n-card>

    <!-- 参数 -->
    <n-card size="small" class="card-block">
      <template #header><span style="font-size: 14px">估算参数</span></template>
      <template #header-extra>
        <n-space size="small">
          <n-button size="small" @click="resetParams">恢复默认参数</n-button>
          <n-text depth="3" style="font-size: 12px">{{ savedTip }}</n-text>
        </n-space>
      </template>
      <estimation-params-form v-model="estParams">
        <template #actions>
          <n-text depth="3" style="font-size: 12px">
            参数调整后立即生效并自动保存；含义见下方模型说明。
          </n-text>
        </template>
      </estimation-params-form>
    </n-card>

    <!-- 估算结果 -->
    <n-card size="small" class="card-block">
      <template #header><span style="font-size: 14px">估算结果</span></template>
      <div class="est-grid">
        <div v-for="m in metricCards" :key="m.label" class="est-card">
          <div class="est-k">{{ m.label }}</div>
          <div class="est-v num">{{ m.value }}<span class="est-u">{{ m.unit }}</span></div>
        </div>
      </div>

      <n-data-table :columns="metricColumns" :data="metricRows" size="small" striped style="margin-top: 16px" :pagination="false" />

      <n-collapse style="margin-top: 12px">
        <n-collapse-item title="估算模型说明" name="model">
          <div class="model-doc">
            <p><b>编码工作量（人日）</b> = 有效代码行数 ÷ 编码生产率</p>
            <p><b>编码工时（小时）</b> = 编码工作量 × 每日工时</p>
            <p><b>总工作量（人日）</b> = 编码工作量 ÷ 设计编码占比 <span class="doc-sub">—— 设计编码占比指设计与编码工作占总工作量（含需求、设计、测试、项目管理等）的比例</span></p>
            <p><b>总工作量（人月）</b> = 总工作量 ÷ 人月折算人日</p>
            <p><b>项目工期（月）</b> = 总工作量 ÷ 团队人数 ÷ 人月折算人日</p>
            <p><b>测试用例数（个）</b> = 代码行数 ÷ 1000 × 测试用例密度</p>
            <p><b>预计缺陷数（个）</b> = 代码行数 ÷ 1000 × 缺陷密度</p>
            <p><b>预估人力成本（元）</b> = 总工作量（人月） × 人力成本单价</p>
            <p class="doc-note">模型为参数化经验估算，结果仅供项目决策参考；可在「数据导出」页随统计报告一并导出。</p>
          </div>
        </n-collapse-item>
      </n-collapse>
    </n-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  NCard, NButton, NSpace, NText, NInputNumber, NFormItem,
  NCollapse, NCollapseItem, NDataTable
} from 'naive-ui';
import EstimationParamsForm from '@/components/EstimationParamsForm.vue';
import { appStore, saveConfig, hasResult, codeLines } from '@/store';
import { computeEstimation } from '@/utils/estimate';
import { DEFAULT_ESTIMATION } from '@/api/defaults';
import { fmt0, fmt2 } from '@/utils/format';

const estParams = ref({ ...DEFAULT_ESTIMATION, ...appStore.config.estimation });
const manualCodeLines = ref(null);
const savedTip = ref('');

const statsCodeLines = computed(() => codeLines.value || 0);
const statsSourceLabel = computed(() => {
  const r = appStore.result;
  if (!r) return '';
  return r.source === 'import' ? '导入数据' : (r.dirs && r.dirs.length ? r.dirs[0] : 'SCC 统计');
});

/** 生效代码行数：手动输入优先，否则取统计结果 */
const codeLinesInput = computed({
  get: () => (manualCodeLines.value !== null ? manualCodeLines.value : statsCodeLines.value),
  set: v => { manualCodeLines.value = v; }
});

function useStatsLines() {
  manualCodeLines.value = null;
}

const estimation = computed(() => computeEstimation(estParams.value, codeLinesInput.value));

const metricCards = computed(() => {
  const m = estimation.value.metrics;
  return [
    { label: '编码工作量', value: fmt2(m.codingEffortDays), unit: '人日' },
    { label: '编码工时', value: fmt2(m.codingEffortHours), unit: '小时' },
    { label: '总工作量', value: fmt2(m.totalEffortDays), unit: '人日' },
    { label: '总工时', value: fmt2(m.totalEffortHours), unit: '小时' },
    { label: '总工作量（人月）', value: fmt2(m.totalEffortMonths), unit: '人月' },
    { label: '项目工期', value: fmt2(m.durationMonths), unit: '月' },
    { label: '测试用例数', value: fmt2(m.testCases), unit: '个' },
    { label: '预计缺陷数', value: fmt2(m.defects), unit: '个' },
    { label: '预估人力成本', value: fmt2(m.totalCost), unit: '元' }
  ];
});

const metricColumns = [
  { title: '估算项', key: 'label' },
  { title: '数值', key: 'value', align: 'right', render: r => fmt2(r.value) },
  { title: '单位', key: 'unit', width: 120 },
  { title: '计算方式', key: 'formula' }
];

const metricRows = computed(() => {
  const m = estimation.value.metrics;
  return [
    { label: '有效代码行数', value: m.codeLines, unit: '行', formula: '统计结果 / 手动输入' },
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

// 参数变化自动持久化（防抖）
let saveTimer = null;
watch(estParams, v => {
  savedTip.value = '保存中…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveConfig({ estimation: { ...v } });
    savedTip.value = '已保存';
    setTimeout(() => { savedTip.value = ''; }, 1500);
  }, 500);
}, { deep: true });

function resetParams() {
  estParams.value = { ...DEFAULT_ESTIMATION };
}

onMounted(() => {
  estParams.value = { ...DEFAULT_ESTIMATION, ...appStore.config.estimation };
});
</script>

<style scoped>
.est-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.est-card {
  background: linear-gradient(180deg, #f8faff 0%, #f1f5ff 100%);
  border: 1px solid #e3ebfa;
  border-radius: 10px;
  padding: 12px 14px;
}

.est-k {
  font-size: 12px;
  color: #6b7280;
}

.est-v {
  font-size: 21px;
  font-weight: 600;
  color: #1d4ed8;
  margin-top: 4px;
}

.est-u {
  font-size: 11px;
  color: #93a5c4;
  margin-left: 4px;
  font-weight: 400;
}

.model-doc {
  font-size: 13px;
  color: #4b5563;
  line-height: 2;
}

.doc-sub {
  color: #9ca3af;
  font-size: 12px;
}

.doc-note {
  color: #94a3b8;
  font-size: 12px;
}
</style>
