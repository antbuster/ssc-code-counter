<!--
  @file 关于页面
  @description 显示应用信息、技术栈、功能特性和开源协议
-->
<template>
  <div class="about-page">
    <n-space vertical :size="20">
      <!-- 应用信息卡片 -->
      <n-card title="应用信息" size="small">
        <n-space vertical :size="16">
          <!-- Logo 和应用名称 -->
          <div class="logo-section">
            <n-avatar :size="120" :src="logo" :round="false" />
            <h1 class="app-title">SCC 代码统计</h1>
            <p class="app-subtitle">Succinct Code Counter · 跨平台代码统计桌面应用</p>
          </div>

          <!-- 应用基本信息描述 -->
          <n-descriptions :column="2" bordered size="small">
            <n-descriptions-item label="应用名称">SCC 代码统计</n-descriptions-item>
            <n-descriptions-item label="版本">v{{ appStore.appInfo.appVersion }}</n-descriptions-item>
            <n-descriptions-item label="描述">集多目录统计、图表分析、生产力评估与报告导出于一体的代码统计工具</n-descriptions-item>
            <n-descriptions-item label="运行平台">{{ platformLabel }}（{{ appStore.appInfo.arch }}）</n-descriptions-item>
            <n-descriptions-item label="桌面框架">electron-egg（ee-core）{{ appStore.appInfo.electron && appStore.appInfo.electron !== '-' ? ` · Electron ${appStore.appInfo.electron}` : '' }}</n-descriptions-item>
            <n-descriptions-item label="数据安全">所有统计与配置仅保存在本机，不上传任何远程服务器</n-descriptions-item>
          </n-descriptions>
        </n-space>
      </n-card>

      <!-- 技术栈卡片 -->
      <n-card title="技术栈" size="small">
        <n-space vertical :size="12">
          <n-grid :cols="4" :x-gap="12" :y-gap="12">
            <n-gi v-for="t in techStack" :key="t.name">
              <n-card size="small" class="tech-card">
                <n-space vertical align="center" :size="6">
                  <n-icon :size="32" :color="t.color">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path fill="currentColor" :d="t.svg" /></svg>
                  </n-icon>
                  <span class="tech-name">{{ t.name }}</span>
                  <span class="tech-desc">{{ t.desc }}</span>
                </n-space>
              </n-card>
            </n-gi>
          </n-grid>

          <!-- 统计引擎说明 -->
          <n-alert type="info" :bordered="false">
            统计引擎：SCC (Succinct Code Counter) v{{ engineVersions.scc }} · CLOC (Count Lines of Code) v{{ engineVersions.cloc }}，双引擎一键切换，结果统一归一化。
          </n-alert>
        </n-space>
      </n-card>

      <!-- 功能特性卡片 -->
      <n-card title="功能特性" size="small">
        <n-ul>
          <n-li>SCC / CLOC 双统计引擎一键切换，多目录批量统计</n-li>
          <n-li>目录与扩展名灵活过滤，常用目录与默认规则持久化</n-li>
          <n-li>ECharts 可视化：语言分布、代码构成、文件排行、复杂度、多目录对比</n-li>
          <n-li>生产力估算：工时 / 工期 / 测试用例 / 缺陷 / 成本参数化计算，支持手工调整</n-li>
          <n-li>统计报告导出 Excel / HTML / JSON，支持导入 SCC 导出的统计文件</n-li>
          <n-li>跨平台支持 Windows、macOS、Linux，数据全程本地处理</n-li>
        </n-ul>
      </n-card>

      <!-- 开源协议卡片 -->
      <n-card title="开源协议" size="small">
        <n-space vertical :size="12">
          <n-descriptions :column="1" bordered size="small">
            <n-descriptions-item label="本应用">Apache License 2.0</n-descriptions-item>
            <n-descriptions-item label="SCC 引擎">MIT License（Copyright (c) 2021 Ben Boyter）</n-descriptions-item>
            <n-descriptions-item label="CLOC 引擎">GNU General Public License v2.0（随应用分发内置可执行文件）</n-descriptions-item>
          </n-descriptions>
          <n-p>
            本项目基于 Apache License 2.0 协议开源；内置的 SCC 与 CLOC 分别遵循其原始许可证，随应用分发的许可证副本见安装目录内相应组件。
          </n-p>
        </n-space>
      </n-card>

      <!-- 相关链接卡片 -->
      <n-card title="相关链接" size="small">
        <n-space vertical :size="12">
          <n-p>
            如果这个项目对你有帮助，欢迎反馈问题与改进建议！
          </n-p>
          <n-descriptions :column="1" bordered size="small">
            <n-descriptions-item label="SCC 引擎">
              <n-a href="https://github.com/boyter/scc" target="_blank" rel="noopener">github.com/boyter/scc</n-a>
            </n-descriptions-item>
            <n-descriptions-item label="CLOC 引擎">
              <n-a href="https://github.com/AlDanial/cloc" target="_blank" rel="noopener">github.com/AlDanial/cloc</n-a>
            </n-descriptions-item>
            <n-descriptions-item label="桌面框架">
              <n-a href="https://github.com/dromara/electron-egg" target="_blank" rel="noopener">github.com/dromara/electron-egg</n-a>
            </n-descriptions-item>
            <n-descriptions-item label="前端组件">
              <n-a href="https://www.naiveui.com" target="_blank" rel="noopener">naiveui.com</n-a>
              ·
              <n-a href="https://echarts.apache.org" target="_blank" rel="noopener">echarts.apache.org</n-a>
            </n-descriptions-item>
          </n-descriptions>
        </n-space>
      </n-card>
      <!-- 支持作者卡片 -->
      <n-card title="支持作者" size="small">
        <n-space vertical :size="12" align="center">
          <n-p>
            如果这个项目对你有帮助，欢迎点赞打赏支持作者继续开发！
          </n-p>
          <n-p>
            <n-a href="https://github.com/antbuster/ssc-code-counter" target="_blank" rel="noopener">https://github.com/antbuster/ssc-code-counter</n-a>
          </n-p>
          <div class="qr-section">
            <n-image
              width="200"
              :src="wechatReward"
              alt="微信打赏二维码"
              :fallback-src="logo"
            />
            <p class="qr-label">微信扫一扫 · 点赞打赏</p>
          </div>
        </n-space>
      </n-card>
    </n-space>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  NCard, NAvatar, NDescriptions, NDescriptionsItem, NGrid, NGi, NIcon,
  NAlert, NUl, NLi, NP, NA, NSpace, NImage
} from 'naive-ui';
import { appStore } from '@/store';
import wechatReward from '@/assets/wechat-reward.png';
// 经打包器引入（相对路径），保证 file:// 协议下（打包后）也能加载
import logo from '@/assets/logo.png';

