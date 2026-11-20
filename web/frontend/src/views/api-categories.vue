<template>
  <page-layout :page-loading="pageLoading" :title="t.apiManagement.tabCategories" :subtitle="t.apiManagement.categoryPageSubtitle">
    <template #actions>
      <t-button
        v-if="canEdit()"
        theme="primary"
        size="large"
        @click="openCreateCategory"
      >
        <template #icon><t-icon name="add" /></template>
        {{ t.apiManagement.createCategoryBtn }}
      </t-button>
    </template>

    <card-panel :title="t.apiManagement.categoryListTitle" icon="folder" icon-theme="secondary">
      <template #actions>
        <div class="filter-bar">
          <t-button variant="outline" size="large" @click="loadCategories(true)">
            <template #icon><t-icon name="refresh" /></template>
            {{ t.common.refresh }}
          </t-button>
        </div>
      </template>
      <template #title-extra>
        <span class="text-xs" style="color: var(--text-muted);">
          {{ t.apiManagement.totalCount(categories.length) }}
        </span>
      </template>

      <div
        v-if="categories.length === 0"
        class="flex flex-col items-center py-12"
        style="color: var(--text-muted);"
      >
        <t-icon name="folder" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
        <p class="text-sm">{{ t.apiManagement.noCategories }}</p>
      </div>

      <t-table
        v-else
        :data="categories"
        :columns="categoryColumns"
        row-key="id"
        hover
        stripe
        size="medium"
      >
        <template #actions="{ row }">
          <div class="flex gap-2">
            <t-button
              v-if="canEdit()"
              variant="text"
              size="small"
              @click="openEditCategory(row)"
            >
              <template #icon><t-icon name="edit" /></template>
            </t-button>
            <t-popconfirm :content="t.apiManagement.deleteCategoryConfirm" @confirm="removeCategory(row.id)">
              <t-button
                v-if="canEdit()"
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

    <!-- 分类抽屉 -->
    <form-drawer
      v-model="categoryDrawerVisible"
      :t="t"
      :header="editingCategory ? t.apiManagement.editCategoryHeader : t.apiManagement.createCategoryHeader"
      :mode="categoryFormMode"
      :is-mobile="isMobile"
      :readonly="!canEdit()"
      @confirm="submitCategoryForm(categoryFormData)"
      @close="closeCategoryDrawer"
    >
      <auto-form
        v-model="categoryFormData"
        :fields="categoryFormFields"
      />
    </form-drawer>
  </page-layout>
</template>

<script setup lang="ts">
import { useApiCategoryModel } from '@/models/api-categories-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';

const {
  t,
  pageLoading,
  isMobile,
  canEdit,
  categories,
  categoryDrawerVisible,
  editingCategory,
  categoryFormMode,
  categoryFormData,
  loadCategories,
  openCreateCategory,
  openEditCategory,
  closeCategoryDrawer,
  submitCategoryForm,
  removeCategory,
  categoryColumns,
  categoryFormFields,
} = useApiCategoryModel();
</script>

<style scoped>
@import "@/styles/common.css";
</style>