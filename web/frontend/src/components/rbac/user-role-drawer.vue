<template>
  <form-drawer
    v-model="drawerVisible"
    :header="t.rbac.drawerEditUserRole"
    :t="t"
    :mode="FormMode.Edit"
    :is-mobile="isMobile"
    @confirm="$emit('submitUserRole')"
    @close="$emit('closeUserRoleDialog')"
  >
    <auto-form
      v-model="formData"
      :fields="formFields"
    >
      <!-- #append 插槽：将角色权限预览放入 auto-form 内部，保持 form-item 的布局节奏 -->
      <template #append>
        <t-form-item v-if="previewPermissions.length > 0" :label="t.rbac.permissionList" required-mark>
          <permission-checker
            :t="t"
            :model-value="previewPermissions"
            :permission-groups="permissionGroups"
            :total-count="allPermissions.length"
            :is-all-checked="isAllPermissionsChecked"
            :is-indeterminate="isAllPermissionsIndeterminate"
            :is-group-all-checked="isGroupAllChecked"
            :is-group-indeterminate="isGroupIndeterminate"
            readonly
          />
        </t-form-item>
      </template>
    </auto-form>
  </form-drawer>
</template>

<script setup lang="ts">
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import PermissionChecker from '@/components/rbac/permission-checker.vue';
import type { Locale } from '@/locales/zh';
import type { AutoFormField } from '@/types/auto-form';
import type { PermissionGroup } from '@/types/rbac';
import { FormMode } from '@/constants/form';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 是否为移动端 */
  isMobile: boolean;
  /** 表单字段配置 */
  formFields: AutoFormField[];
  /** 当前所选角色对应的权限码列表（仅用于只读展示） */
  previewPermissions: string[];
  /** 按分组归类的权限列表 */
  permissionGroups: PermissionGroup[];
  /** 所有可用权限码 */
  allPermissions: string[];
  /** 是否全部权限已勾选（基于 previewPermissions 计算） */
  isAllPermissionsChecked: boolean;
  /** 是否半选状态 */
  isAllPermissionsIndeterminate: boolean;
  /** 分组是否全部勾选 */
  isGroupAllChecked: (group: PermissionGroup) => boolean;
  /** 分组是否部分勾选 */
  isGroupIndeterminate: (group: PermissionGroup) => boolean;
}>();

/** 抽屉显示状态（v-model:drawerVisible，Vue 3.4+ defineModel 语法糖） */
const drawerVisible = defineModel<boolean>('drawerVisible', { required: true });
/** 表单数据（v-model:formData，Vue 3.4+ defineModel 语法糖） */
const formData = defineModel<Record<string, unknown>>('formData', { required: true });

defineEmits<{
  /** 提交用户角色变更 */
  (e: 'submitUserRole'): void;
  /** 关闭用户角色抽屉 */
  (e: 'closeUserRoleDialog'): void;
}>();
</script>

<style scoped>
.role-permissions-preview {
  margin-top: 16px;
}

.role-permissions-preview__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}
</style>
