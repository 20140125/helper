<template>
  <t-table
    :data="stats"
    :columns="columns"
    row-key="name"
    size="small"
    :empty="t.aiChatAdmin.toolsEmpty"
    stripe
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatAiDuration, formatAiPercent } from '@/utils/ai-chat-admin';
import type { Locale } from '@/types/locale';
import type { AiChatAdminToolStat } from '@/types/ai-chat-admin';

const props = defineProps<{
  /** i18n 语言包（由父组件传入，响应式） */
  t: Locale;
  /** 按工具名聚合的调用统计 */
  stats: AiChatAdminToolStat[];
}>();

/** 工具汇总表格列定义（随语言切换） */
const columns = computed<Array<Record<string, unknown>>>(() => {
  const t = props.t.aiChatAdmin;
  return [
    { colKey: 'name', title: t.toolColName, minWidth: 180 },
    { colKey: 'calls', title: t.toolColCalls, width: 120 },
    { colKey: 'failures', title: t.toolColFailures, width: 120 },
    {
      colKey: 'avg_duration_ms', title: t.toolColAvgDuration, width: 140,
      cell: (_h: unknown, ctx: { row: AiChatAdminToolStat }) => formatAiDuration(ctx.row.avg_duration_ms),
    },
    {
      colKey: 'success_rate', title: t.toolColSuccessRate, width: 140,
      cell: (_h: unknown, ctx: { row: AiChatAdminToolStat }) => formatAiPercent(ctx.row.success_rate),
    },
  ];
});
</script>
