<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.i18nMessages.pageTitle"
    :subtitle="t.i18nMessages.subtitle"
    :disable-anchor="true"
  >
    <template #actions>
      <t-button variant="outline" size="large" :loading="pageLoading" @click="refresh">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </template>

    <card-panel
      :title="t.i18nMessages.listTitle"
      icon="file-code"
      icon-theme="secondary"
    >
      <div class="i18n-filters">
        <div class="i18n-filter-field">
          <span class="i18n-filter-label">{{ t.i18nMessages.langLabel }}</span>
          <t-select
            v-model="lang"
            :options="langOptions"
            class="i18n-filter-lang"
            @change="handleLangChange"
          />
        </div>

        <div class="i18n-filter-field">
          <span class="i18n-filter-label">{{ t.i18nMessages.colNamespace }}</span>
          <t-select
          v-model="namespace"
          :options="namespaceOptions"
          class="i18n-filter-ns"
            @change="handleNamespaceChange"
          />
        </div>

        <div class="i18n-filter-field i18n-filter-field--grow">
          <span class="i18n-filter-label">{{ t.i18nMessages.filterKeyword }}</span>
          <t-input
            v-model="keyword"
            clearable
            :placeholder="t.i18nMessages.keywordPlaceholder"
            @enter="handleSearch"
          />
        </div>

        <div class="i18n-filter-actions">
          <t-button theme="primary" @click="handleSearch">
            <template #icon><t-icon name="search" /></template>
            {{ t.i18nMessages.searchBtn }}
          </t-button>
          <t-button variant="outline" @click="resetFilters">
            <template #icon><t-icon name="rollback" /></template>
            {{ t.i18nMessages.resetBtn }}
          </t-button>
        </div>
      </div>

      <i18n-message-table
        :t="t"
        :rows="rows"
        :loading="pageLoading"
        :can-edit="canEditMessages()"
        @edit="openEdit"
      />
    </card-panel>

    <i18n-message-edit-drawer
      v-model:visible="drawerVisible"
      v-model:form="formData"
      :t="t"
      :fields="fields"
      :row="editing"
      :loading="saving"
      :readonly="!canEditMessages()"
      :is-mobile="isMobile"
      @confirm="submitEdit"
    />
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import I18nMessageTable from '@/components/i18n-messages/i18n-message-table.vue';
import I18nMessageEditDrawer from '@/components/i18n-messages/i18n-message-edit-drawer.vue';
import { useI18nMessagesModel } from '@/models/i18n-messages-model';

const {
  t, pageLoading, isMobile, rows, lang, namespace, keyword,
  langOptions, namespaceOptions, drawerVisible, formData, fields,
  editing, saving, canEditMessages, refresh, handleLangChange, handleNamespaceChange,
  handleSearch, resetFilters, openEdit, submitEdit,
} = useI18nMessagesModel();
</script>

<style scoped>
.i18n-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
  padding-bottom: 18px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.16));
}

.i18n-filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.i18n-filter-field--grow {
  flex: 0 0 240px;
}

.i18n-filter-label {
  font-size: 12px;
  line-height: 1;
  color: var(--text-muted);
}

.i18n-filter-lang {
  width: 140px;
}

.i18n-filter-ns {
  width: 200px;
}

.i18n-filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .i18n-filter-actions {
    width: 100%;
  }

  .i18n-filter-lang,
  .i18n-filter-ns {
    width: 100%;
  }
}
</style>
