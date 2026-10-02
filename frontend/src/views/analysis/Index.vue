<template>
  <div class="page">
    <h1 class="page-title">统计分析</h1>
    <p class="page-desc">基于最近一次统计结果的多维度图表分析。</p>

    <template v-if="hasResult">
      <n-card size="small" class="card-block">
        <n-space size="small" align="center">
          <n-tag size="small" type="primary">{{ resultDirsLabel }}</n-tag>
          <n-tag size="small" :type="isCloc ? 'default' : 'success'">{{ engineName(appStore.result.engine) }} 引擎</n-tag>
          <n-text depth="3" style="font-size: 12px">
            代码 {{ fmt0(summary.code) }} 行 · 文件 {{ fmt0(summary.count) }} 个 · {{ fmtTime(appStore.result.generatedAt) }}
          </n-text>
          <n-button size="tiny" quaternary @click="router.push({ name: 'stats' })">重新统计</n-button>
        </n-space>
      </n-card>

      <n-card size="small" class="card-block">
        <n-tabs type="segment" v-model:value="tab" @update:value="renderActive">
          <n-tab name="langPie" tab="语言分布" />
          <n-tab name="langBar" tab="语言规模" />
          <n-tab name="compose" tab="代码构成" />
          <n-tab name="fileRank" tab="文件排行" />
          <n-tab v-if="!isCloc" name="complexity" tab="复杂度排行" />
          <n-tab name="dirCompare" tab="目录对比" />
        </n-tabs>
        <div ref="chartEl" class="chart-box"></div>
        <n-alert v-if="tab === 'fileRank' && !files.length" type="info" style="margin-top: 8px">
          当前结果未包含文件明细（--by-file 未启用），无法展示文件排行。
        </n-alert>
        <n-alert v-if="tab === 'dirCompare' && !rootDirs.length" type="info" style="margin-top: 8px">
          单目录统计无目录对比数据；添加多个目录后重新统计即可查看。
        </n-alert>
      </n-card>
    </template>

    <n-card v-else class="card-block" size="small">
      <n-empty description="暂无统计数据，请先在「代码统计」页完成统计">
        <template #extra>
          <n-button type="primary" size="small" @click="router.push({ name: 'stats' })">前往统计</n-button>
        </template>
      </n-empty>
    </n-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NTabs, NTab, NEmpty, NAlert, NTag, NText, NButton } from 'naive-ui';
import * as echarts from 'echarts';
import { appStore, hasResult, engineName } from '@/store';
import { fmt0, fmtTime, shortName } from '@/utils/format';

const router = useRouter();
const chartEl = ref(null);
const tab = ref('langPie');
let chart = null;
let resizeHandler = null;

const isCloc = computed(() => (appStore.result && appStore.result.engine) === 'cloc');

const summary = computed(() => (appStore.result && appStore.result.summary) || { code: 0, count: 0 });
const languages = computed(() => (appStore.result && appStore.result.languages) || []);
const files = computed(() => (appStore.result && appStore.result.files) || []);
const rootDirs = computed(() => (appStore.result && appStore.result.rootDirs) || []);

const resultDirsLabel = computed(() => {
  const dirs = (appStore.result && appStore.result.dirs) || [];
  if (!dirs.length) return '导入数据';
  return dirs.length === 1 ? dirs[0] : `${dirs[0]} 等 ${dirs.length} 个目录`;
});

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b', '#0ea5e9', '#d946ef'];

function baseOption() {
  return {
    color: PALETTE,
    tooltip: { trigger: 'item', confine: true },
    grid: { left: 16, right: 24, top: 40, bottom: 24, containLabel: true },
    textStyle: { fontFamily: 'inherit' }
  };
}

function optionLangPie() {
  const top = languages.value.slice(0, 12);
  return {
    ...baseOption(),
    tooltip: { trigger: 'item', formatter: p => `${p.name}<br/>代码行：${fmt0(p.value)}（${p.percent}%）` },
    legend: { type: 'scroll', orient: 'vertical', right: 8, top: 'middle', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['42%', '70%'],
      center: ['40%', '52%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, formatter: '{b}\n{d}%' } },
      data: top.map(l => ({ name: l.name, value: l.code }))
    }]
  };
}

function optionLangBar() {
  const list = [...languages.value].sort((a, b) => a.code - b.code).slice(-15);
  return {
    ...baseOption(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => fmt0(v) },
    xAxis: { type: 'value', axisLabel: { formatter: v => fmt0(v) } },
    yAxis: { type: 'category', data: list.map(l => l.name), axisLabel: { fontSize: 12 } },
    series: [
      { name: '代码行', type: 'bar', data: list.map(l => l.code), barMaxWidth: 18, itemStyle: { borderRadius: [0, 4, 4, 0] } },
      { name: '注释行', type: 'bar', data: list.map(l => l.comment), barMaxWidth: 18, itemStyle: { borderRadius: [0, 4, 4, 0] } }
    ],
    legend: { top: 6 }
  };
}

