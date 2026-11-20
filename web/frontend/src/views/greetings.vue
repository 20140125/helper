<template>
  <page-layout :page-loading="pageLoading" :title="t.greetings.pageTitle" :subtitle="t.greetings.subtitle">
    <template #actions>
      <t-button
        v-if="canEdit()"
        theme="primary"
        size="large"
        @click="openCreate"
      >
        <template #icon><t-icon name="add" /></template>
        {{ t.greetings.createBtn }}
      </t-button>
    </template>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <t-select
        v-model="filterGroup"
        :options="groupOptions"
        :placeholder="t.greetings.filterGroupPlaceholder"
        size="large"
        style="width: 180px;"
        clearable
      />
      <t-input
        v-model="keyword"
        :placeholder="t.greetings.keywordPlaceholder"
        size="large"
        clearable
        style="width: 260px;"
      >
        <template #prefix-icon><t-icon name="search" /></template>
      </t-input>
      <t-button variant="outline" size="large" @click="loadItems(true)">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </div>

    <!-- 祝福语列表：按分组展示 -->
    <greetings-list-panel
      v-for="group in filteredGroups"
      :t="t"
      :key="group.group"
      :group="group"
      :columns="columns"
      :can-edit="canEdit"
      :view-permission="Permission.GREETINGS_VIEW"
      :get-group-label="getGroupLabel"
      :get-row-preview-html="getRowPreviewHtml"
      :get-row-full-html="getRowFullHtml"
      @edit="openEdit"
      @delete="removeItem"
    />

    <!-- 空状态 -->
    <card-panel
      v-if="filteredGroups.length === 0"
      :title="t.greetings.listTitle"
      icon="gift"
      icon-theme="secondary"
    >
      <div class="flex flex-col items-center py-12" style="color: var(--text-muted);">
        <t-icon name="gift" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
        <p class="text-sm">{{ t.greetings.noItems }}</p>
      </div>
    </card-panel>

    <!-- 新增/编辑抽屉 -->
    <greetings-form-drawer
      v-model:visible="greetingDrawerVisible"
      v-model:form-data="greetingFormData"
      :t="t"
      :mode="greetingFormMode"
      :is-mobile="isMobile"
      :can-edit="canEdit()"
      :editing-greeting="editingGreeting"
      :fields="greetingFormFields"
      @confirm="submitForm"
      @close="closeDrawer"
      @editor-change="onEditorChange"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { useGreetingsModel } from '@/models/greetings-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import GreetingsListPanel from '@/components/greetings/greetings-list-panel.vue';
import GreetingsFormDrawer from '@/components/greetings/greetings-form-drawer.vue';

const {
  t,
  pageLoading,
  isMobile,
  canEdit,

  filterGroup,
  keyword,
  filteredGroups,
  groupOptions,
  columns,
  greetingFormFields,

  greetingDrawerVisible,
  editingGreeting,
  greetingFormMode,
  greetingFormData,

  onEditorChange,

  loadItems,
  openCreate,
  openEdit,
  closeDrawer,
  submitForm,
  removeItem,
  getGroupLabel,
  getRowPreviewHtml,
  getRowFullHtml,

  Permission,
} = useGreetingsModel();
</script>

<style scoped>
@import '@/styles/common.css';
</style>
