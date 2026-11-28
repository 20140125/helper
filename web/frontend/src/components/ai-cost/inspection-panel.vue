<template>
  <div class="insp-panel">
    <div class="insp-panel__bar">
      <div class="insp-panel__text">
        <h3 class="insp-panel__title">{{ t.aiCost.inspectTitle }}</h3>
        <p class="insp-panel__hint">{{ t.aiCost.inspectHint }}</p>
      </div>
      <div class="insp-panel__actions">
        <t-input
          v-model="focus"
          class="insp-panel__focus"
          clearable
          :placeholder="t.aiCost.inspectFocusPlaceholder"
          @keyup.enter="onRun"
        />
        <t-button
          theme="primary"
          :loading="loading"
          :disabled="loading"
          @click="onRun"
        >
          {{ loading ? t.aiCost.inspectRunning : t.aiCost.inspectRun }}
        </t-button>
      </div>
    </div>

    <!-- 定时巡检状态：是否启用 / 调度口径 / 上次与下次执行时间 -->
    <div v-if="status" class="insp-panel__status">
      <t-tag
        size="small"
        variant="light"
        :theme="status.enabled ? 'success' : 'default'"
      >
        {{ statusText }}
      </t-tag>
      <span class="insp-panel__status-item">{{ status.scheduleText }}</span>
      <span class="insp-panel__status-item">{{ pushText }}</span>
      <span class="insp-panel__status-item">{{ lastRunText }}</span>
      <span class="insp-panel__status-item">{{ nextRunText }}</span>
      <span
        v-if="status.lastError"
        class="insp-panel__status-item insp-panel__status-item--error"
      >
        {{ t.aiCost.inspectLastError(status.lastError) }}
      </span>
    </div>

    <!-- 巡检结果：简报由模型产出，可能是 Markdown，复用聊天渲染器保证一致 -->
    <div v-if="result" class="insp-panel__result">
      <div class="insp-panel__meta">
        <span v-if="resultSourceText">{{ resultSourceText }}</span>
        <span>{{ t.aiCost.inspectDuration(durationText) }}</span>
        <span>{{ t.aiCost.inspectToolCalls(result.tool_calls) }}</span>
      </div>
      <!-- eslint-disable vue/no-v-html -- 内容经 renderChatMarkdown 渲染并已由 DOMPurify 净化 -->
      <div class="insp-panel__brief markdown-body" v-html="briefHtml" />
      <!-- eslint-enable vue/no-v-html -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Locale } from '@/types/locale';
import type { AiInspectionResult, AiInspectionStatus } from '@/types/ai-cost';
import { renderChatMarkdown } from '@/utils/ai-chat';

const props = defineProps<{
  /** i18n 翻译对象（由父页传入，响应式） */
  t: Locale;
  /** 是否正在巡检（控制按钮 loading 与禁用） */
  loading: boolean;
  /** 最近一次巡检结果；未跑过时为 null */
  result: AiInspectionResult | null;
  /** 巡检耗时文案（父页加工好的展示文本） */
  durationText: string;
  /** 定时巡检的调度状态；读取失败时为 null（此时不展示状态行） */
  status: AiInspectionStatus | null;
}>();

/**
 * 组件事件
 */
const emit = defineEmits<{
  /** 点击「立即巡检」：由父页调用 model.runInspection */
  (e: 'run'): void;
}>();

/** 定向排查重点（可留空），Vue 3.4+ defineModel 语法糖 */
const focus = defineModel<string>('focus', { default: '' });

/**
 * 巡检简报的渲染结果
 * @description 走与聊天一致的 renderChatMarkdown（含 DOMPurify 净化），保证表格/列表正确展示
 */
const briefHtml = computed((): string => {
  const brief = props.result?.brief ?? '';
  return brief ? renderChatMarkdown(brief) : '';
});

/**
 * 把 ISO 时间串格式化为「MM-DD HH:mm」
 * @param {string} iso - ISO 时间串
 * @returns {string} 展示文本；空值或非法值返回空串
 */
const formatTime = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * 状态标签文案（执行中 > 已启用 > 未启用）
 */
const statusText = computed((): string => {
  const status = props.status;
  if (!status) return '';
  if (status.running) return props.t.aiCost.inspectStatusRunning;
  return status.enabled ? props.t.aiCost.inspectStatusEnabled : props.t.aiCost.inspectStatusDisabled;
});

/** 是否推送简报到企微群 */
const pushText = computed((): string =>
  props.status?.push ? props.t.aiCost.inspectPushOn : props.t.aiCost.inspectPushOff,
);

/** 上次运行文案 */
const lastRunText = computed((): string => {
  const at = formatTime(props.status?.lastRunAt ?? '');
  return at ? props.t.aiCost.inspectLastRun(at) : props.t.aiCost.inspectNeverRun;
});

/**
 * 结果区来源标签（手动 / 定时 + 产出时间）
 * @description 简报可能来自定时巡检落盘的记录，标明来源与时间便于判断新鲜度
 */
const resultSourceText = computed((): string => {
  const record = props.status?.lastResult;
  if (!record?.run_at) return '';
  const kind = record.manual ? props.t.aiCost.inspectReportManual : props.t.aiCost.inspectReportAuto;
  const at = formatTime(record.run_at);
  return at ? `${kind} · ${at}` : kind;
});

/** 下次运行文案（未启用时后端不返回，展示「未安排」） */
const nextRunText = computed((): string => {
  const at = formatTime(props.status?.nextRunAt ?? '');
  return at ? props.t.aiCost.inspectNextRun(at) : props.t.aiCost.inspectNoNextRun;
});

/**
 * 点击「立即巡检」
 * @returns {void}
 */
const onRun = (): void => {
  emit('run');
};
</script>

<style scoped>
.insp-panel {
  margin-bottom: 28px;
  padding: 16px;
  border-radius: 8px;
  background: var(--td-bg-color-container);
}

.insp-panel__bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.insp-panel__text {
  min-width: 220px;
  flex: 1;
}

.insp-panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.insp-panel__hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.insp-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.insp-panel__focus {
  width: 220px;
}

.insp-panel__status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.insp-panel__status-item--error {
  color: var(--td-text-color-danger, #d54941);
}

.insp-panel__result {
  margin-top: 12px;
}

.insp-panel__meta {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.insp-panel__brief {
  font-size: 13px;
  line-height: 1.7;
  color: var(--td-text-color-primary);
}
</style>
