<template>
  <div class="i18n-table-wrap">
    <div v-if="rows.length === 0 && !loading" class="i18n-empty">
      <t-icon name="info-circle" size="20px" />
      <span>{{ t.i18nMessages.emptyHint }}</span>
    </div>
    <t-table v-else :data="rows" :columns="columns" row-key="id" hover stripe size="small" :loading="loading">
      <template #value="{ row }">
        <span class="i18n-value-cell" :title="row.value">{{ row.value }}</span>
      </template>
      <template #valueType="{ row }">
        <t-tag :theme="row.valueType === 'function' ? 'warning' : 'default'" variant="light" size="small">
          {{ row.valueType === 'function' ? t.i18nMessages.typeFunction : t.i18nMessages.typeText }}
        </t-tag>
      </template>
      <template #operation="{ row }">
        <t-button
          v-if="canEdit && row.valueType === 'text'"
          size="small"
          variant="text"
          theme="primary"
          @click="emit('edit', row as I18nMessage)"
        >
          {{ t.i18nMessages.editBtn }}
        </t-button>
        <span v-else class="i18n-readonly">—</span>
      </template>
    </t-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Locale } from '@/types/locale';
import type { I18nMessage } from '@/types/i18n';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 当前页记录 */
  rows: I18nMessage[];
  /** 是否正在加载 */
  loading: boolean;
  /** 是否允许编辑 */
  canEdit: boolean;
}>();

const emit = defineEmits<{
  /** 点击编辑某条文案 */
  (e: 'edit', row: I18nMessage): void;
}>();

/** 表格列（跟随语言切换刷新标题） */
const columns = computed(() => [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'lang', title: props.t.i18nMessages.langLabel, width: 80 },
  { colKey: 'namespace', title: props.t.i18nMessages.colNamespace, width: 140 },
  { colKey: 'keyPath', title: props.t.i18nMessages.colKeyPath, width: 260, ellipsis: true },
  { colKey: 'value', title: props.t.i18nMessages.colValue },
  { colKey: 'valueType', title: props.t.i18nMessages.colType, width: 100 },
  { colKey: 'operation', title: props.t.i18nMessages.colActions, width: 90 },
]);
</script>

<style scoped>
.i18n-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.i18n-value-cell {
  display: block;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.i18n-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  font-size: 13px;
  color: var(--text-muted);
}

.i18n-readonly {
  color: var(--text-muted);
}
</style>
