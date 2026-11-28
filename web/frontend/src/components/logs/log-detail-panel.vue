<template>
  <div class="log-detail-panel">
    <div class="log-detail-head">
      <span class="log-detail-title">{{ t.logs.detailTitle }}</span>
      <t-button variant="text" size="small" @click="emit('close')">
        <template #icon><t-icon name="close" /></template>
        {{ t.common.close }}
      </t-button>
    </div>

    <t-loading :loading="loading">
      <template v-if="detail">
        <div class="log-detail-fields">
          <div v-for="field in fields" :key="field.label" class="log-detail-field">
            <span class="log-detail-label">{{ field.label }}</span>
            <span class="log-detail-value">{{ field.value }}</span>
          </div>
        </div>

        <!-- 点击行展开时直接展示完整内容与上下文，无需二次点击 -->
        <div v-if="detail.message" class="log-detail-block">
          <span class="log-detail-label">{{ t.logs.colMessage }}</span>
          <log-output
            :t="t"
            :stdout="detail.message"
            max-height="360px"
            :empty-text="t.logs.detailEmpty"
          />
        </div>

        <div v-if="contextText" class="log-detail-block">
          <span class="log-detail-label">{{ t.logs.fieldContext }}</span>
          <pre class="log-detail-pre">{{ contextText }}</pre>
        </div>
      </template>
      <div v-else-if="!loading" class="log-detail-empty">{{ t.logs.detailEmpty }}</div>
    </t-loading>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LogOutput from '@/components/common/log-output.vue';
import { formatLogTime } from '@/utils/format';
import type { Locale } from '@/types/locale';
import type { LogDetail } from '@/types/log';

const props = defineProps<{
  /** i18n 语言包（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 当前日志详情，null 表示尚未加载或记录不存在 */
  detail: LogDetail | null;
  /** 详情加载中 */
  loading: boolean;
  /** 来源显示名（由父页面按库里的 source 解析） */
  sourceName: string;
}>();

const emit = defineEmits<{
  /** 关闭详情面板 */
  (e: 'close'): void;
}>();

/** 结构化上下文（空对象/数组不展示，合法 JSON 格式化后输出） */
const contextText = computed<string>(() => {
  const raw = props.detail?.context?.trim() ?? '';
  if (!raw || ['{}', '[]', 'null'].includes(raw)) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
});

/** 详情字段列表：只展示有值的字段，标题随语言切换 */
const fields = computed<Array<{ label: string; value: string }>>(() => {
  const detail = props.detail;
  if (!detail) return [];
  const all: Array<{ label: string; value: string }> = [
    { label: props.t.logs.fieldId, value: String(detail.id) },
    { label: props.t.logs.colTime, value: formatLogTime(detail.logged_at, detail.ts_ms) },
    { label: 'ts_ms', value: detail.ts_ms === null ? '' : String(detail.ts_ms) },
    { label: props.t.logs.colLevel, value: detail.level },
    { label: props.t.logs.colSource, value: props.sourceName || detail.source },
    { label: props.t.logs.fieldType, value: detail.source_type },
    { label: props.t.logs.fieldCaller, value: detail.caller ?? '' },
    { label: props.t.logs.fieldHost, value: detail.hostname ?? '' },
    { label: props.t.logs.fieldPid, value: detail.pid === null ? '' : String(detail.pid) },
    { label: props.t.logs.fieldTrace, value: detail.trace_id ?? '' },
    { label: props.t.logs.fieldUser, value: detail.user ?? '' },
  ];
  return all.filter((field) => field.value.trim() !== '');
});
</script>

<style scoped>
.log-detail-panel {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.log-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.log-detail-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.log-detail-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px 16px;
}

.log-detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.log-detail-label {
  font-size: 12px;
  color: var(--text-muted);
}

.log-detail-value {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
}

.log-detail-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.log-detail-pre {
  margin: 0;
  padding: 14px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-primary);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 360px;
  overflow-y: auto;
}

.log-detail-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .log-detail-fields {
    grid-template-columns: 1fr;
  }
}
</style>
