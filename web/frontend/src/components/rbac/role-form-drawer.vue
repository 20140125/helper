<template>
  <form-drawer
    v-model="drawerVisible"
    :t="t"
    :header="editingRole ? t.rbac.drawerEditRole : t.rbac.drawerCreateRole"
    :mode="mode"
    :is-mobile="isMobile"
    @confirm="$emit('submitRoleForm')"
    @close="$emit('closeRoleDialog')"
  >
    <auto-form
      :ref="setRoleFormRef"
      v-model="formData"
      :fields="formFields"
    >
      <!-- 使用 #content-permissions 插槽自定义分组 checkbox -->
      <template #content-permissions>
        <permission-checker
          :t="t"
          :model-value="(formData.permissions as string[]) ?? []"
          :permission-groups="permissionGroups"
          :total-count="allPermissions.length"
          :is-all-checked="isAllPermissionsChecked"
          :is-indeterminate="isAllPermissionsIndeterminate"
          :is-group-all-checked="isGroupAllChecked"
          :is-group-indeterminate="isGroupIndeterminate"
          @toggle-all="(val: boolean) => $emit('toggleAllPermissions', val)"
          @toggle-group="(group, val) => $emit('toggleGroupPermissions', group, val)"
          @toggle="(code, val) => $emit('handlePermissionToggle', code, val)"
        />
      </template>
    </auto-form>
  </form-drawer>
</template>

<script setup lang="ts">
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import PermissionChecker from '@/components/rbac/permission-checker.vue';
import type { RoleConfig, PermissionGroup } from '@/types/rbac';
import type { AutoFormField } from '@/types/auto-form';
import type { FormMode } from '@/constants/form';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 是否为移动端 */
  isMobile: boolean;
  /** 表单模式：Create=新增，Edit=编辑 */
  mode: FormMode;
  /** 全量权限码列表（用于计算覆盖率） */
  allPermissions: string[];
  /** 按分组归类的权限列表 */
  permissionGroups: PermissionGroup[];
  /** 当前正在编辑的角色配置（新增时为 null） */
  editingRole: RoleConfig | null;
  /** 表单字段配置 */
  formFields: AutoFormField[];
  /** 是否全部权限已勾选 */
  isAllPermissionsChecked: boolean;
  /** 是否半选状态（部分勾选） */
  isAllPermissionsIndeterminate: boolean;
  /** 分组是否全部勾选 */
  isGroupAllChecked: (group: PermissionGroup) => boolean;
  /** 分组是否部分勾选 */
  isGroupIndeterminate: (group: PermissionGroup) => boolean;
  /** 设置 auto-form ref 的回调 */
  setRoleFormRef: (el: unknown) => void;
}>();

/** 抽屉显示状态（v-model:drawerVisible，Vue 3.4+ defineModel 语法糖） */
const drawerVisible = defineModel<boolean>('drawerVisible', { required: true });
/** 表单数据（v-model:formData，Vue 3.4+ defineModel 语法糖） */
const formData = defineModel<Record<string, unknown>>('formData', { required: true });

defineEmits<{
  /** 提交角色表单 */
  (e: 'submitRoleForm'): void;
  /** 关闭角色抽屉 */
  (e: 'closeRoleDialog'): void;
  /** 全选/全反选权限，参数为目标勾选状态 */
  (e: 'toggleAllPermissions', checked: boolean): void;
  /** 切换分组权限，参数为分组与目标勾选状态 */
  (e: 'toggleGroupPermissions', group: PermissionGroup, checked: boolean): void;
  /** 切换单个权限，参数为权限码与目标勾选状态 */
  (e: 'handlePermissionToggle', code: string, checked: boolean): void;
}>();
</script>
