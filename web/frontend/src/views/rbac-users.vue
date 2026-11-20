<template>
  <page-layout :page-loading="pageLoading" :title="t.rbac.pageUsers" :subtitle="t.rbac.pageUsersSubtitle">
    <user-manage-panel
      :users="users"
      :t="t"
      :is-super-admin="isSuperAdmin"
      :can-edit="canEdit()"
      :get-role-name="getRoleName"
      @edit-user-role="handleEditUserRole"
    />
    <!-- 用户角色编辑抽屉 -->
    <user-role-drawer
      v-model:drawer-visible="userRoleDrawerVisible"
      v-model:form-data="userRoleFormData"
      :t="t"
      :is-mobile="isMobile"
      :form-fields="userRoleFormFields"
      :preview-permissions="selectedUserRolePermissions"
      :permission-groups="userRolePermissionSelection.permissionGroups"
      :all-permissions="allPermissions"
      :is-all-permissions-checked="userRolePermissionSelection.isAllChecked"
      :is-all-permissions-indeterminate="userRolePermissionSelection.isIndeterminate"
      :is-group-all-checked="userRolePermissionSelection.isGroupAllChecked"
      :is-group-indeterminate="userRolePermissionSelection.isGroupIndeterminate"
      @submit-user-role="submitUserRole"
      @close-user-role-dialog="closeUserRoleDrawer"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { useRbacModel } from '@/models/rbac-model';
import PageLayout from '@/components/common/page-layout.vue';
import UserManagePanel from '@/components/rbac/user-manage-panel.vue';
import UserRoleDrawer from '@/components/rbac/user-role-drawer.vue';

const {
  t,
  pageLoading,
  isMobile,
  users,
  allPermissions,
  isSuperAdmin,
  canEdit,
  userRoleDrawerVisible,
  userRoleFormData,
  userRoleFormFields,
  userRolePermissionSelection,
  selectedUserRolePermissions,
  handleEditUserRole,
  submitUserRole,
  getRoleName,
  closeUserRoleDrawer,
} = useRbacModel();
</script>
