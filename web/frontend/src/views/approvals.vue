<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.approvals.pageTitle"
    :subtitle="t.approvals.subtitle"
  >
    <template #actions>
      <t-button variant="outline" size="large" @click="load">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.approvals.refreshBtn }}
      </t-button>
    </template>

    <!-- 状态 Tab（一次拉全量，切换走本地过滤） -->
    <div class="apr-tabs">
      <t-radio-group v-model="statusFilter" variant="default-filled" size="large">
        <t-radio-button value="all">
          {{ t.approvals.tabAll }}
          <t-tag v-if="counts.all > 0" size="small" theme="warning" style="margin-left: 4px;">
            {{ counts.all }}
          </t-tag>
        </t-radio-button>
        <t-radio-button value="pending">
          {{ t.approvals.tabPending }}
          <t-tag v-if="counts.pending > 0" size="small" theme="warning" style="margin-left: 4px;">
            {{ counts.pending }}
          </t-tag>
        </t-radio-button>
        <t-radio-button value="executed">
          {{ t.approvals.tabExecuted }}
          <t-tag v-if="counts.executed > 0" size="small" theme="success" style="margin-left: 4px;">
            {{ counts.executed }}
          </t-tag>
        </t-radio-button>
        <t-radio-button value="rejected">
          {{ t.approvals.tabRejected }}
          <t-tag v-if="counts.rejected > 0" size="small" theme="default" style="margin-left: 4px;">
            {{ counts.rejected }}
          </t-tag>
        </t-radio-button>
        <t-radio-button value="failed">
          {{ t.approvals.tabFailed }}
          <t-tag v-if="counts.failed > 0" size="small" theme="danger" style="margin-left: 4px;">
            {{ counts.failed }}
          </t-tag>
        </t-radio-button>
      </t-radio-group>
    </div>

    <!-- 审批单表格 -->
    <card-panel
      :title="t.approvals.tableTitle"
      icon="check-circle"
      icon-theme="primary"
      style="margin-top: 16px;"
    >
      <t-table
        :data="filteredApprovals"
        :columns="columns"
        row-key="id"
        size="medium"
        :empty="t.approvals.noRecords"
        hover
        stripe
      >
        <!-- 待执行工具 -->
        <template #tool="{ row }">
          <code class="apr-code">{{ row.tool }}</code>
        </template>

        <!-- 工具参数 -->
        <template #args="{ row }">
          <span class="apr-args">{{ formatArgs(row.args) }}</span>
        </template>

        <!-- 申请理由 -->
        <template #reason="{ row }">
          <span :style="{ color: row.reason ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: row.reason ? 'normal' : 'italic' }">
            {{ row.reason || t.approvals.noReason }}
          </span>
        </template>

        <!-- 状态 -->
        <template #status="{ row }">
          <t-tag :theme="statusTheme(row.status)" variant="light" size="small">
            {{ statusLabel(row.status) }}
          </t-tag>
        </template>

        <!-- 创建时间 -->
        <template #created_at="{ row }">
          <span class="apr-time">{{ formatTime(row.created_at) }}</span>
        </template>

        <!-- 执行结果 / 决策人 -->
        <template #result="{ row }">
          <span v-if="row.result" class="apr-result">{{ row.result }}</span>
          <span v-else-if="row.decided_by" class="apr-time">
            {{ t.approvals.decidedBy(row.decided_by) }}
          </span>
          <span v-else class="apr-time">—</span>
        </template>

        <!-- 操作：仅待审批单可决策 -->
        <template #actions="{ row }">
          <div v-if="row.status === 'pending' && isAdmin" class="apr-actions">
            <t-button
              theme="success"
              variant="outline"
              size="small"
              :loading="actingId === row.id"
              @click="approve(row)"
            >
              {{ t.approvals.btnApprove }}
            </t-button>
            <t-button
              theme="danger"
              variant="outline"
              size="small"
              :loading="actingId === row.id"
              @click="reject(row)"
            >
              {{ t.approvals.btnReject }}
            </t-button>
          </div>
          <span v-else-if="row.status === 'pending'" class="apr-time">
            {{ t.approvals.adminOnly }}
          </span>
          <span v-else class="apr-time">{{ formatTime(row.decided_at) }}</span>
        </template>
      </t-table>
    </card-panel>
  </page-layout>
</template>

<script setup lang="ts">
import { useApprovalsModel } from '@/models/approvals-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';

const {
  t,
  isAdmin,
  pageLoading,
  statusFilter,
  counts,
  filteredApprovals,
  actingId,
  columns,
  load,
  approve,
  reject,
  formatTime,
  formatArgs,
  statusTheme,
  statusLabel,
} = useApprovalsModel();
</script>

<style scoped>
.apr-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.apr-code {
  font-size: 12px;
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.08);
  color: var(--accent-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

.apr-args {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.apr-time {
  color: var(--text-muted);
  font-size: 12px;
}

.apr-result {
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-word;
}

.apr-actions {
  display: flex;
  gap: 8px;
}
</style>
