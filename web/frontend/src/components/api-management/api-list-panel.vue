<template>
  <card-panel
    :title="group.categoryName"
    icon="api"
    icon-theme="primary"
  >
    <template #title-extra>
      <span class="text-xs" style="color: var(--text-muted);">
        {{ t.apiManagement.totalCount(group.items.length) }}
      </span>
    </template>

    <!-- 空态 -->
    <div
      v-if="group.items.length === 0"
      class="flex flex-col items-center py-12"
      style="color: var(--text-muted);"
    >
      <t-icon name="api" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
      <p class="text-sm">{{ t.apiManagement.noApis }}</p>
    </div>

    <!-- API 表格 -->
    <t-table
      v-else
      :data="group.items"
      :columns="apiColumns"
      row-key="id"
      hover
      stripe
      size="medium"
    >
      <template #method="{ row }">
        <t-tag :theme="METHOD_THEME[row.method]" variant="light" size="small">
          {{ row.method }}
        </t-tag>
      </template>
      <template #category_id="{ row }">
        <span style="color: var(--text-secondary);">{{ categoryNameMap[row.category_id] || '-' }}</span>
      </template>
      <template #enabled="{ row }">
        <t-switch
          :value="row.enabled"
          :disabled="!canEdit"
          @change="(val: boolean) => emit('toggleEnabled', { id: row.id, val })"
        />
      </template>
      <template #actions="{ row }">
        <div class="flex gap-2">
          <t-button
            variant="text"
            size="small"
            theme="primary"
            @click="emit('execute', row)"
          >
            <template #icon><t-icon name="play-circle" /></template>
          </t-button>
          <t-button
            v-if="canEdit"
            variant="text"
            size="small"
            @click="emit('edit', row)"
          >
            <template #icon><t-icon name="edit" /></template>
          </t-button>
          <t-popconfirm :content="t.apiManagement.deleteApiConfirm" @confirm="emit('delete', row.id)">
            <t-button
              v-if="canEdit"
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
import { computed } from 'vue';
import CardPanel from '@/components/common/card-panel.vue';
import { METHOD_THEME } from '@/constants/api-management';
import { useLocaleStore } from '@/stores/locale';
import type { ApiGroup, ApiItem } from '@/types/api-management';

defineProps<{
  /** API 分组 */
  group: ApiGroup;
  /** API 列表列配置 */
  apiColumns: unknown[];
  /** 分类名称映射 */
  categoryNameMap: Record<string, string>;
  /** 是否可编辑 */
  canEdit: boolean;
}>();

const emit = defineEmits<{


  /** 执行 API 调用 */
  (e: 'execute', row: ApiItem): void;
  /** 编辑 API */
  (e: 'edit', row: ApiItem): void;
  /** 删除 API，参数为 API ID */
  (e: 'delete', id: string): void;
  /** 切换 API 启用状态 */
  (e: 'toggleEnabled', payload: { id: string; val: boolean 



}): void;
}>();

const localeStore = useLocaleStore();
const t = computed(() => localeStore.t);
</script>
