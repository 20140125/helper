<template>
  <div class="trigger-section">
    <div class="trigger-section-header">
      <div class="trigger-section-dot" :style="{ background: dotColor }"></div>
      <h3 class="trigger-section-title">{{ title }}</h3>
      <span class="trigger-section-count">{{ t.trigger.scriptCount(count) }}</span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 分类标题 */
  title: string;
  /** 圆点颜色，支持 CSS 变量或颜色值 */
  dotColor: string;
  /** 脚本数量 */
  count: number;
}>();
</script>

<style scoped>
.trigger-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trigger-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 2px;
}

.trigger-section-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.trigger-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.trigger-section-count {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--input-bg, rgba(255, 255, 255, 0.04));
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}
</style>
