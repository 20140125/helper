<template>
  <div class="permissions-section" :class="{ 'permissions-section--readonly': readonly }">
    <!-- 顶部操作栏：全选 + 统计 -->
    <div class="permissions-toolbar">
      <t-checkbox
        :checked="isAllChecked"
        :indeterminate="isIndeterminate"
        :disabled="readonly"
        @change="(val: boolean) => emit('toggleAll', val)"
      >
        <span class="text-sm font-medium">{{ t.rbac.selectAll }}</span>
      </t-checkbox>
      <span class="permissions-count-inline">
        {{ t.rbac.selectedCount(selectedCount, totalCount) }}
      </span>
    </div>
    <!-- 分组列表 -->
    <div class="permissions-group-list">
      <div v-for="(group, idx) in permissionGroups" :key="group.group_id" class="permissions-group">
        <div class="permissions-group-header" :class="{ 'permissions-group-header--first': idx === 0 }">
          <t-checkbox
            :checked="isGroupAllChecked(group)"
            :indeterminate="isGroupIndeterminate(group)"
            :disabled="readonly"
            @change="(val: boolean) => emit('toggleGroup', group, val)"
          >
            <span class="permissions-group-name">{{ group.group_name }}</span>
          </t-checkbox>
          <span class="permissions-group-badge">{{ groupCheckedCount(group) }}/{{ group.items.length }}</span>
        </div>
        <div class="permissions-group-items">
          <label
            v-for="item in group.items"
            :key="item.code"
            class="permissions-item"
            :class="{ 'permissions-item--checked': modelValue.includes(item.code as string) }"
          >
            <t-checkbox
              :checked="modelValue.includes(item.code as string)"
              :disabled="readonly"
              @change="(val: boolean) => emit('toggle', item.code as string, val)"
            >
              <t-tooltip :content="item.description" placement="top">
                <span class="permissions-item-label">{{ item.label }}</span>
              </t-tooltip>
            </t-checkbox>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PermissionGroup } from '@/types/rbac';
import type { Locale } from '@/types/locale';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 当前已选中的权限码列表 */
  modelValue: string[];
  /** 按分组归类的权限列表 */
  permissionGroups: PermissionGroup[];
  /** 所有可用权限码总数 */
  totalCount: number;
  /** 是否全部已勾选 */
  isAllChecked: boolean;
  /** 是否半选状态 */
  isIndeterminate: boolean;
  /** 检查某个分组是否全部勾选 */
  isGroupAllChecked: (group: PermissionGroup) => boolean;
  /** 检查某个分组是否部分勾选 */
  isGroupIndeterminate: (group: PermissionGroup) => boolean;
  /** 只读模式（仅展示，不可修改） */
  readonly?: boolean;
}>();

const emit = defineEmits<{
  /** 全选/全不选 */
  (e: 'toggleAll', checked: boolean): void;
  /** 切换某个分组 */
  (e: 'toggleGroup', group: PermissionGroup, checked: boolean): void;
  /** 切换单个权限 */
  (e: 'toggle', code: string, checked: boolean): void;
}>();

/** 当前已选数量 */
const selectedCount = computed(() => props.modelValue.length);

/** 计算分组内已勾选的权限数量 */
const groupCheckedCount = (group: PermissionGroup): number => {
  return group.items.filter((item) => props.modelValue.includes(item.code as string)).length;
};
</script>

<style scoped>
/* 权限配置区域 */
.permissions-section {
  width: 100%;
}

/* 顶部操作栏：全选 + 已选统计 */
.permissions-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
}

.permissions-count-inline {
  font-size: 12px;
  color: var(--text-muted);
}

.permissions-count-inline strong {
  color: var(--accent-primary);
  font-weight: 600;
}

/* 分组列表容器 */
.permissions-group-list {
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

/* 单个分组 */
.permissions-group {
  border-bottom: 1px solid var(--border-color);
}

.permissions-group:last-child {
  border-bottom: none;
}

/* 分组头部 */
.permissions-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

.permissions-group-header--first {
  border-top: none;
}

.permissions-group-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.permissions-group-badge {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.04));
  padding: 1px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

/* 子项网格 */
.permissions-group-items {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 8px 12px;
}

/* 单个权限项 */
.permissions-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.permissions-item:hover {
  background: var(--bg-secondary);
}

.permissions-item--checked {
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.06);
}

.permissions-item--checked:hover {
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1);
}

.permissions-item-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.permissions-item--checked .permissions-item-label {
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .permissions-group-items {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
