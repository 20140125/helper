<template>
  <transition name="back-to-top-fade">
    <t-button
      v-show="visible"
      variant="text"
      class="back-to-top app-floating-btn"
      :title="t.common.backToTop"
      :aria-label="t.common.backToTop"
      shape="circle"
      @click="scrollToTop"
    >
      <template #icon><t-icon name="backtop" /></template>
    </t-button>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { Locale } from '@/types/locale';

const props = withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 滚动容器选择器，默认应用主滚动区 .page-content */
  containerSelector?: string;
  /** 触发显示按钮的滚动距离阈值（px） */
  threshold?: number;
}>(), {
  containerSelector: '.page-content',
  threshold: 300,
});

const visible = ref(false);
let scrollContainer: HTMLElement | null = null;

const handleScroll = (): void => {
  if (!scrollContainer) {
    return;
  }
  visible.value = scrollContainer.scrollTop > props.threshold;
};

const scrollToTop = (): void => {
  if (!scrollContainer) {
    return;
  }
  scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
};

onMounted(() => {
  scrollContainer = document.querySelector<HTMLElement>(props.containerSelector);
  if (!scrollContainer) {
    return;
  }
  scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
  // 初始化一次状态，避免首屏挂载时已滚动场景下按钮不显示
  handleScroll();
});

onBeforeUnmount(() => {
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll);
    scrollContainer = null;
  }
});
</script>

<style scoped>
/* 仅保留差异化属性：fixed 定位（其余外观由全局 .app-floating-btn 提供） */
.back-to-top {
  position: fixed;
  right: 28px;
  bottom: 32px;
  z-index: 1500;
}

/* 移动端：贴近边缘（移动端尺寸由全局 .app-floating-btn 媒体查询处理） */
@media (max-width: 768px) {
  .back-to-top {
    right: 16px;
    bottom: 24px;
  }
}

/* 入场/出场动画 */
.back-to-top-fade-enter-active,
.back-to-top-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.back-to-top-fade-enter-from,
.back-to-top-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
