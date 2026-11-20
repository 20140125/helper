<template>
  <page-layout :page-loading="pageLoading" :title="t.rbac.pagePermissions" :subtitle="t.rbac.pagePermissionsSubtitle">
    <template #actions>
      <t-button v-if="canEdit()" theme="primary" size="large" @click="openCreateDrawer">
        <template #icon><t-icon name="add" /></template>
        {{ t.rbac.createPermissionBtn }}
      </t-button>
    </template>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <t-input
        v-model="searchKeyword"
        :placeholder="t.rbac.searchPlaceholder"
        clearable
        size="large"
        style="width: 300px;"
      >
        <template #prefix-icon><t-icon name="search" /></template>
      </t-input>
      <t-button variant="outline" size="large" @click="loadPermissions">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
      <span class="text-xs" style="color: var(--text-muted); margin-left: auto;">
        {{ searchKeyword ? t.rbac.permissionFilterCount(filteredCount, totalCount) : t.rbac.permissionCount(totalCount) }}
      </span>
    </div>

    <!-- 权限列表：按分组展示，每组一张 card-panel -->
    <permission-group-panel
      v-for="group in filteredGroups"
      :key="group.group_id"
      :t="t"
      :group="group"
      :columns="columns"
      :can-edit="canEdit()"
      :is-mobile="isMobile"
      @edit="openEditDrawer"
    />

    <!-- 空状态 -->
    <card-panel
      v-if="filteredGroups.length === 0"
      :title="t.rbac.permissionsCardTitle"
      icon="lock-on"
      icon-theme="amber"
    >
      <div
        class="flex flex-col items-center py-12"
        style="color: var(--text-muted);"
      >
        <t-icon name="lock-on" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
        <p class="text-sm">{{ searchKeyword ? t.rbac.noPermissionMatch : t.rbac.noPermissions }}</p>
      </div>
    </card-panel>

    <!-- 权限表单抽屉（新增/编辑共用） -->
    <permission-form-drawer
      v-model:drawer-visible="permissionDrawerVisible"
      v-model:form-data="permissionFormData"
      :t="t"
      :header="isEditing ? t.rbac.drawerEditPermission : t.rbac.drawerCreatePermission"
      :mode="permissionFormMode"
      :is-mobile="isMobile"
      :form-fields="permissionFormFields"
      :set-form-ref="setFormRef"
      :readonly="!canEdit()"
      @confirm="submitPermission"
      @close="closeDrawer"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { usePermissionsModel } from '@/models/permissions-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import PermissionFormDrawer from '@/components/rbac/permission-form-drawer.vue';
import PermissionGroupPanel from '@/components/rbac/permission-group-panel.vue';

const {
  t,
  pageLoading,
  isMobile,
  searchKeyword,
  columns,
  filteredGroups,
  totalCount,
  filteredCount,
  permissionDrawerVisible,
  isEditing,
  permissionFormMode,
  permissionFormData,
  permissionFormFields,
  setFormRef,
  loadPermissions,
  canEdit,
  openCreateDrawer,
  openEditDrawer,
  closeDrawer,
  submitPermission,
} = usePermissionsModel();
</script>

<style scoped>
@import '@/styles/common.css';
</style>
