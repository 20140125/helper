<template>
  <t-header class="topbar">
    <div class="topbar-left">
      <!-- 移动端汉堡菜单按钮 -->
      <t-button
        v-if="isMobile"
        variant="text"
        class="menu-btn app-icon-btn app-icon-btn--bordered"
        @click="emit('open-sidebar')"
      >
        <template #icon><t-icon name="view-list" size="18px" /></template>
      </t-button>
      <div class="breadcrumb">
        <t-icon v-if="!isMobile" name="home" size="13px" style="color: var(--text-muted);" />
        <span v-if="!isMobile" class="breadcrumb-sep">/</span>
        <span v-if="!isMobile && currentPageGroup" class="breadcrumb-parent">{{ currentPageGroup }}</span>
        <span v-if="!isMobile && currentPageGroup" class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{{ currentPageTitle }}</span>
      </div>
    </div>
    <div class="topbar-right">
      <div
        class="status-badge"
        :class="statusStore.daemonRunning ? 'status-running' : 'status-stopped'"
      >
        <span class="status-dot" />
        <span class="status-text">{{ statusStore.daemonRunning ? t.topbar.daemonRunning : t.topbar.daemonStopped }}</span>
      </div>
      <!-- 主题选择器 -->
      <div class="theme-selector" ref="themeSelectorRef">
        <t-button
          variant="text"
          class="theme-selector-btn app-pill-btn app-pill-btn--lg"
          ref="themeBtnRef"
          :title="t.common.switchTheme"
          @click="toggleThemeMenu"
        >
          <span class="theme-preview-dot" :style="{ background: currentThemePreview }" />
          <span v-if="!isMobile" class="theme-label">{{ currentThemeLabel }}</span>
          <t-icon :name="themeMenuOpen ? 'chevron-up' : 'chevron-down'" size="12px" />
        </t-button>
      </div>

      <!-- 下拉菜单 teleport 到 body，避免被 overflow:hidden 裁剪 -->
      <teleport to="body">
        <transition name="theme-menu">
          <div
            v-if="themeMenuOpen"
            ref="themeMenuRef"
            class="theme-menu"
            :style="menuPosition"
          >
            <template v-for="style in themeStyles" :key="style.id">
              <!-- 非自定义主题：普通选项 -->
              <div
                v-if="style.id !== 'custom'"
                class="theme-menu-item"
                :class="{ active: currentStyleId === style.id }"
                @click="selectTheme(style.id)"
              >
                <span class="theme-menu-dot" :style="{ background: style.preview }" />
                <span class="theme-menu-icon">{{ style.icon }}</span>
                <span class="theme-menu-label">{{ style.label }}</span>
                <t-icon v-if="currentStyleId === style.id" name="check" size="14px" class="theme-menu-check" />
              </div>
              <!-- 自定义主题：合并颜色选择器 -->
              <label
                v-else
                class="theme-menu-item theme-menu-custom-item"
                :class="{ active: currentStyleId === 'custom' }"
                @click.self="selectTheme('custom')"
              >
                <span class="theme-menu-dot" :style="{ background: accentPrimary }" />
                <span class="theme-menu-icon">{{ style.icon }}</span>
                <span class="theme-menu-label">{{ style.label }}</span>
                <t-icon v-if="currentStyleId === 'custom'" name="check" size="14px" class="theme-menu-check" />
                <input
                  ref="colorPickerRef"
                  type="color"
                  class="color-picker-input"
                  :value="accentPrimary"
                  @change="emit('color-change', $event)"
                />
              </label>
            </template>

            <div v-if="isAutoTheme" class="theme-menu-auto">
              <div class="auto-title">{{ t.topbar.autoThemeTimeTitle }}</div>
              <label class="auto-time-row">
                <span>{{ t.topbar.lightMode }}</span>
                <input
                  type="time"
                  class="auto-time-input"
                  :value="lightTime"
                  @change="handleLightTimeChange"
                >
              </label>
              <label class="auto-time-row">
                <span>{{ t.topbar.darkMode }}</span>
                <input
                  type="time"
                  class="auto-time-input"
                  :value="darkTime"
                  @change="handleDarkTimeChange"
                >
              </label>
            </div>
          </div>
        </transition>
      </teleport>

      <!-- 亮/暗模式切换 -->
      <div class="theme-mode-toggle">
        <t-button
          variant="text"
          class="theme-mode-btn app-mode-btn"
          :class="{ 'app-mode-btn--active': isAutoTheme }"
          :title="t.topbar.autoTheme"
          :aria-label="t.topbar.autoTheme"
          @click="emit('auto-toggle', $event)"
        >
          <template #icon><t-icon name="time" size="14px" /></template>
        </t-button>
        <t-button
          variant="text"
          class="theme-mode-btn app-mode-btn"
          :class="{ 'app-mode-btn--active': isCurrentThemeLight }"
          :title="t.topbar.lightMode"
          :aria-label="t.topbar.lightMode"
          @click="!isCurrentThemeLight && emit('color-mode-toggle', $event)"
        >
          <template #icon><t-icon name="sunny" size="14px" /></template>
        </t-button>
        <t-button
          variant="text"
          class="theme-mode-btn app-mode-btn"
          :class="{ 'app-mode-btn--active': !isCurrentThemeLight }"
          :title="t.topbar.darkMode"
          :aria-label="t.topbar.darkMode"
          @click="isCurrentThemeLight && emit('color-mode-toggle', $event)"
        >
          <template #icon><t-icon name="moon" size="14px" /></template>
        </t-button>
      </div>

      <!-- 语言切换 -->
      <t-tooltip :content="t.topbar.switchLang" placement="bottom">
        <t-button
          variant="text"
          class="lang-btn app-icon-btn app-icon-btn--bordered"
          :aria-label="t.topbar.switchLang"
          @click="emit('lang-toggle')"
        >
          <template #icon><span class="lang-btn__emoji">🌐</span></template>
        </t-button>
      </t-tooltip>

      <!-- 退出登录 -->
      <t-tooltip :content="t.topbar.logout" placement="bottom">
        <t-button
          variant="text"
          class="logout-btn app-icon-btn app-icon-btn--bordered app-icon-btn--danger"
          :aria-label="t.topbar.logout"
          @click="emit('logout')"
        >
          <template #icon><t-icon name="poweroff" size="14px" /></template>
        </t-button>
      </t-tooltip>
    </div>
  </t-header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useStatusStore } from '@/stores/status';
