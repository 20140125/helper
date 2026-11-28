<template>
  <div class="step-timeline">
    <div v-if="steps.length === 0" class="step-empty">{{ t.aiChatAdmin.stepsEmpty }}</div>

    <div v-for="step in steps" :key="step.iteration" class="step-card">
      <div class="step-head">
        <span class="step-title">{{ t.aiChatAdmin.stepTitle(step.iteration + 1) }}</span>
        <span class="step-usage">
          {{ t.aiChatAdmin.stepPrompt }}{{ formatAiTokens(step.usage.prompt_tokens) }}
          · {{ t.aiChatAdmin.stepCompletion }}{{ formatAiTokens(step.usage.completion_tokens) }}
          · {{ t.aiChatAdmin.stepTotal }}{{ formatAiTokens(step.usage.total_tokens) }}
        </span>
      </div>

      <div v-if="step.tool_calls.length === 0" class="step-no-tools">
        {{ t.aiChatAdmin.stepNoTools }}
      </div>

      <div v-for="call in step.tool_calls" :key="call.id" class="tool-call">
        <div class="tool-call-head">
          <t-tag :theme="call.ok ? 'success' : 'danger'" variant="light" size="small">
            {{ call.ok ? t.aiChatAdmin.stepStatusOk : t.aiChatAdmin.stepStatusFailed }}
          </t-tag>
          <span class="tool-name">{{ call.name }}</span>
          <span>{{ formatAiDuration(call.duration_ms) }}</span>
          <span>{{ t.aiChatAdmin.stepArgsChars(call.args_chars) }}</span>
          <t-tag v-if="call.retried" theme="warning" variant="light" size="small">
            {{ t.aiChatAdmin.stepRetried }}
          </t-tag>
        </div>

        <details v-if="call.args" class="tool-detail">
          <summary>{{ t.aiChatAdmin.stepArgs }}</summary>
          <pre class="code-block">{{ prettifyAiText(call.args) }}</pre>
        </details>
        <details v-if="call.result" class="tool-detail">
          <summary>{{ t.aiChatAdmin.stepResult }}</summary>
          <pre class="code-block">{{ prettifyAiText(call.result) }}</pre>
        </details>
        <div v-if="call.error" class="tool-error">
          <span>{{ t.aiChatAdmin.stepError }}</span>
          <pre class="code-block">{{ prettifyAiText(call.error) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatAiDuration, formatAiTokens, prettifyAiText } from '@/utils/ai-chat-admin';
import type { Locale } from '@/types/locale';
import type { AiChatAdminStep } from '@/types/ai-chat-admin';

defineProps<{
  /** i18n 语言包（由父组件传入，响应式） */
  t: Locale;
  /** 逐轮迭代明细 */
  steps: AiChatAdminStep[];
}>();
</script>

<style scoped>
.step-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
}

.step-card {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.step-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.step-title {
  font-weight: 600;
  color: var(--text-primary);
}

.step-usage {
  font-size: 12px;
  color: var(--text-muted);
}

.step-no-tools {
  font-size: 12px;
  color: var(--text-muted);
}

.tool-call {
  margin-top: 10px;
  padding: 10px 12px;
  border-left: 3px solid var(--td-brand-color);
  border-radius: 4px;
  background: var(--bg-primary);
}

.tool-call-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

.tool-name {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tool-detail {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.tool-detail summary {
  cursor: pointer;
}

.tool-error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--td-error-color);
}
</style>