const platformLabel = computed(() => {
  const p = appStore.appInfo.platform;
  const map = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
  return map[p] || (p === '-' ? 'Windows / macOS / Linux' : p);
});

/** 双引擎版本取自当前生效状态（应用启动时校验） */
const engineVersions = computed(() => ({
  scc: '4.1.0',
  cloc: '2.10'
}));

/** 技术栈展示（六边形徽标 + 品牌色，结构参照 code-stat 关于页） */
const HEX = 'M115.7 21.6c-4.9-8.5-14-13.6-23.7-13.6H36c-9.7 0-18.8 5.1-23.7 13.6L.2 76.8c-4.9 8.5-4.9 18.9 0 27.4l12.1 21c4.9 8.5 14 13.6 23.7 13.6h56c9.7 0 18.8-5.1 23.7-13.6l12.1-21c4.9-8.5 4.9-18.9 0-27.4L115.7 21.6zM64 96c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z';
const techStack = [
  { name: 'Vue 3', desc: '组合式 API 前端框架', color: '#42b883', svg: HEX },
  { name: 'Naive UI', desc: 'Vue 3 组件库', color: '#18a058', svg: HEX },
  { name: 'ECharts', desc: '数据可视化图表', color: '#e343e6', svg: HEX },
  { name: 'Electron', desc: '跨平台桌面框架', color: '#47848f', svg: HEX },
  { name: 'ee-core', desc: 'electron-egg 桌面开发框架', color: '#2563eb', svg: HEX },
  { name: 'Vite', desc: '前端构建工具', color: '#bd34fe', svg: HEX },
  { name: 'SCC', desc: '高性能代码统计引擎', color: '#f59e0b', svg: HEX },
  { name: 'CLOC', desc: '老牌代码统计引擎', color: '#64748b', svg: HEX }
];
</script>

<style scoped>
.about-page {
  max-width: 860px;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.logo-section :deep(.n-avatar) {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}

.app-title {
  font-size: 32px;
  font-weight: bold;
  margin: 16px 0 8px;
  color: #1f2937;
}

.app-subtitle {
  font-size: 15px;
  color: #6b7280;
  margin: 0;
}

.tech-card {
  text-align: center;
}

.tech-card :deep(.n-card__content) {
  padding: 14px 8px;
}

.tech-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.tech-desc {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.4;
}

.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background-color: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 8px;
}

.qr-label {
  margin-top: 12px;
  font-size: 14px;
  color: #6b7280;
}
</style>
