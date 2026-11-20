<template>
  <div class="reasoning-card">
    <div
      class="reasoning-card__header"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="t.aiChat.reasoningTitle"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <div class="reasoning-card__header-main">
        <t-icon name="info-circle" class="reasoning-card__icon" />
        <span class="reasoning-card__title">{{ t.aiChat.reasoningTitle }}</span>
        <span v-if="streaming" class="reasoning-card__status">{{ t.aiChat.thinking }}</span>
        <span v-else class="reasoning-card__count">{{ charCountText }}</span>
      </div>
      <t-icon :name="expanded ? 'chevron-up' : 'chevron-down'" class="reasoning-card__toggle" />
    </div>

    <div v-if="expanded" class="reasoning-card__body">
      <pre class="reasoning-card__text">{{ reasoning }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Locale } from '@/locales/zh';

const props = defineProps<{
  /** i18n 翻译对象（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 模型思考过程文本（流式累积） */
  reasoning: string;
  /** 是否仍在流式生成中 */
  streaming: boolean;
}>();

/** 折叠态：思考内容可能很长，默认收起避免刷屏，用户点击即可展开 */
const expanded = ref(false);

/** 标题右侧的字数提示 */
const charCountText = computed((): string =>
  props.t.aiChat.reasoningChars.replace('{n}', String(props.reasoning.length)),
);

/** 展开 / 收起思考过程 */
const toggle = (): void => {
  expanded.value = !expanded.value;
};
</script>

<style scoped>
.reasoning-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary, rgba(127, 127, 127, 0.04));
  overflow: hidden;
}

.reasoning-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.reasoning-card__header:hover {
  background: rgba(127, 127, 127, 0.06);
}

.reasoning-card__header-main {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-primary);
}

.reasoning-card__icon {
  color: var(--accent-primary, #0052d9);
}

.reasoning-card__title {
  font-weight: 600;
}

.reasoning-card__status,
.reasoning-card__count {
  font-size: 11px;
  color: var(--text-muted);
}

.reasoning-card__toggle {
  color: var(--text-muted);
}

.reasoning-card__body {
  border-top: 1px solid var(--border-color);
  padding: 8px 12px;
  max-height: 320px;
  overflow-y: auto;
}

.reasoning-card__text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}
</style>
