<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.rbac.pageRoles"
    :subtitle="t.rbac.pageRolesSubtitle"
    :disable-anchor="true"
  >
    <template v-if="isSuperAdmin && canEdit()" #actions>
      <t-button theme="primary" size="large" @click="handleCreateRole">        <template #icon><t-icon name="add" /></template>
        {{ t.rbac.createRoleBtn }}
      </t-button>
    </template>

    <role-manage-panel
      :t="t"
      :roles="roles"
      :is-super-admin="isSuperAdmin"
      :can-edit="canEdit()"
      :permission-metas="permissionMetas"
      :all-permissions="allPermissions"
      @edit-role="handleEditRole"
      @delete-role="handleDeleteRole"
    />

    <!-- 角色编辑抽屉 -->
    <role-form-drawer
      v-model:drawer-visible="roleDrawerVisible"
      v-model:form-data="roleFormData"
      :t="t"
      :is-mobile="isMobile"
      :mode="roleFormMode"
      :all-permissions="allPermissions"
      :permission-groups="permissionSelection.permissionGroups"
      :editing-role="editingRole"
      :form-fields="roleFormFields"
      :is-all-permissions-checked="permissionSelection.isAllChecked"
      :is-all-permissions-indeterminate="permissionSelection.isIndeterminate"
      :is-group-all-checked="permissionSelection.isGroupAllChecked"
      :is-group-indeterminate="permissionSelection.isGroupIndeterminate"
      :set-role-form-ref="setRoleFormRef"
      @submit-role-form="submitRoleForm"
      @close-role-dialog="closeRoleDrawer"
      @toggle-all-permissions="permissionSelection.toggleAll"
      @toggle-group-permissions="permissionSelection.toggleGroup"
      @handle-permission-toggle="permissionSelection.toggle"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { useRbacModel } from '@/models/rbac-model';
import PageLayout from '@/components/common/page-layout.vue';
import RoleManagePanel from '@/components/rbac/role-manage-panel.vue';
import RoleFormDrawer from '@/components/rbac/role-form-drawer.vue';

const {
  t,
  pageLoading,
  isMobile,
  roles,
  permissionMetas,
  allPermissions,
  permissionSelection,
  isSuperAdmin,
  roleDrawerVisible,
  editingRole,
  roleFormMode,
  roleFormData,
  roleFormFields,
  setRoleFormRef,
  handleCreateRole,
  canEdit,
  handleEditRole,
  submitRoleForm,
  handleDeleteRole,
  closeRoleDrawer,
} = useRbacModel();
</script>
