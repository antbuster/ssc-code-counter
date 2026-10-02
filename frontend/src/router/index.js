import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/stats' },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/stats/Index.vue'),
    meta: { title: '代码统计' }
  },
  {
    path: '/dirs',
    name: 'dirs',
    component: () => import('@/views/dirs/Index.vue'),
    meta: { title: '目录管理' }
  },
  {
    path: '/analysis',
    name: 'analysis',
    component: () => import('@/views/analysis/Index.vue'),
    meta: { title: '统计分析' }
  },
  {
    path: '/estimate',
    name: 'estimate',
    component: () => import('@/views/estimate/Index.vue'),
    meta: { title: '生产力估算' }
  },
  {
    path: '/export',
    name: 'export',
    component: () => import('@/views/export/Index.vue'),
    meta: { title: '数据导出' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/settings/Index.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/about/Index.vue'),
    meta: { title: '关于' }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
