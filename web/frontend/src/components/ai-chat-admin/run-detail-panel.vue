<template>
  <t-loading :loading="loading">
    <template v-if="detail">
      <div class="run-metrics">
        <div v-for="metric in metrics" :key="metric.label" class="run-metric">
          <span class="run-metric-label">{{ metric.label }}</span>
          <span class="run-metric-value" :title="metric.value">{{ metric.value }}</span>
        </div>
      </div>

      <div v-if="detail.trace.error" class="run-error">
        <span class="run-error-label">{{ t.aiChatAdmin.metricError }}</span>
        <pre class="code-block">{{ detail.trace.error }}</pre>
      </div>

      <t-tabs v-model="activeTab">
        <t-tab-panel :value="TAB_STEPS" :label="t.aiChatAdmin.tabSteps">
          <step-timeline :t="t" :steps="detail.trace.steps" />
        </t-tab-panel>
        <t-tab-panel :value="TAB_MESSAGES" :label="t.aiChatAdmin.tabMessages">
          <message-list
            :t="t"
            :messages="detail.messages"
            :run-start="detail.trace.started_at"
            :run-end="detail.trace.ended_at"
          />
        </t-tab-panel>
        <t-tab-panel :value="TAB_TOOLS" :label="t.aiChatAdmin.tabTools">
          <tool-summary :t="t" :stats="toolStats" />
        </t-tab-panel>
      </t-tabs>
    </template>
    <div v-else-if="!loading" class="run-empty">{{ t.aiChatAdmin.detailEmpty }}</div>
  </t-loading>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  AI_CHAT_ADMIN_TAB_STEPS,
  AI_CHAT_ADMIN_TAB_MESSAGES,
  AI_CHAT_ADMIN_TAB_TOOLS,
} from '@/constants/ai-chat-admin';
import { formatAiDuration, formatAiTokens } from '@/utils/ai-chat-admin';
import type { Locale } from '@/types/locale';
import type { AiChatAdminDetail, AiChatAdminToolStat } from '@/types/ai-chat-admin';
import StepTimeline from './step-timeline.vue';
import MessageList from './message-list.vue';
import ToolSummary from './tool-summary.vue';

const props = defineProps<{
  /** i18n 语言包（由父组件传入，响应式） */
  t: Locale;
  /** 当前运行详情，null 表示尚未加载 */
  detail: AiChatAdminDetail | null;
  /** 详情加载中 */
  loading: boolean;
  /** 按工具名聚合的调用统计 */
  toolStats: AiChatAdminToolStat[];
}>();

/** 详情面板当前 Tab */
const activeTab = ref<string>(AI_CHAT_ADMIN_TAB_STEPS);

const TAB_STEPS = AI_CHAT_ADMIN_TAB_STEPS;
const TAB_MESSAGES = AI_CHAT_ADMIN_TAB_MESSAGES;
const TAB_TOOLS = AI_CHAT_ADMIN_TAB_TOOLS;

/** 概览指标：本次运行的耗时、用量、工具与成本 */
const metrics = computed<Array<{ label: string; value: string }>>(() => {
  const detail = props.detail;
  if (!detail) return [];
  const t = props.t.aiChatAdmin;
  const trace = detail.trace;
  return [
    { label: t.metricRunId, value: trace.run_id },
    { label: t.metricConversation, value: detail.conversation.title || detail.conversation.id },
    { label: t.metricModel, value: trace.model },
    { label: t.metricDuration, value: formatAiDuration(trace.duration_ms) },
    { label: t.metricIterations, value: String(trace.iterations) },
    { label: t.metricPromptTokens, value: formatAiTokens(trace.prompt_tokens) },
    { label: t.metricCompletionTokens, value: formatAiTokens(trace.completion_tokens) },
    { label: t.metricTotalTokens, value: formatAiTokens(trace.total_tokens) },
    { label: t.metricToolCalls, value: String(trace.tool_calls) },
    { label: t.metricFailures, value: String(trace.tool_failures) },
    { label: t.metricCost, value: trace.cost_cny.toFixed(4) },
    { label: t.metricPlanning, value: trace.planning_enabled ? props.t.common.yes : props.t.common.no },
    { label: t.metricReflections, value: String(trace.reflections) },
  ];
});
</script>

<style scoped>
.run-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px 16px;
  margin-bottom: 18px;
}

.run-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.run-metric-label {
  font-size: 12px;
  color: var(--text-muted);
}

.run-metric-value {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-error {
  margin-bottom: 18px;
  color: var(--td-error-color);
}

.run-error-label {
  font-size: 12px;
  font-weight: 600;
}

.run-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
}
</style>
