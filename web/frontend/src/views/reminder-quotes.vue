<template>
  <page-layout :page-loading="pageLoading" :title="t.reminderQuotes.pageTitle" :subtitle="t.reminderQuotes.subtitle">
    <template #actions>
      <t-button
      v-if="canEdit()"
        theme="primary"
        size="large"
        @click="openCreate"
      >
        <template #icon><t-icon name="add" /></template>
        {{ t.reminderQuotes.createBtn }}
      </t-button>
    </template>

    <div class="filter-bar">
      <t-select
        :value="filterScene"
        :options="sceneOptions"
        :placeholder="t.reminderQuotes.scenePlaceholder"
        size="large"
        style="width: 160px;"
        clearable
        @change="onSceneChange"
      />
      <t-select
        v-model="filterBucket"
        :options="bucketOptions"
        :placeholder="t.reminderQuotes.bucketPlaceholder"
        size="large"
        style="width: 260px;"
        clearable
        filterable
      />
      <t-input
        v-model="keyword"
        :placeholder="t.reminderQuotes.keywordPlaceholder"
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

    <!-- 提醒寄语列表：按场景分组展示，每组一张 card-panel（对齐 api-management 风格） -->
    <reminder-quotes-list-panel
      v-for="group in filteredGroups"
      :key="group.scene"
      :t="t"
      :group="group"
      :columns="columns"
      :can-edit="canEdit"
      :view-permission="Permission.REMINDER_QUOTES_VIEW"
      :get-bucket-label="getBucketLabel"
      :get-row-preview="getRowPreview"
      @edit="openEdit"
      @delete="removeItem"
    />

    <!-- 没有任何条目 -->
    <card-panel
      v-if="filteredGroups.length === 0"
      :title="t.reminderQuotes.listTitle"
      icon="chat"
      icon-theme="secondary"
    >
      <div
        class="flex flex-col items-center py-12"
        style="color: var(--text-muted);"
      >
        <t-icon name="chat" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
        <p class="text-sm">{{ t.reminderQuotes.noItems }}</p>
      </div>
    </card-panel>

    <form-drawer
      v-model="quoteDrawerVisible"
      :header="editingQuote ? t.reminderQuotes.editHeader : t.reminderQuotes.createHeader"
      :mode="quoteFormMode"
      :t="t"
      :is-mobile="isMobile"
      :readonly="!canEdit()"
      @confirm="submitForm(quoteFormData)"
      @close="closeDrawer"
    >
      <auto-form
        v-model="quoteFormData"
        :fields="quoteFormFields"
      />
    </form-drawer>
  </page-layout>
</template>

<script setup lang="ts">
import { useReminderQuotesModel } from '@/models/reminder-quotes-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import ReminderQuotesListPanel from '@/components/reminder-quotes/reminder-quotes-list-panel.vue';
import '@/styles/common.css';

const {
  t,
  pageLoading,
  isMobile,
  canEdit,

  filterScene,
  filterBucket,
  keyword,
  filteredGroups,
  sceneOptions,
  bucketOptions,
  columns,
  quoteFormFields,

  quoteDrawerVisible,
  editingQuote,
  quoteFormMode,
  quoteFormData,

  loadItems,
  onSceneChange,
  openCreate,
  openEdit,
  closeDrawer,
  submitForm,
  removeItem,
  getBucketLabel,
  getRowPreview,

  Permission,
} = useReminderQuotesModel();
</script>
