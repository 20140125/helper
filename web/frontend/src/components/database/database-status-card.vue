<template>
  <card-panel :title="t.database.statusTitle" icon="server" icon-theme="primary">
    <template #actions>
      <t-button variant="outline" size="small" @click="emit('refresh')">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </template>

    <div class="db-status-grid">
      <t-tag :theme="tagTheme">{{ tagText }}</t-tag>
      <span><b>{{ t.database.statusHost }}:</b> {{ hostText }}</span>
      <span><b>{{ t.database.statusDatabase }}:</b> {{ status?.database || '-' }}</span>
      <span><b>{{ t.database.statusVersion }}:</b> {{ status?.version || '-' }}</span>
    </div>
    <p v-if="status?.error" class="db-status-error">
      {{ t.database.statusError }}: {{ status.error }}
    </p>
    <p v-if="status && !status.configured" class="db-status-hint">
      {{ t.database.statusHint }}
    </p>
  </card-panel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CardPanel from '@/components/common/card-panel.vue';
import type { Locale } from '@/locales/zh';
import type { DatabaseStatus } from '@/types/database';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 数据库连接状态，null 表示尚未加载 */
  status: DatabaseStatus | null;
}>();

const emit = defineEmits<{
  /** 重新探测连接状态 */
  (e: 'refresh'): void;
}>();

const tagText = computed(() => {
  if (!props.status) return props.t.database.statusUnknown;
  if (!props.status.configured) return props.t.database.statusNotConfigured;
  return props.status.connected ? props.t.database.statusConnected : props.t.database.statusDisconnected;
});

const tagTheme = computed<'success' | 'danger' | 'warning'>(() => {
  if (!props.status || !props.status.configured) return 'warning';
  return props.status.connected ? 'success' : 'danger';
});

const hostText = computed(() =>
  props.status?.host ? `${props.status.host}:${props.status.port}` : '-',
);
</script>

<style scoped>
.db-status-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  font-size: 13px;
  color: var(--text-secondary);
}

.db-status-grid b {
  color: var(--text-muted);
  font-weight: 500;
  margin-right: 4px;
}

.db-status-error,
.db-status-hint {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
  word-break: break-all;
}

.db-status-error {
  color: var(--td-error-color, #d54941);
}
</style>
