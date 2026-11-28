<template>
  <card-panel
    :title="group.label"
    icon="chat"
    icon-theme="secondary"
  >
    <template #title-extra>
      <span class="text-xs" style="color: var(--text-muted);">
        {{ t.reminderQuotes.totalCount(group.items.length) }}
      </span>
    </template>

    <!-- 空态 -->
    <div
      v-if="group.items.length === 0"
      class="flex flex-col items-center py-12"
      style="color: var(--text-muted);"
    >
      <t-icon name="chat" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
      <p class="text-sm">{{ t.reminderQuotes.noItems }}</p>
    </div>

    <!-- 场景条目表格 -->
    <t-table
      v-else
      :data="group.items"
      :columns="columns"
      row-key="id"
      hover
      stripe
      size="medium"
      :bordered="true"
    >
      <template #bucket="{ row }">
        <t-tag theme="primary" variant="light-outline">{{ getBucketLabel(row.bucket) }}</t-tag>
      </template>
      <template #preview="{ row }">
        <span :title="row.content">{{ getRowPreview(row) }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex gap-2">
          <t-button
            v-if="canEdit(viewPermission)"
            variant="text"
            size="small"
            @click="emit('edit', row)"
          >
            <template #icon><t-icon name="edit" /></template>
          </t-button>
          <t-popconfirm :content="t.reminderQuotes.deleteConfirm" @confirm="emit('delete', row.id)">
            <t-button
              v-if="canEdit(viewPermission)"
              variant="text"
              theme="danger"
              size="small"
            >
              <template #icon><t-icon name="delete" /></template>
            </t-button>
          </t-popconfirm>
        </div>
      </template>
    </t-table>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import type { ReminderQuoteItem, ReminderQuotesBucket, ReminderQuotesGroupBucket } from '@/types/reminder-quotes';
import type { Permission } from '@/types/permission';
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 当前分组（场景 + 标签 + 条目列表） */
  group: ReminderQuotesGroupBucket;
  /** t-table 列定义 */
  columns: unknown[];
  /** 权限校验函数：传入操作权限返回是否允许 */
  canEdit: (perm?: Permission) => boolean;
  /** 当前页面的查看权限标识 */
  viewPermission: Permission;
  /** 通过 bucket 取标签文案 */
  getBucketLabel: (bucket: ReminderQuotesBucket) => string;
  /** 通过条目取预览文案（截断长文本等） */
  getRowPreview: (row: ReminderQuoteItem) => string;
}>();

const emit = defineEmits<{
  /** 编辑条目 */
  (e: 'edit', row: ReminderQuoteItem): void;
  /** 删除条目，参数为条目 ID */
  (e: 'delete', id: string): void;
}>();

</script>
