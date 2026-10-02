<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides" style="height: 100%">
    <n-message-provider>
      <n-dialog-provider>
        <n-layout has-sider class="root-layout">
          <n-layout-sider
            bordered
            collapse-mode="width"
            :width="216"
            :collapsed-width="64"
            :collapsed="collapsed"
            show-trigger
            @collapse="collapsed = true"
            @expand="collapsed = false"
          >
            <div class="brand" :class="{ collapsed }">
              <img :src="brandLogo" alt="logo" class="brand-logo" />
              <div v-if="!collapsed" class="brand-text">
                <div class="brand-name">SCC 代码统计</div>
                <div class="brand-sub">Succinct Code Counter</div>
              </div>
            </div>
            <n-menu
              :value="activeKey"
              :options="menuOptions"
              :collapsed="collapsed"
              :collapsed-width="64"
              :collapsed-icon-size="20"
              :indent="20"
              @update:value="onMenuSelect"
            />
            <div v-if="!collapsed" class="sider-footer">
              <div>v{{ appStore.appInfo.appVersion }}</div>
              <div>Electron {{ appStore.appInfo.electron }}</div>
            </div>
          </n-layout-sider>

          <n-layout class="main-layout">
            <header class="topbar">
              <div class="topbar-title">{{ route.meta.title || '' }}</div>
              <div class="topbar-right">
                <n-tag v-if="!appStore.isEE" type="warning" size="small" round>浏览器演示模式</n-tag>
                <n-tag v-if="appStore.isEE" :type="engineTagType" size="small" round :title="appStore.engineStatus.path">
                  {{ engineLabel }}
                </n-tag>
              </div>
            </header>
            <n-layout-content class="main-content" content-style="height: 100%;">
              <n-alert v-if="appStore.bootError" type="error" style="margin: 16px" closable>
                初始化异常：{{ appStore.bootError }}
              </n-alert>
              <router-view v-if="appStore.ready" />
              <div v-else class="boot-loading">
                <n-spin size="large" />
              </div>
            </n-layout-content>
          </n-layout>
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NConfigProvider, NDialogProvider, NLayout, NLayoutSider, NLayoutContent,
  NMenu, NMessageProvider, NTag, NSpin, zhCN, dateZhCN
} from 'naive-ui';
import AppIcon from '@/components/AppIcon.vue';
import { appStore, initStore, engineName } from '@/store';
// 经打包器引入（相对路径），保证 file:// 协议下（打包后）也能加载
import brandLogo from '@/assets/logo-32.png';

const route = useRoute();
const router = useRouter();
const collapsed = ref(false);

onMounted(async () => {
  await initStore();
  // 启动完成日志（汇入主进程日志，便于冒烟验证）
  console.log(`[frontend] mounted isEE=${appStore.isEE} version=${appStore.appInfo.appVersion} engine=${appStore.engineStatus.engine} engineOk=${appStore.engineStatus.ok} engineVersion=${appStore.engineStatus.version}`);
});

const themeOverrides = {
  common: {
    primaryColor: '#2563eb',
    primaryColorHover: '#3b82f6',
    primaryColorPressed: '#1d4ed8',
    primaryColorSuppl: '#3b82f6',
    borderRadius: '6px'
  }
};

const menuItems = [
  { key: 'stats', label: '代码统计', icon: 'stats' },
  { key: 'dirs', label: '目录管理', icon: 'dirs' },
  { key: 'analysis', label: '统计分析', icon: 'analysis' },
  { key: 'estimate', label: '生产力估算', icon: 'estimate' },
  { key: 'export', label: '数据导出', icon: 'export' },
  { key: 'settings', label: '设置', icon: 'settings' },
  { key: 'about', label: '关于', icon: 'about' }
];

const menuOptions = menuItems.map(m => ({
  key: m.key,
  label: m.label,
  icon: () => h(AppIcon, { name: m.icon })
}));

const activeKey = computed(() => String(route.name || 'stats'));

function onMenuSelect(key) {
  router.push({ name: key });
}

const engineTagType = computed(() => (appStore.engineStatus.ok ? 'success' : 'error'));

const engineLabel = computed(() => {
  const st = appStore.engineStatus;
  if (!st.ok) return `${engineName(st.engine)} 未就绪`;
  return `${engineName(st.engine)} ${st.version} · ${st.isBuiltin ? '内置' : '自定义'}`;
});
</script>

<style scoped>
.root-layout {
  height: 100%;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
  white-space: nowrap;
}

.brand-sub {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}

.sider-footer {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  color: #b0b7c3;
  line-height: 1.6;
}

.main-layout {
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #eceef2;
  background: #fff;
}

.topbar-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-content {
  background: #f4f6fa;
}

:deep(.n-layout-content) {
  overflow: auto;
}

.boot-loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
