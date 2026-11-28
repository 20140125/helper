<template>
  <card-panel
    :title="group.group_name"
    icon="lock-on"
    icon-theme="amber"
  >
    <template #title-extra>
      <span class="text-xs" style="color: var(--text-muted);">
        {{ t.rbac.permissionCount(group.items.length) }}
      </span>
    </template>

    <!-- 空态 -->
    <div
      v-if="group.items.length === 0"
      class="flex flex-col items-center py-12"
      style="color: var(--text-muted);"
    >
      <t-icon name="lock-on" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
      <p class="text-sm">{{ t.rbac.noPermissions }}</p>
    </div>

    <!-- 权限条目表格 -->
    <t-table
      v-else
      :data="group.items"
      :columns="columns"
      row-key="code"
      hover
      stripe
      size="medium"
      :bordered="true"
    >
      <!-- 权限码列 -->
      <template #code="{ row }">
        <code class="perm-code">{{ asPerm(row).code }}</code>
      </template>

      <!-- 类型列：view / edit 标签 -->
      <template #type="{ row }">
        <span
          class="perm-type-tag"
          :class="asPerm(row).type === 'view' ? 'is-view' : 'is-edit'"
        >
          {{ asPerm(row).type === 'view' ? t.rbac.typeView : t.rbac.typeEdit }}
        </span>
      </template>

      <!-- 路由列 -->
      <template #route="{ row }">
        <span v-if="!asPerm(row).route" class="perm-route-empty">—</span>
        <code v-else class="perm-route">{{ asPerm(row).route }}</code>
      </template>

      <!-- 操作列 -->
      <template #operate="{ row }">
        <t-button
          v-if="canEdit"
          variant="text"
          theme="primary"
          size="medium"
          style="cursor: pointer;"
          @click="emit('edit', asPerm(row))"
        >
          <template v-if="isMobile" #icon>
            <t-icon name="edit" size="16px" />
          </template>
          <template v-if="!isMobile">{{ t.rbac.btnEdit }}</template>
        </t-button>
      </template>
    </t-table>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import type { Locale } from '@/types/locale';
import type { PermissionGroup, PermissionMeta } from '@/types/rbac';
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';

const emit = defineEmits<{
  /** 点击编辑按钮，回传当前行数据 */
  (e: 'edit', row: PermissionMeta): void;
}>();

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 权限分组数据 */
  group: PermissionGroup;
  /** t-table 列定义（外部组装好的列描述符，仅含元信息：colKey/title/width 等） */
  columns: PrimaryTableCol[];
  /** 当前用户是否拥有编辑权限（控制操作列按钮显隐） */
  canEdit: boolean;
  /** 是否移动端布局（控制操作列按钮形态：图标 vs 文字） */
  isMobile: boolean;
}>();

/**
 * 行数据类型断言 helper
 * @description 将 t-table 插槽透出的宽泛 TableRowData 收敛为 PermissionMeta，
 *              使模板中无需直接书写 as 断言（遵循"模板内禁用 as"规约）
 * @param {TableRowData} row 表格行数据（来源数据为 PermissionGroup.items，类型安全由数据源保证）
 * @returns {PermissionMeta} 权限元数据
 */
const asPerm = (row: TableRowData): PermissionMeta => row as unknown as PermissionMeta;
</script>

<style scoped>
.perm-code {
  font-family: monospace;
  font-size: 12px;
  color: var(--accent-primary);
}

.perm-type-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.perm-type-tag.is-view {
  background: var(--accent-primary-light, rgba(var(--accent-primary-rgb), 0.12));
  color: var(--accent-primary);
}

.perm-type-tag.is-edit {
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.perm-route {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.perm-route-empty {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