function optionCompose() {
  const list = languages.value.slice(0, 10);
  return {
    ...baseOption(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => fmt0(v) },
    xAxis: {
      type: 'category',
      data: list.map(l => l.name),
      axisLabel: { fontSize: 11, rotate: 30, interval: 0 }
    },
    yAxis: { type: 'value', axisLabel: { formatter: v => fmt0(v) } },
    series: [
      { name: '代码', type: 'bar', stack: 'total', data: list.map(l => l.code), barMaxWidth: 34, itemStyle: { color: '#2563eb' } },
      { name: '注释', type: 'bar', stack: 'total', data: list.map(l => l.comment), itemStyle: { color: '#10b981' } },
      { name: '空白', type: 'bar', stack: 'total', data: list.map(l => l.blank), itemStyle: { color: '#cbd5e1', borderRadius: [4, 4, 0, 0] } }
    ],
    legend: { top: 6 }
  };
}

function optionFileRank() {
  const list = files.value.slice(0, 20).map(f => ({
    name: shortName(f.location, 46),
    value: f.code,
    full: f.location
  })).sort((a, b) => a.value - b.value);
  return {
    ...baseOption(),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const p = params[0];
        return `${p.data.full || p.name}<br/>代码行：${fmt0(p.value)}`;
      }
    },
    grid: { left: 16, right: 40, top: 24, bottom: 16, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: v => fmt0(v) } },
    yAxis: { type: 'category', data: list.map(d => d.name.split('/').pop() + '  '), axisLabel: { fontSize: 11, width: 200, overflow: 'truncate' } },
    series: [{
      type: 'bar',
      data: list.map(d => d.value),
      barMaxWidth: 14,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: '#2563eb' },
      label: { show: true, position: 'right', formatter: p => fmt0(p.value), fontSize: 10, color: '#6b7280' }
    }]
  };
}

function optionComplexity() {
  const list = files.value.slice()
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 15)
    .map(f => ({ name: shortName(f.location, 46), value: f.complexity, full: f.location }))
    .sort((a, b) => a.value - b.value);
  return {
    ...baseOption(),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => `${params[0].data.full || params[0].name}<br/>圈复杂度：${fmt0(params[0].value)}`
    },
    grid: { left: 16, right: 40, top: 24, bottom: 16, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: list.map(d => d.name.split('/').pop() + '  '), axisLabel: { fontSize: 11, width: 200, overflow: 'truncate' } },
    series: [{
      type: 'bar',
      data: list.map(d => d.value),
      barMaxWidth: 14,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: '#f59e0b' },
      label: { show: true, position: 'right', formatter: p => fmt0(p.value), fontSize: 10, color: '#6b7280' }
    }]
  };
}

function optionDirCompare() {
  const dirs = rootDirs.value;
  const metrics = [
    { name: '代码行', key: 'code', color: '#2563eb' },
    { name: '注释行', key: 'comment', color: '#10b981' },
    { name: '空白行', key: 'blank', color: '#cbd5e1' }
  ];
  return {
    ...baseOption(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => fmt0(v) },
    legend: { top: 6 },
    xAxis: {
      type: 'category',
      data: dirs.map(d => d.label),
      axisLabel: { fontSize: 11, interval: 0, formatter: v => (v.length > 16 ? v.slice(0, 16) + '…' : v) }
    },
    yAxis: { type: 'value', axisLabel: { formatter: v => fmt0(v) } },
    series: metrics.map(m => ({
      name: m.name,
      type: 'bar',
      data: dirs.map(d => d.summary[m.key]),
      barMaxWidth: 22,
      itemStyle: { color: m.color, borderRadius: [4, 4, 0, 0] }
    }))
  };
}

function renderActive() {
  // cloc 结果无复杂度数据，回退到语言分布
  if (tab.value === 'complexity' && isCloc.value) {
    tab.value = 'langPie';
  }
  nextTick(() => {
    if (!chartEl.value) return;
    if (!chart) {
      chart = echarts.init(chartEl.value);
      resizeHandler = () => chart && chart.resize();
      window.addEventListener('resize', resizeHandler);
    }
    const opts = {
      langPie: optionLangPie,
      langBar: optionLangBar,
      compose: optionCompose,
      fileRank: optionFileRank,
      complexity: optionComplexity,
      dirCompare: optionDirCompare
    };
    chart.clear();
    chart.setOption(opts[tab.value]());
  });
}

onMounted(() => {
  if (hasResult.value) renderActive();
});

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  if (chart) { chart.dispose(); chart = null; }
});

// 结果变化时（重新统计）重绘
watch(hasResult, v => { if (v) renderActive(); });
</script>

<style scoped>
.chart-box {
  width: 100%;
  height: 460px;
  margin-top: 8px;
}
</style>
