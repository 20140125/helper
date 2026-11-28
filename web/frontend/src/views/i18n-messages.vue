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
      <t-alert theme="info" :message="t.i18nMessages.pairHint" class="i18n-pair-hint" />

      <div class="i18n-filters">
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

      <div class="i18n-table-wrap">
        <t-table
          :data="rows"
          :columns="columns"
          :loading="pageLoading"
          :empty="t.i18nMessages.emptyHint"
          row-key="keyPath"
          hover
          stripe
          size="small"
          style="min-width: 980px;"
        >
          <template #zh="{ row }">
            <t-input
              v-model="draft[row.keyPath].zh"
              size="small"
              :disabled="!canEditMessages() || row.hasFunction"
            />
          </template>
          <template #en="{ row }">
            <t-input
              v-model="draft[row.keyPath].en"
              size="small"
              :disabled="!canEditMessages() || row.hasFunction"
            />
          </template>
          <template #type="{ row }">
            <t-tag :theme="row.hasFunction ? 'warning' : 'default'" variant="light" size="small">
              {{ row.hasFunction ? t.i18nMessages.typeFunction : t.i18nMessages.typeText }}
            </t-tag>
          </template>
          <template #actions="{ row }">
            <t-button
              v-if="canEditMessages() && !row.hasFunction"
              size="small"
              theme="primary"
              :disabled="!pairChanged(row)"
              :loading="savingKey === row.keyPath"
              @click="savePair(row)"
            >
              {{ t.common.save }}
            </t-button>
            <span v-else>—</span>
          </template>
        </t-table>
      </div>

      <div v-if="total > pageSize" class="i18n-pagination">
        <t-pagination
          v-model="page"
          :total="total"
          :page-size="pageSize"
          :total-content="false"
          :show-page-size="false"
          size="small"
          @change="onPageChange"
        />
      </div>
    </card-panel>
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import { useI18nMessagesModel } from '@/models/i18n-messages-model';

const {
  t, pageLoading, rows, columns, namespace, keyword, namespaceOptions,
  page, pageSize, total, draft, savingKey, canEditMessages,
  pairChanged, refresh, handleNamespaceChange, handleSearch, resetFilters,
  onPageChange, savePair,
} = useI18nMessagesModel();
</script>

<style scoped>
.i18n-pair-hint {
  margin-bottom: 16px;
}

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

.i18n-filter-ns {
  width: 200px;
}

.i18n-filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.i18n-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.i18n-pagination {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}

@media (max-width: 768px) {
  .i18n-filter-actions,
  .i18n-filter-ns {
    width: 100%;
  }
}
</style>
