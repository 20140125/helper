<template>
  <t-config-provider :global-config="tdesignLocale">
    <t-layout class="app-layout">
    <!-- 全局水印 -->
      <watermark v-if="watermarkText" :text="watermarkText" :font-size="36" />

      <!-- 侧边栏 -->
      <app-sidebar
        :is-mobile="isMobile"
        :t="t"
        :sidebar-open="sidebarOpen"
        :collapsed="collapsed"
        :menu-items="menuItems"
        :menu-groups="menuGroups"
        :active-route="activeRoute"
        :web-restarting="statusStore.webRestarting"
        :is-forbidden="isForbidden"
        @close="closeSidebar"
        @toggle-collapsed="toggleCollapsed"
        @menu-change="handleMenuChange"
      />

      <!-- 主内容区 -->
      <t-layout class="main-layout">
        <!-- 顶部栏 -->
        <app-topbar
          :t="t"
          :is-mobile="isMobile"
          :current-page-title="currentPageTitle"
          :current-page-group="currentPageGroup"
          :accent-primary="themeStore.customColor.accentPrimary"
          :is-current-theme-light="isCurrentThemeLight"
          :current-style-id="themeStore.currentStyle"
          :current-theme-label="themeStore.currentThemeLabel"
          :current-theme-preview="themeStore.currentThemePreview"
          :is-auto-theme="themeStore.autoMode"
          :light-time="themeStore.autoTimes.lightTime"
          :dark-time="themeStore.autoTimes.darkTime"
          @open-sidebar="openSidebar"
          @color-input="handleColorInput"
          @color-mode-toggle="handleColorModeToggle"
          @auto-toggle="handleAutoModeToggle"
          @auto-time-change="handleAutoTimeChange"
          @theme-change="handleThemeChange"
          @logout="authStore.logout"
          @lang-toggle="localeStore.toggle"
        />

        <!-- Tab 标签栏 -->
        <tab-bar
          :tabs="displayTabs"
          :active-tab="tabBarStore.activeTab"
          @navigate="handleTabNavigate"
          @close="handleTabClose"
          @reorder="handleTabReorder"
        />

        <!-- 页面内容 -->
        <t-content class="page-content">
          <router-view :key="authStore.routerViewKey" />
        </t-content>

        <!--
          全局浮窗按钮：放在 .page-content 之外，避免被全局 `.page-content > *`
          规则强加 `position: relative; z-index: 1`（会让 router-view 出来的页面
          根容器创建 stacking context，进而让卡片内按钮 hover/active 的 z-index
          "看起来"高于浮窗 1500）。这里作为 .main-layout 的直接子兄弟，
          z-index: 1500 在 .main-layout 内独立比较，不受页面层叠堆栈干扰。
          所有浮窗按钮内部通过 querySelector('.page-content') 自定位滚动容器，
          位置不变。
        -->
        <!-- 回到顶部按钮（监听 .page-content 滚动） -->
        <back-to-top :t="t" />
        <!-- 页内锚点导航（由 page-anchor 内部 collectAnchors 检测） -->
        <page-anchor :t="t" />
        <!-- AI 助手悬浮按钮 + 抽屉（鉴权后才渲染） -->
        <ai-chat-launcher />
      </t-layout>
    </t-layout>

    <!-- 登录弹框（全局鉴权，未登录时覆盖整个页面） -->
    <login-dialog
      v-model:email="loginEmail"
      v-model:code="loginCode"
      :t="t"
      :visible="loginVisible"
      :send-loading="loginSendLoading"
      :verify-loading="loginVerifyLoading"
      :send-success="loginSendSuccess"
      :send-disabled="loginSendDisabled"
      :send-btn-text="loginSendBtnText"
      :rules="loginFormRules"
      :register-form-ref="loginRegisterFormRef"
      @send-code="loginHandleSendCode"
      @verify="loginHandleVerify"
    />
  </t-config-provider>
</template>

<script setup lang="ts">
import { useHomeModel } from '@/models/home-model';
import { useLoginModel } from '@/models/login-model';
import Watermark from '@/components/layout/watermark.vue';
import AppSidebar from '@/components/layout/app-sidebar.vue';
import AppTopbar from '@/components/layout/app-topbar.vue';
import LoginDialog from '@/components/layout/login-dialog.vue';
import TabBar from '@/components/layout/tab-bar.vue';
import BackToTop from '@/components/common/back-to-top.vue';
import PageAnchor from '@/components/common/page-anchor.vue';
import AiChatLauncher from '@/components/ai-chat/ai-chat-launcher.vue';

const {
  t,
  localeStore,
  collapsed,
  isMobile,
  sidebarOpen,
  menuItems,
  menuGroups,
  activeRoute,
  isForbidden,
  currentPageTitle,
  currentPageGroup,
  watermarkText,
  statusStore,
  themeStore,
  isCurrentThemeLight,
  tdesignLocale,
  authStore,
  tabBarStore,
  displayTabs,
  toggleCollapsed,
  openSidebar,
  closeSidebar,
  handleMenuChange,
  handleColorInput,
  handleColorModeToggle,
  handleAutoModeToggle,
  handleAutoTimeChange,
  handleThemeChange,
  handleTabNavigate,
  handleTabClose,
  handleTabReorder,
} = useHomeModel();

const {
  visible: loginVisible,
  email: loginEmail,
  code: loginCode,
  sendLoading: loginSendLoading,
  verifyLoading: loginVerifyLoading,
  sendSuccess: loginSendSuccess,
  sendDisabled: loginSendDisabled,
  sendBtnText: loginSendBtnText,
  formRules: loginFormRules,
  registerFormRef: loginRegisterFormRef,
  handleSendCode: loginHandleSendCode,
  handleVerify: loginHandleVerify,
} = useLoginModel();
</script>

<style scoped>
/* 布局骨架 */
</style>