import { getThemeStyles } from '@/constants/theme';
import type { Locale } from '@/types/locale';
import type { ThemeStyle } from '@/types/theme';

const statusStore = useStatusStore();

const props = defineProps<{
  /** i18n 完整文案对象（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 是否为移动端状态（控制背饰、面包屑、主题文案是否隐藏等） */
  isMobile: boolean;
  /** 当前页面标题（渲染面包屑末端） */
  currentPageTitle: string;
  /** 当前页面所属的上级菜单分组名（面包屑中间层级，空则不显示） */
  currentPageGroup: string;
  /** 当前主色（变量 --accent-primary，用于颜色选择器默认值） */
  accentPrimary: string;
  /** 当前是否为亮色主题 */
  isCurrentThemeLight: boolean;
  /** 当前主题风格 id（用于高亮下拉选中项） */
  currentStyleId: ThemeStyle;
  /** 当前主题名称（高亮显示于主题选择器按钮上） */
  currentThemeLabel: string;
  /** 当前主题预览色（圆点颜色，高亮按钮上） */
  currentThemePreview: string;
  /** 是否启用按时间自动切换亮暗主题 */
  isAutoTheme: boolean;
  /** 自动切到亮色的时间（HH:mm） */
  lightTime: string;
  /** 自动切到暗色的时间（HH:mm） */
  darkTime: string;
}>();

// 主题风格列表：getThemeStyles 内部读取当前语言，用 computed 保证切换语言后菜单标签同步更新
const themeStyles = computed(() => getThemeStyles());

const colorPickerRef = ref<HTMLInputElement | null>(null);
const themeSelectorRef = ref<HTMLDivElement | null>(null);
// 注意：t-button 上的 ref 拿到的是组件实例（ComponentPublicInstance），
// 需要通过 $el 取到真实根 DOM；这里联合「DOM 元素」与「带 $el 的组件实例」两种情况。
const themeBtnRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null);
const themeMenuRef = ref<HTMLDivElement | null>(null);
const themeMenuOpen = ref(false);

/** 从 ref 中安全取出根 DOM 元素，兼容原生元素和组件实例 */
const resolveBtnEl = (): HTMLElement | null => {
  const r = themeBtnRef.value as HTMLElement | { $el?: HTMLElement } | null;
  if (!r) return null;
  if (r instanceof HTMLElement) return r;
  return (r as { $el?: HTMLElement }).$el ?? null;
};

/** 动态计算菜单位置，使其跟随按钮 */
const menuPosition = computed(() => {
  // 依赖 themeMenuOpen，确保打开时重新计算（避免首屏 0,0 缓存）
  if (!themeMenuOpen.value) return {};
  const el = resolveBtnEl();
  if (!el) return {};
  const rect = el.getBoundingClientRect();
  return {
    position: 'fixed' as const,
    top: `${rect.bottom + 6}px`,
    right: `${window.innerWidth - rect.right}px`,
  };
});

