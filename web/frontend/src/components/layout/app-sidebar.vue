<template>
  <!-- 移动端遮罩层 -->
  <div
    v-if="isMobile && sidebarOpen"
    class="sidebar-overlay"
    @click="emit('close')"
  />

  <!-- 侧边栏 -->
  <t-aside
    class="sidebar"
    :class="{ 'sidebar--mobile-open': isMobile && sidebarOpen, 'sidebar--mobile-hidden': isMobile && !sidebarOpen }"
    :style="isMobile ? {} : { width: collapsed ? '64px' : '220px' }"
  >
    <div class="sidebar-inner">
      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="logo-icon">
          <t-icon name="notification" size="20px" style="color: var(--sidebar-logo-icon-color, #fff);" />
        </div>
        <transition name="fade">
          <span v-if="!isMobile ? !collapsed : true" class="logo-text">{{ t.sidebar.appName }}</span>
        </transition>
        <!-- 移动端关闭按钮 -->
        <t-button
          v-if="isMobile"
          variant="text"
          class="sidebar-close-btn app-icon-btn app-icon-btn--xs"
          :aria-label="t.common.close"
          @click="emit('close')"
        >
          <template #icon><t-icon name="close" size="16px" /></template>
        </t-button>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <template v-for="group in menuGroups" :key="group.group">
          <!-- === 折叠状态：分隔线 + tooltip 图标 === -->
          <template v-if="!isMobile && collapsed">
            <div class="nav-group-divider" />
            <template v-for="item in group.items" :key="item.value">
              <t-tooltip :content="isForbidden ? t.sidebar.forbiddenTip : item.label" placement="right">
                <!-- pointer-events wrapper：确保 forbidden 状态下 tooltip 仍可触发 -->
                <div style="pointer-events: auto;">
                  <div
                    class="nav-item collapsed"
                    :class="{ active: activeRoute === item.value, 'nav-item--disabled': webRestarting || isForbidden }"
                    @click="emit('menu-change', item.value)"
                  >
                    <div class="nav-icon">
                      <t-icon :name="item.icon" size="17px" />
                    </div>
                  </div>
                </div>
              </t-tooltip>
            </template>
          </template>

          <!-- === 展开状态：可折叠分组 === -->
          <template v-else>
            <!-- 分组标题（点击折叠/展开） -->
            <div
              class="nav-group-header"
              :class="{
                'nav-group-header--collapsed': collapsedGroups.has(group.group),
                'nav-group-header--active': activeGroup === group.group,
                'nav-group-header--disabled': isForbidden,
              }"
              @click="!isForbidden && toggleGroup(group.group)"
            >
              <t-icon :name="group.icon" size="15px" class="nav-group-icon" />
              <span class="nav-group-label">{{ group.group }}</span>
              <t-icon
                name="chevron-down"
                size="14px"
                class="nav-group-arrow"
                :class="{ 'nav-group-arrow--collapsed': collapsedGroups.has(group.group) }"
              />
            </div>

            <!-- 分组内容（带过渡动画） -->
            <div
              class="nav-group-body"
              :class="{ 'nav-group-body--collapsed': collapsedGroups.has(group.group) }"
            >
              <div
                v-for="item in group.items"
                :key="item.value"
                class="nav-item"
                :class="{ active: activeRoute === item.value, 'nav-item--disabled': webRestarting || isForbidden }"
                @click="emit('menu-change', item.value)"
              >
                <div class="nav-icon">
                  <t-icon :name="item.icon" size="17px" />
                </div>
                <span class="nav-label">{{ item.label }}</span>
                <div v-if="activeRoute === item.value" class="nav-active-bar" />
              </div>
            </div>
          </template>
        </template>
      </nav>

      <!-- 底部折叠按钮（仅桌面端显示） -->
      <div v-if="!isMobile" class="sidebar-footer">
        <t-button
          variant="text"
          class="collapse-btn app-collapse-btn"
          @click="emit('toggle-collapsed')"
        >
          <template #icon><t-icon :name="collapsed ? 'chevron-right' : 'chevron-left'" size="15px" /></template>
        </t-button>
      </div>
    </div>
  </t-aside>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import type { MenuItem, MenuGroup } from '@/types/home';
