<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.aiChatAdmin.pageTitle"
    :subtitle="t.aiChatAdmin.subtitle"
  >
    <template #actions>
      <t-button variant="outline" size="large" @click="load">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </template>

    <card-panel :title="t.aiChatAdmin.listTitle" icon="chart-bubble" icon-theme="primary">
      <template #title-extra>
        <span class="ai-admin-total">{{ t.aiChatAdmin.totalRuns(total) }}</span>
      </template>

      <div class="filter-bar">
        <t-radio-group :value="scope" @change="handleScopeChange">
          <t-radio-button value="me">{{ t.aiChatAdmin.scopeMe }}</t-radio-button>
          <t-radio-button value="all" :disabled="!canSeeAll">
            {{ t.aiChatAdmin.scopeAll }}
          </t-radio-button>
        </t-radio-group>
        <t-select
          :value="days"
          :options="daysOptions"
          class="ai-admin-days-select"
          @change="handleDaysChange"
        />
        <t-input
          v-model="keyword"
          :placeholder="t.aiChatAdmin.keywordPlaceholder"
          clearable
          class="ai-admin-keyword-input"
          @enter="onFilterChange"
          @clear="onFilterChange"
        />
        <t-button theme="primary" variant="outline" @click="onFilterChange">
          {{ t.common.search }}
        </t-button>
      </div>

      <t-table
        :data="items"
        :columns="columns"
        row-key="run_id"
        size="medium"
        :empty="t.aiChatAdmin.empty"
        hover
        stripe
        @row-click="onRowClick"
      >
        <template #status="{ row }">
          <t-tag :theme="statusTheme(row)" variant="light" size="small">{{ statusText(row) }}</t-tag>
        </template>
        <template #actions="{ row }">
          <t-button variant="text" theme="primary" size="small" @click.stop="openDetail(row)">
            {{ t.aiChatAdmin.viewDetail }}
          </t-button>
        </template>
      </t-table>

      <div v-if="total > pageSize" class="ai-admin-pagination">
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

    <t-drawer
      v-model:visible="drawerVisible"
      :header="t.aiChatAdmin.detailTitle"
      :footer="false"
      size="72%"
      attach="body"
      @close="closeDetail"
    >
      <run-detail-panel
        :t="t"
        :detail="detail"
        :loading="detailLoading"
        :tool-stats="toolStats"
      />
    </t-drawer>
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import RunDetailPanel from '@/components/ai-chat-admin/run-detail-panel.vue';
import { useAiChatAdminModel } from '@/models/ai-chat-admin-model';

const {
  t,
  items,
  total,
  page,
  pageSize,
  days,
  scope,
  keyword,
  daysOptions,
  canSeeAll,
  columns,
  drawerVisible,
  detail,
  detailLoading,
  toolStats,
  pageLoading,
  load,
  onFilterChange,
  onPageChange,
  onRowClick,
  openDetail,
  closeDetail,
  handleScopeChange,
  handleDaysChange,
  statusTheme,
  statusText,
} = useAiChatAdminModel();
</script>

<style scoped>
.ai-admin-total {
  font-size: 12px;
  color: var(--text-muted);
}

.ai-admin-days-select {
  width: 140px;
}

.ai-admin-keyword-input {
  width: 260px;
  flex: 0 0 260px;
  min-width: 180px;
}

.ai-admin-pagination {
  display: flex;
  padding-top: 16px;
}

@media (max-width: 768px) {
  .ai-admin-days-select {
    width: 100%;
  }

  .ai-admin-keyword-input {
    width: 100%;
    flex: 1 1 100%;
  }
}
</style>
