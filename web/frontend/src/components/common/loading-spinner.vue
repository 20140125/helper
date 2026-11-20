<template>
  <div class="loading-spinner" :class="wrapClass" :style="wrapStyle">
    <span class="spinner" :style="iconStyle" />
    <span v-if="text || t.components.loadingText" class="loading-spinner__text" :style="{ fontSize: textSize }">{{ text || t.components.loadingText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Locale } from '@/locales/zh';

const props = withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 提示文字，不传则显示默认 locale 文字 */
  text?: string;
  /** 图标尺寸（px 数值） */
  size?: number;
  /** 文字大小 */
  textSize?: string;
  /** 垂直内边距 */
  paddingY?: string;
  /** 水平内边距 */
  paddingX?: string;
  /** 是否居中 */
  center?: boolean;
}>(), {
  /** TODO: text 描述 */
  text: '',
  /** TODO: size 描述 */
  size: 14,
  /** TODO: textSize 描述 */
  textSize: '13px',
  /** TODO: paddingY 描述 */
  paddingY: '',
  /** TODO: paddingX 描述 */
  paddingX: '',
  /** TODO: center 描述 */
  center: false,
});

const iconStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderWidth: `${Math.max(1.5, props.size * 0.14)}px`,
}));

const wrapClass = computed(() => ({
  'loading-spinner--center': props.center,
}));

const wrapStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.paddingY) {
    style.paddingTop = props.paddingY;
    style.paddingBottom = props.paddingY;
  }
  if (props.paddingX) {
    style.paddingLeft = props.paddingX;
    style.paddingRight = props.paddingX;
  }
  return style;
});
</script>

<style scoped>
.loading-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}

.loading-spinner--center {
  justify-content: center;
}

.loading-spinner__text {
  line-height: 1;
}
</style>
