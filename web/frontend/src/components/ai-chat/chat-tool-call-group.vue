<template>
  <div class="tool-call-group" :class="`tool-call-group--${statusKey}`">
    <div class="tool-call-group__header" @click="expanded = !expanded">
      <div class="tool-call-group__main">
        <t-icon name="tools" class="tool-call-group__icon" />
        <span class="tool-call-group__title">
          {{ t.aiChat.toolCallsTitle(toolCalls.length) }}
        </span>
        <t-tag size="small" :theme="statusTheme">
          <t-icon v-if="statusKey === 'executing'" name="loading" />
          <span>{{ statusLabel }}</span>
        </t-tag>
        <span v-if="toolNamesText" class="tool-call-group__names" :title="toolNamesText">
          {{ toolNamesText }}
        </span>
      </div>
      <t-icon
        :name="expanded ? 'chevron-up' : 'chevron-down'"
        class="tool-call-group__toggle"
      />
    </div>

    <div v-if="expanded" class="tool-call-group__body">
      <chat-tool-call-card
        v-for="tc in toolCalls"
        :key="tc.id"
        :tc="tc"
        :t="t"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ChatToolCallCard from './chat-tool-call-card.vue';
import { TOOL_CALL_STATUS_LABEL_KEY, TOOL_CALL_STATUS_THEME } from '@/constants/ai-chat';
import type { UiToolCall } from '@/types/ai-chat';
import type { Locale } from '@/types/locale';

const props = defineProps<{
  /** 同一条消息中的多个工具调用 */
  toolCalls: UiToolCall[];
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
}>();

/** 是否展开工具调用明细，默认收起 */
const expanded = ref(false);

/** 聚合状态：执行中 > 失败 > 成功 */
const statusKey = computed<'executing' | 'failed' | 'success'>(() => {
  if (props.toolCalls.some((tc) => tc.status === 'executing')) return 'executing';
  if (props.toolCalls.some((tc) => tc.status === 'failed')) return 'failed';
  return 'success';
});

/** 聚合状态标签 theme */
const statusTheme = computed(() => TOOL_CALL_STATUS_THEME[statusKey.value] ?? 'default');

/** 聚合状态文案 */
const statusLabel = computed(() => {
  const key = TOOL_CALL_STATUS_LABEL_KEY[statusKey.value];
  return key ? props.t.aiChat[key] : statusKey.value;
});

/** 同名工具合并计数摘要，例如 load_skill、query_knowledge ×6 */
const toolNamesText = computed(() => {
  const counts = new Map<string, number>();
  for (const tc of props.toolCalls) {
    counts.set(tc.name, (counts.get(tc.name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join('、');
});
</script>

<style scoped>
.tool-call-group {
  width: auto;
  box-sizing: border-box;
  border: 1px solid var(--border-color, #e7e7e7);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-secondary, #fafafa);
  font-size: 13px;
}

.tool-call-group--executing {
  border-color: var(--accent-primary, #0052d9);
}

.tool-call-group--success {
  border-color: var(--accent-green, #00a870);
}

.tool-call-group--failed {
  border-color: var(--accent-danger, #d54941);
}

.tool-call-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.tool-call-group__header:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.03));
}

.tool-call-group__main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.tool-call-group__icon {
  flex-shrink: 0;
  color: var(--accent-primary, #0052d9);
}

.tool-call-group__title {
  flex-shrink: 0;
  color: var(--text-primary);
  font-weight: 500;
}

.tool-call-group__names {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 12px;
}

.tool-call-group__toggle {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-muted);
}

.tool-call-group__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid var(--border-color, #e7e7e7);
}
</style>