import type { Locale } from '@/types/locale';

const props = defineProps<{
  /** i18n 翻译函数 - 侧边栏部分（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 是否为移动端状态（决定是否采用抽屉式侧边栏） */
  isMobile: boolean;
  /** 移动端侧边栏是否处于展开状态 */
  sidebarOpen: boolean;
  /** 桌面端是否折叠（展示迷你导航） */
  collapsed: boolean;
  /** 菜单项扯平列表（供 activeRoute 查找当前项使用） */
  menuItems: MenuItem[];
  /** 菜单分组定义（渲染分组标题 + 子项） */
  menuGroups: MenuGroup[];
  /** 当前激活路由 name */
  activeRoute: string;
  /** Web 服务重启中（重启期间禁用菜单项点击） */
  webRestarting: boolean;
  /** 当前是否处于无权限页面，true 时所有导航项禁用且显示 tooltip 提示 */
  isForbidden: boolean;
}>();

/** 当前激活路由所属的分组名称 */
const activeGroup = computed(() => {
  for (const group of props.menuGroups) {
    if (group.items.some((item) => item.value === props.activeRoute)) {
      return group.group;
    }
  }
  return '';


});

const emit = defineEmits<{
  /** 关闭侧边栏（移动端点击遮罩 / 关闭按钮） */
  (e: 'close'): void;
  /** 切换桌面端折叠/展开状态 */
  (e: 'toggle-collapsed'): void;
  /** 选中某个菜单项，参数为菜单 value（路由 name） */
  (e: 'menu-change', value: string): void;
}>();
/** 已折叠的分组名称集合 */
const collapsedGroups = reactive(new Set<string>());

/** 切换分组展开/折叠 */
const toggleGroup = (group: string) => {
  if (collapsedGroups.has(group)) {
    collapsedGroups.delete(group);
  } else {
    collapsedGroups.add(group);
  }
};
</script>

<style scoped>
/* 移动端遮罩层 */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  z-index: 199;
}

/* 移动端侧边栏抽屉 */
.sidebar--mobile-hidden {
  position: fixed !important;
  top: 0;
  left: 0;
  height: 100vh;
  width: 240px !important;
  z-index: 200;
  transform: translateX(-100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.sidebar--mobile-open {
  position: fixed !important;
  top: 0;
  left: 0;
  height: 100vh;
  width: 240px !important;
  z-index: 200;
  transform: translateX(0);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 移动端侧边栏关闭按钮：仅保留布局差异（外观由 .app-icon-btn--xs 提供） */
.sidebar-close-btn {
  margin-left: auto;
  flex-shrink: 0;
}

/* ===== 分组标题 ===== */
.nav-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 4px 0 2px;
  cursor: pointer;
  color: var(--sidebar-text-secondary);
  opacity: 0.7;
  border-radius: 8px;
  transition: all 0.2s ease;
  user-select: none;
}

.nav-group-header:first-child {
  margin-top: 0;
}

.nav-group-header:hover {
  opacity: 1;
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.04);
}

/* 当前激活路由所在分组高亮 */
.nav-group-header--active {
  opacity: 1;
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.06);
}

.nav-group-header--active .nav-group-icon {
  color: var(--accent-primary);
  transform: scale(1.18);
}

.nav-group-header--active .nav-group-label {
  color: var(--accent-primary);
}

.nav-group-header--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.nav-group-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease;
}

.nav-group-header:hover .nav-group-icon {
  transform: scale(1.18);
  color: var(--accent-primary);
}

.nav-group-label {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-group-arrow {
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-group-arrow--collapsed {
  transform: rotate(-90deg);
}

/* ===== 分组内容折叠动画 ===== */
.nav-group-body {
  overflow: hidden;
  opacity: 1;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.25s ease;
}

.nav-group-body--collapsed {
  max-height: 0;
  opacity: 0;
}

/* ===== 折叠状态下的分组分隔线 ===== */
.nav-group-divider {
  height: 1px;
  margin: 6px 12px;
  background: var(--border-color);
  opacity: 0.4;
}

.nav-group-divider:first-child {
  display: none;
}
</style>
