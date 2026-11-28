<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.cacheAdmin.pageTitle"
    :subtitle="t.cacheAdmin.subtitle"
    :disable-anchor="true"
  >
    <template #actions>
      <t-button variant="outline" size="large" :loading="pageLoading" @click="refresh">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
      <t-button v-if="canEditCache()" theme="primary" size="large" @click="openCreate">
        <template #icon><t-icon name="add" /></template>
        {{ t.common.add }}
      </t-button>
    </template>

    <card-panel :title="t.cacheAdmin.listTitle" icon="server" icon-theme="secondary">
      <template #title-extra>
        <span class="cache-admin-total">{{ t.cacheAdmin.totalLabel }} {{ total }}</span>
      </template>

      <div class="cache-admin-filters">
        <div class="cache-admin-filter-field">
          <span class="cache-admin-filter-label">{{ t.cacheAdmin.filterTable }}</span>
          <t-select
            v-model="table"
            :options="tableOptions"
            class="cache-admin-filter-table"
            @change="handleTableChange"
          />
        </div>

        <div class="cache-admin-filter-field">
          <span class="cache-admin-filter-label">{{ t.cacheAdmin.filterPeriod }}</span>
          <t-select
            v-model="periodType"
            :options="periodOptions"
            class="cache-admin-filter-period"
            @change="handlePeriodChange"
          />
        </div>

        <div class="cache-admin-filter-field cache-admin-filter-field--grow">
          <span class="cache-admin-filter-label">{{ t.cacheAdmin.filterKeyword }}</span>
          <t-input
            v-model="keyword"
            clearable
            :placeholder="t.cacheAdmin.keywordPlaceholder"
            @enter="handleSearch"
          />
        </div>

        <div class="cache-admin-filter-actions">
          <t-button theme="primary" @click="handleSearch">
            <template #icon><t-icon name="search" /></template>
            {{ t.common.search }}
          </t-button>
          <t-button variant="outline" @click="resetFilters">
            <template #icon><t-icon name="rollback" /></template>
            {{ t.common.reset }}
          </t-button>
        </div>
      </div>

      <cache-admin-table
        :t="t"
        :rows="rows"
        :loading="pageLoading"
        :can-edit="canEditCache()"
        @edit="openEdit"
        @delete="remove"
      />

      <div v-if="total > pageSize" class="cache-admin-pagination">
        <t-pagination
          v-model="page"
          :total="total"
          :page-size="pageSize"
          :total-content="false"
          :show-page-size="false"
          size="large"
          @change="onPageChange"
        />
      </div>
    </card-panel>

    <cache-admin-edit-drawer
      v-model:visible="drawerVisible"
      v-model:form="formData"
      :t="t"
      :fields="fields"
      :row="editing"
      :is-create="isCreate"
      :loading="saving || detailLoading"
      :readonly="!canEditCache()"
      :is-mobile="isMobile"
      @confirm="submitEdit"
    />
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import CacheAdminTable from '@/components/cache-admin/cache-admin-table.vue';
import CacheAdminEditDrawer from '@/components/cache-admin/cache-admin-edit-drawer.vue';
import { useCacheAdminModel } from '@/models/cache-admin-model';

const {
  t, pageLoading, isMobile, rows, total, table, periodType, keyword,
  tableOptions, periodOptions, page, pageSize, drawerVisible, formData, fields,
  editing, isCreate, saving, detailLoading, canEditCache, refresh,
  handleTableChange, handlePeriodChange, handleSearch, resetFilters,
  onPageChange, openCreate, openEdit, submitEdit, remove,
} = useCacheAdminModel();
</script>

<style scoped>
.cache-admin-total {
  font-size: 12px;
  color: var(--text-muted);
}

.cache-admin-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
  padding-bottom: 18px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.16));
}

.cache-admin-filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.cache-admin-filter-field--grow {
  flex: 0 0 240px;
}

.cache-admin-filter-label {
  font-size: 12px;
  line-height: 1;
  color: var(--text-muted);
}

.cache-admin-filter-table {
  width: 230px;
}

.cache-admin-filter-period {
  width: 140px;
}

.cache-admin-filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cache-admin-pagination {
  display: flex;
  justify-content: center;
  padding-top: 18px;
}

@media (max-width: 768px) {
  .cache-admin-filter-actions,
  .cache-admin-filter-table,
  .cache-admin-filter-period {
    width: 100%;
  }
}
</style>
