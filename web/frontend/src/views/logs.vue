<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.logs.pageTitle"
    :subtitle="t.logs.subtitle"
    :disable-anchor="true"
  >
    <template #actions>
      <t-button variant="outline" size="large" @click="load">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </template>

    <card-panel :title="t.logs.fileListTitle" icon="file-paste" icon-theme="primary">
      <template #title-extra>
        <span class="logs-total">{{ t.logs.logCount(total) }}</span>
      </template>

      <!-- 筛选栏 -->
      <div class="logs-filter-bar">
        <t-select
          v-model="sourceTypeFilter"
          :placeholder="t.logs.fieldType"
          :options="sourceTypeOptions"
          clearable
          filterable
          class="logs-source-type-select"
          @change="onFilterChange"
          @clear="onFilterChange"
        />
        <t-select
          v-model="levelFilter"
          :placeholder="t.logs.levelPlaceholder"
          :options="levelOptions"
          clearable
          filterable
          class="logs-level-select"
          @change="onFilterChange"
          @clear="onFilterChange"
        />
        <t-input
          v-model="keyword"
          :placeholder="t.logs.keywordPlaceholder"
          clearable
          class="logs-keyword-input"
          @enter="onFilterChange"
          @clear="onFilterChange"
        />
        <t-button theme="primary" variant="outline" @click="onFilterChange">
          {{ t.common.search }}
        </t-button>
      </div>

      <!-- 日志记录表格 -->
      <t-table
        :data="items"
        :columns="columns"
        row-key="id"
        size="medium"
        :empty="t.logs.emptyHint"
        :expanded-row-keys="expandedRowKeys"
        :expand-icon="false"
        hover
        stripe
        @row-click="onRowClick"
      >
        <template #level="{ row }">
          <t-tag :theme="levelTheme(row.level)" variant="light" size="small">{{ row.level }}</t-tag>
        </template>
        <template #source="{ row }">
          <span class="logs-source">{{ sourceLabel(row.source) }}</span>
        </template>
        <template #address="{ row }">
          <span class="logs-address" :title="addressOf(row)">{{ addressOf(row) || '-' }}</span>
        </template>
        <template #actions="{ row }">
          <t-button variant="text" theme="primary" size="small" @click.stop="openDetail(row)">
            {{ t.logs.viewDetail }}
          </t-button>
        </template>
        <!-- 详情按记录展开：点击哪行就显示在哪行下方 -->
        <template #expandedRow="{ row }">
          <div class="logs-expanded-row" @click.stop>
            <log-detail-panel
              :t="t"
              :detail="detail && detail.id === row.id ? detail : null"
              :loading="detailLoading"
              :source-name="detail && detail.id === row.id ? sourceLabel(detail.source) : ''"
              @close="closeDetail"
            />
          </div>
        </template>
      </t-table>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="logs-pagination">
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
  </page-layout>
</template>

<script setup lang="ts">
import { useLogsModel } from '@/models/logs-model';
import LogDetailPanel from '@/components/logs/log-detail-panel.vue';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';

const {
  t,
  items,
  total,
  page,
  pageSize,
  sourceTypeFilter,
  levelFilter,
  keyword,
  detail,
  detailLoading,
  pageLoading,
  columns,
  expandedRowKeys,
  sourceTypeOptions,
  levelOptions,
  load,
  onFilterChange,
  onPageChange,
  onRowClick,
  openDetail,
  closeDetail,
  levelTheme,
  sourceLabel,
  addressOf,
} = useLogsModel();
</script>

<style scoped>
.logs-total {
  font-size: 12px;
  color: var(--text-muted);
}

.logs-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.logs-level-select,
.logs-source-type-select {
  width: 150px;
}

.logs-keyword-input {
  width: 260px;
  flex: 0 1 260px;
  min-width: 180px;
}

.logs-source {
  font-size: 13px;
}

.logs-address {
  display: block;
  overflow: hidden;
  min-width: 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logs-expanded-row {
  padding: 8px 0 12px;
}

.logs-pagination {
  display: flex;
  /* justify-content: center; */
  padding-top: 16px;
}

@media (max-width: 768px) {
  .logs-source-type-select,
  .logs-level-select {
    width: 100%;
  }

  .logs-keyword-input {
    width: 100%;
    flex: 1 1 100%;
  }
}
</style>
