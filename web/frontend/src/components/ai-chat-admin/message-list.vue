<template>
  <div class="message-list">
    <div v-if="visibleMessages.length === 0" class="message-empty">{{ t.aiChatAdmin.messagesEmpty }}</div>

    <div
      v-for="message in visibleMessages"
      :key="message.seq"
      :class="['message-card', inRun(message) ? 'is-in-run' : '']"
    >
      <div class="message-head">
        <span class="message-seq">#{{ message.seq }}</span>
        <t-tag :theme="roleTheme(message.role)" variant="light" size="small">
          {{ roleLabel(message.role) }}
        </t-tag>
        <span v-if="message.name || extractToolResultName(message.content)" class="message-tool-name">
          {{ message.name || extractToolResultName(message.content) }}
        </span>
        <span class="message-time">{{ formatAiTime(message.created_at) }}</span>
        <span v-if="message.total_tokens > 0" class="message-tokens">
          {{ t.aiChatAdmin.messageTokens(formatAiTokens(message.total_tokens)) }}
        </span>
        <t-tag v-if="inRun(message) && !allInRun" theme="primary" variant="light" size="small">
          {{ t.aiChatAdmin.messageInRun }}
        </t-tag>
      </div>

      <details v-if="message.tool_calls" class="message-detail">
        <summary>{{ t.aiChatAdmin.messageToolCalls }}</summary>
        <pre class="code-output message-code">{{ prettifyAiText(message.tool_calls) }}</pre>
      </details>
      <details v-if="isLongAiText(message.content)" class="message-content-block" open>
        <summary>{{ t.aiChatAdmin.messageContent }}</summary>
        <pre class="code-output message-content">{{ prettifyAiText(message.content) }}</pre>
      </details>
      <pre v-else-if="message.content" class="code-output message-content">{{ prettifyAiText(message.content) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  formatAiTime,
  formatAiTokens,
  prettifyAiText,
  extractToolResultName,
  isLongAiText,
} from '@/utils/ai-chat-admin';
import type { Locale } from '@/types/locale';
import type { AiChatAdminMessage } from '@/types/ai-chat-admin';

const props = defineProps<{
  /** i18n 语言包（由父组件传入，响应式） */
  t: Locale;
  /** 会话消息流水 */
  messages: AiChatAdminMessage[];
  /** 本次运行开始时间戳（ms） */
  runStart: number;
  /** 本次运行结束时间戳（ms） */
  runEnd: number;
}>();

/**
 * 判断消息是否落在本次运行的时间窗口内
 * @param {AiChatAdminMessage} message - 会话消息
 * @returns {boolean} 属于本次运行为 true；旧数据没有时间戳时返回 false
 */
const inRun = (message: AiChatAdminMessage): boolean => {
  if (!message.created_at) return false;
  return message.created_at >= props.runStart - 1000 && message.created_at <= props.runEnd + 1000;
};

/**
 * 需要展示的消息
 * @description 工具调用轮的 assistant 消息正文为空，历史数据又没落 tool_calls，
 *   这类空壳消息会渲染成一叠重复卡片；正文、工具调用、工具名、token 全空时直接隐藏。
 */
const visibleMessages = computed<AiChatAdminMessage[]>(() => props.messages.filter((message) =>
  Boolean(message.content.trim())
  || Boolean(message.tool_calls)
  || Boolean(message.name)
  || message.total_tokens > 0
));

/** 可见消息是否都属于本次运行：是则不再逐条打「本次运行」标签 */
const allInRun = computed<boolean>(() => visibleMessages.value.length > 0
  && visibleMessages.value.every((message) => inRun(message)));

/**
 * 角色标签主题
 * @param {string} role - 消息角色
 * @returns {'default' | 'primary' | 'success' | 'warning'} 标签主题
 */
const roleTheme = (role: string): 'default' | 'primary' | 'success' | 'warning' => {
  if (role === 'user') return 'primary';
  if (role === 'assistant') return 'success';
  if (role === 'tool') return 'warning';
  return 'default';
};

/**
 * 角色显示名
 * @param {string} role - 消息角色
 * @returns {string} 本地化后的角色名
 */
const roleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    user: props.t.aiChatAdmin.roleUser,
    assistant: props.t.aiChatAdmin.roleAssistant,
    tool: props.t.aiChatAdmin.roleTool,
    system: props.t.aiChatAdmin.roleSystem,
  };
  return labels[role] ?? role;
};
</script>

<style scoped>
@import '@/styles/common.css';

.message-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
}

.message-card {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.message-card.is-in-run {
  border-color: var(--td-brand-color);
}

.message-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.message-seq {
  font-weight: 600;
}

.message-tool-name,
.message-content {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.message-tool-name {
  font-size: 12px;
  color: var(--text-primary);
}

.message-detail {
  font-size: 12px;
  color: var(--text-secondary);
}

.message-detail summary,
.message-content-block > summary {
  cursor: pointer;
}

.message-content-block > summary {
  margin-top: 8px;
  color: var(--text-secondary);
}

.message-code,
.message-content {
  max-height: 360px;
  overflow: auto;
  border-radius: 4px;
  background: var(--bg-primary);
}

.message-content {
  margin-top: 8px;
}
</style>
