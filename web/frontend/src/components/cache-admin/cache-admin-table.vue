<template>
  <div class="cache-admin-table-wrap">
    <div v-if="rows.length === 0 && !loading" class="cache-admin-empty">
      <t-icon name="info-circle" size="20px" />
      <span>{{ t.cacheAdmin.emptyHint }}</span>
    </div>
    <t-table
      v-else
      :data="tableRows"
      :columns="columns"
      row-key="_rowKey"
      hover
      stripe
      size="small"
      :loading="loading"
    >
      <template #periodType="{ row }">
        <t-tag :theme="periodTheme(row.periodType)" variant="light" size="small">
          {{ cachePeriodLabel(row.periodType, props.t) }}{{ row.periodKey ? ` · ${row.periodKey}` : '' }}
        </t-tag>
      </template>
      <template #size="{ row }">{{ formatCacheSize(row.size) }}</template>
      <template #updatedAt="{ row }">{{ formatCacheTime(row.updatedAt) }}</template>
      <template #operation="{ row }">
        <t-button
          v-if="canEdit"
          size="small"
          variant="text"
          theme="primary"
          @click="onEdit(row)"
        >
          {{ t.common.edit }}
        </t-button>
        <t-popconfirm v-if="canEdit" :content="t.cacheAdmin.deleteConfirm" @confirm="onDelete(row)">
          <t-button size="small" variant="text" theme="danger">{{ t.common.delete }}</t-button>
        </t-popconfirm>
        <span v-if="!canEdit" class="cache-admin-readonly">—</span>
      </template>
    </t-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cachePeriodLabel, formatCacheSize, formatCacheTime } from '@/utils/cache-admin';
import type { Locale } from '@/types/locale';
import type { CacheAdminEntry, CacheAdminPeriod } from '@/types/cache-admin';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 当前页记录 */
  rows: CacheAdminEntry[];
  /** 是否正在加载 */
  loading: boolean;
  /** 是否允许编辑 */
  canEdit: boolean;
}>();

const emit = defineEmits<{
  /** 点击编辑某条缓存记录 */
  (e: 'edit', row: CacheAdminEntry): void;
  /** 点击删除某条缓存记录（已走 popconfirm 确认） */
  (e: 'delete', row: CacheAdminEntry): void;
}>();

/** 带唯一行键的表格数据（同一缓存键可能出现在多张表） */
const tableRows = computed(() => props.rows.map((row) => ({
  ...row,
  _rowKey: `${row.table}|${row.section}|${row.entryKey}`,
})));

/** 表格列（跟随语言切换刷新标题） */
const columns = computed(() => [
  { colKey: 'table', title: props.t.cacheAdmin.colTable, width: 210, ellipsis: true },
  { colKey: 'section', title: props.t.cacheAdmin.colSection, width: 110, ellipsis: true },
  { colKey: 'entryKey', title: props.t.cacheAdmin.colKey, width: 220, ellipsis: true },
  { colKey: 'preview', title: props.t.cacheAdmin.colPreview, ellipsis: true },
  { colKey: 'periodType', title: props.t.cacheAdmin.colPeriod, width: 150 },
  { colKey: 'size', title: props.t.cacheAdmin.colSize, width: 100 },
  { colKey: 'updatedAt', title: props.t.cacheAdmin.colUpdated, width: 170 },
  { colKey: 'operation', title: props.t.cacheAdmin.colActions, width: 130 },
]);

/** 粒度标签主题 */
const periodTheme = (value: CacheAdminPeriod): string =>
  (value === 'day' ? 'primary' : value === 'static' ? 'default' : 'success');

/** 转发表格行到编辑事件 */
const onEdit = (row: unknown): void => emit('edit', row as CacheAdminEntry);

/** 转发表格行到删除事件 */
const onDelete = (row: unknown): void => emit('delete', row as CacheAdminEntry);
</script>

<style scoped>
.cache-admin-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.cache-admin-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  font-size: 13px;
  color: var(--text-muted);
}

.cache-admin-readonly {
  color: var(--text-muted);
}
</style>