const toggleThemeMenu = () => {
  themeMenuOpen.value = !themeMenuOpen.value;
};

const selectTheme = (id: ThemeStyle) => {
  emit('theme-change', id);
  if (id !== 'custom') {
    themeMenuOpen.value = false;
  }
};

/** 点击外部关闭下拉菜单（同时排除按钮和菜单区域） */
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;
  const inSelector = themeSelectorRef.value?.contains(target);
  const inMenu = themeMenuRef.value?.contains(target);
  if (!inSelector && !inMenu) {
    themeMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const emit = defineEmits<{
  /** 点击汉堡菜单打开侧边栏（移动端） */
  (e: 'open-sidebar'): void;
  /** 颜色选择器选色事件（自定义主题调色） */
  (e: 'color-change', event: Event): void;
  /** 切换亮/暗色模式 */
  (e: 'color-mode-toggle', event: MouseEvent): void;
  /** 开启/关闭按时间自动切换主题 */
  (e: 'auto-toggle', event: MouseEvent): void;
  /** 修改自动切换时间 */
  (e: 'auto-time-change', times: { lightTime: string; darkTime: string }): void;
  /** 选择主题风格，参数为主题 id */
  (e: 'theme-change', id: ThemeStyle): void;
  /** 退出登录 */
  (e: 'logout'): void;
  /** 切换语言 */
  (e: 'lang-toggle'): void;
}>();

/**
 * 处理亮色时间变更
 * @param {Event} event - input 变更事件
 */
const handleLightTimeChange = (event: Event): void => {
  const value = (event.target as HTMLInputElement).value;
  emit('auto-time-change', { lightTime: value, darkTime: props.darkTime });
};

/**
 * 处理暗色时间变更
 * @param {Event} event - input 变更事件
 */
const handleDarkTimeChange = (event: Event): void => {
  const value = (event.target as HTMLInputElement).value;
  emit('auto-time-change', { lightTime: props.lightTime, darkTime: value });
};

defineExpose({ colorPickerRef });
</script>

<style scoped>
/* 仅保留本组件独有的表现：位置、布局、装饰元素。
   按钮外观由全局 .app-icon-btn / .app-pill-btn / .app-mode-btn 提供。 */

/* 主题选择器包裹层 */
.theme-selector {
  position: relative;
  flex-shrink: 0;
}

/* 主题选择器中的颜色预览小圆点 */
.theme-preview-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15);
  transition: all 0.2s ease;
}

.theme-selector-btn:hover .theme-preview-dot {
  transform: scale(1.1);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25), 0 0 8px var(--glow-primary);
}

.theme-label {
  font-size: 12px;
  white-space: nowrap;
}

/* 亮/暗模式切换分段按钮组外包裹 */
.theme-mode-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 3px;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-mode-toggle:hover {
  border-color: var(--border-hover);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 4px rgba(0, 0, 0, 0.15);
}

/* 语言按钮 emoji 字体适配（覆盖默认 16px 图标字号） */
.lang-btn__emoji {
  font-size: 16px;
  line-height: 1;
}
</style>

<!-- 非 scoped 样式：Teleport 到 body 的下拉菜单 -->
<style>
/* 主题下拉菜单（teleport 到 body，不能用 scoped） */
.theme-menu {
  min-width: 180px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 9000;
  backdrop-filter: blur(12px);
}

.theme-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text-secondary);
  font-size: 13px;
}

.theme-menu-item:hover {
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.08);
  color: var(--text-primary);
}

.theme-menu-item.active {
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.12);
  color: var(--accent-primary);
}

.theme-menu-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1.5px rgba(128, 128, 128, 0.2);
}

.theme-menu-item.active .theme-menu-dot {
  box-shadow: 0 0 0 2px var(--accent-primary);
}

.theme-menu-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.theme-menu-label {
  flex: 1;
}

.theme-menu-check {
  color: var(--accent-primary);
  flex-shrink: 0;
}

/* 自动主题时间设置 */
.theme-menu-auto {
  padding: 8px 10px;
  margin-top: 4px;
  border-top: 1px solid var(--border-color);
}

.auto-title {
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.auto-time-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.auto-time-input {
  width: 108px;
  padding: 3px 6px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
}

/* 自定义主题项：整行可点击打开颜色选择器 */
.theme-menu-custom-item {
  position: relative;
  cursor: pointer;
}

.theme-menu-custom-item .color-picker-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

/* 下拉菜单动画 */
.theme-menu-enter-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.theme-menu-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.theme-menu-enter-from,
.theme-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
</style>
