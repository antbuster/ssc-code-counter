<template>
  <n-data-table
    :columns="columns"
    :data="rows"
    :max-height="maxHeight"
    :pagination="false"
    size="small"
    striped
  />
</template>

<script setup>
import { computed, h } from 'vue';
import { NDataTable } from 'naive-ui';
import { fmt0, fmt2 } from '@/utils/format';

const props = defineProps({
  languages: { type: Array, default: () => [] },
  totalCode: { type: Number, default: 0 },
  maxHeight: { type: Number, default: 360 }
});

const total = computed(() => (props.totalCode > 0
  ? props.totalCode
  : (props.languages || []).reduce((a, l) => a + (l.code || 0), 0)));

const palette = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];

const columns = computed(() => {
  const maxCode = Math.max(1, ...(props.languages || []).map(l => l.code || 0));
  return [
    {
      title: '#', key: 'idx', width: 52, render: (_, i) => i + 1
    },
    {
      title: '语言',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (row, i) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, [
        h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: palette[i % palette.length], flexShrink: 0 } }),
        row.name
      ])
    },
    { title: '文件数', key: 'count', align: 'right', sorter: (a, b) => a.count - b.count, render: r => fmt0(r.count) },
    { title: '代码行', key: 'code', align: 'right', sorter: (a, b) => a.code - b.code, defaultSortOrder: 'descend', render: r => fmt0(r.code) },
    { title: '注释行', key: 'comment', align: 'right', sorter: (a, b) => a.comment - b.comment, render: r => fmt0(r.comment) },
    { title: '空白行', key: 'blank', align: 'right', sorter: (a, b) => a.blank - b.blank, render: r => fmt0(r.blank) },
    { title: '总行数', key: 'lines', align: 'right', sorter: (a, b) => a.lines - b.lines, render: r => fmt0(r.lines) },
    { title: '圈复杂度', key: 'complexity', align: 'right', sorter: (a, b) => a.complexity - b.complexity, render: r => fmt0(r.complexity) },
    {
      title: '代码占比',
      key: 'pct',
      align: 'right',
      sorter: (a, b) => a.code / total.value - b.code / total.value,
      render: r => fmt2((r.code || 0) * 100 / total.value) + '%'
    },
    {
      title: '分布',
      key: 'bar',
      width: 200,
      render: (row, i) => h('div', {
        style: {
          height: '10px', borderRadius: '5px', minWidth: '2px',
          width: `${((row.code || 0) * 100 / maxCode).toFixed(1)}%`,
          background: palette[i % palette.length],
          transition: 'width .3s'
        }
      })
    }
  ];
});

const rows = computed(() => props.languages || []);
</script>
