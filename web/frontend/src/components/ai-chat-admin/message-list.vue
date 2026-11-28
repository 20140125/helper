<template>
  <div class="message-list">
    <div v-if="messages.length === 0" class="message-empty">{{ t.aiChatAdmin.messagesEmpty }}</div>

    <div
      v-for="message in messages"
      :key="message.seq"
      :class="['message-card', inRun(message) ? 'is-in-run' : '']"
    >
      <div class="message-head">
        <span class="message-seq">#{{ message.seq }}</span>
        <t-tag :theme="roleTheme(message.role)" variant="light" size="small">
          {{ roleLabel(message.role) }}
        </t-tag>
        <span v-if="message.name" class="message-tool-name">{{ message.name }}</span>
        <span class="message-time">{{ formatAiTime(message.created_at) }}</span>
        <span v-if="message.total_tokens > 0" class="message-tokens">
          {{ t.aiChatAdmin.messageTokens(formatAiTokens(message.total_tokens)) }}
        </span>
        <t-tag v-if="inRun(message)" theme="primary" variant="light" size="small">
          {{ t.aiChatAdmin.messageInRun }}
        </t-tag>
      </div>

      <details v-if="message.tool_calls" class="message-detail">
        <summary>{{ t.aiChatAdmin.messageToolCalls }}</summary>
        <pre class="code-block">{{ prettifyAiText(message.tool_calls) }}</pre>
      </details>
      <pre v-if="message.content" class="code-block message-content">{{ prettifyAiText(message.content) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatAiTime, formatAiTokens, prettifyAiText } from '@/utils/ai-chat-admin';
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

.message-detail summary {
  cursor: pointer;
}

.message-content {
  max-height: 320px;
  margin-top: 8px;
}
</style>
