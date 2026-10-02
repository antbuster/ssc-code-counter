<template>
  <div class="summary-cards">
    <div v-for="c in cards" :key="c.label" class="s-card">
      <div class="s-k">{{ c.label }}</div>
      <div class="s-v num">{{ c.value }}<span v-if="c.unit" class="s-u">{{ c.unit }}</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { fmt0, fmt2 } from '@/utils/format';

const props = defineProps({
  summary: { type: Object, required: true },
  /** cloc 引擎不支持圈复杂度，隐藏对应卡片 */
  engine: { type: String, default: 'scc' }
});

const cards = computed(() => {
  const s = props.summary || {};
  const denom = Math.max(1, (s.code || 0) + (s.comment || 0));
  const list = [
    { label: '文件总数', value: fmt0(s.count) },
    { label: '代码行 (SLOC)', value: fmt0(s.code) },
    { label: '注释行', value: fmt0(s.comment) },
    { label: '空白行', value: fmt0(s.blank) },
    { label: '总行数', value: fmt0(s.lines) },
    { label: '圈复杂度', value: fmt0(s.complexity) },
    { label: '注释率', value: fmt2((s.comment || 0) * 100 / denom), unit: '%' }
  ];
  return props.engine === 'cloc' ? list.filter(c => c.label !== '圈复杂度') : list;
});
</script>

<style scoped>
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}

.s-card {
  background: #fff;
  border: 1px solid #eceef2;
  border-radius: 10px;
  padding: 12px 14px;
}

.s-k {
  font-size: 12px;
  color: #6b7280;
}

.s-v {
  font-size: 22px;
  font-weight: 600;
  color: #111827;
  margin-top: 4px;
}

.s-u {
  font-size: 11px;
  color: #9ca3af;
  margin-left: 4px;
  font-weight: 400;
}
</style>
