<template>
  <page-layout :page-loading="pageLoading" :title="t.apiManagement.pageTitle" :subtitle="t.apiManagement.apiPageSubtitle">
    <template #actions>
      <t-button
        v-if="canEdit()"
        theme="primary"
        size="large"
        @click="openCreateItem"
      >
        <template #icon><t-icon name="add" /></template>
        {{ t.apiManagement.createApiBtn }}
      </t-button>
    </template>

    <!-- 分类过滤 -->
    <div class="filter-bar">
      <t-select
        v-model="selectedCategoryId"
        :placeholder="t.apiManagement.filterAllCategories"
        clearable
        size="large"
        style="width: 200px;"
      >
        <t-option
          v-for="opt in categoryOptions"
          :key="opt.value"
          :value="opt.value"
          :label="opt.label"
        />
      </t-select>
      <t-button variant="outline" size="large" @click="loadItems(true)">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </div>

    <!-- API 列表：按分类分组展示 -->
    <api-list-panel
      v-for="group in groupedItems"
      :key="group.category_id"
      :group="group"
      :api-columns="apiColumns"
      :category-name-map="categoryNameMap"
      :can-edit="canEdit()"
      @execute="openExecuteDrawer"
      @edit="openEditItem"
      @delete="removeItem"
      @toggle-enabled="({ id, val }) => toggleItemEnabled(id, val)"
    />

    <!-- 没有任何 API -->
    <card-panel
      v-if="groupedItems.length === 0"
      :title="t.apiManagement.apiListTitle"
      icon="api"
      icon-theme="primary"
    >
      <div
        class="flex flex-col items-center py-12"
        style="color: var(--text-muted);"
      >
        <t-icon name="api" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
        <p class="text-sm">{{ t.apiManagement.noApis }}</p>
      </div>
    </card-panel>

    <!-- API 条目抽屉 -->
    <form-drawer
      v-model="itemDrawerVisible"
      :header="editingItem ? t.apiManagement.editApiHeader : t.apiManagement.createApiHeader"
      :t="t"
      :mode="itemFormMode"
      :is-mobile="isMobile"
      :readonly="!canEdit()"
      @confirm="submitItemForm(itemFormData)"
      @close="closeItemDrawer"
    >
      <auto-form
        v-model="itemFormData"
        :fields="itemFormFields"
      />
    </form-drawer>

    <!-- API 执行抽屉 -->
    <form-drawer
      v-model="executeDrawerVisible"
      :t="t"
      :header="t.apiManagement.executeDrawerTitle"
      :confirm-text="t.apiManagement.executeSendBtn"
      :is-mobile="isMobile"
      :readonly="!canEdit()"
      @confirm="executeApi"
      @close="closeExecuteDrawer"
    >
      <api-execute-panel
        v-model:url="executeUrl"
        :executing-item="executingItem"
        :body-initial="executeBodyInitial"
        :headers="executeHeaders"
        :params="executeParams"
        :executing="executing"
        :result="executeResult"
        :error-message="executeError"
        :formatted-response-body="formattedResponseBody"
        :response-filename="responseFilename"
        :is-response-success="isResponseSuccess"
        @body-change="handleExecuteBodyChange"
        @add-header="addHeaderRow"
        @remove-header="removeHeaderRow"
        @add-param="addParamRow"
        @remove-param="removeParamRow"
        @execute="executeApi"
      />
    </form-drawer>
  </page-layout>
</template>

<script setup lang="ts">
import { useApiManagementModel } from '@/models/api-management-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import ApiListPanel from '@/components/api-management/api-list-panel.vue';
import ApiExecutePanel from '@/components/api-management/api-execute-panel.vue';

const {
  t,
  pageLoading,
  isMobile,
  canEdit,
  categoryOptions,
  categoryNameMap,
  groupedItems,
  selectedCategoryId,
  itemDrawerVisible,
  editingItem,
  itemFormMode,
  itemFormData,
  loadItems,
  openCreateItem,
  openEditItem,
  closeItemDrawer,
  submitItemForm,
  removeItem,
  toggleItemEnabled,
  executingItem,
  executeDrawerVisible,
  executing,
  executeUrl,
  executeBodyInitial,
  handleExecuteBodyChange,
  executeHeaders,
  executeParams,
  executeResult,
  executeError,
  formattedResponseBody,
  responseFilename,
  isResponseSuccess,
  openExecuteDrawer,
  closeExecuteDrawer,
  addHeaderRow,
  removeHeaderRow,
  addParamRow,
  removeParamRow,
  executeApi,
  apiColumns,
  itemFormFields,
} = useApiManagementModel();
</script>

<style scoped>
@import "@/styles/common.css";
</style>