<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.permissionRequests.pageTitle"
    :subtitle="t.permissionRequests.subtitle"
  >
    <template #actions>
      <t-button variant="outline" size="large" @click="load">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.permissionRequests.refreshBtn }}
      </t-button>
    </template>

    <!-- 状态 Tab 切换 -->
    <div class="pr-tabs">
      <t-radio-group v-model="statusFilter" variant="default-filled" size="large" @change="onStatusChange">
        <t-radio-button value="all">
          {{ t.permissionRequests.statusAll }}
          <t-tag v-if="pendingCount > 0" size="small" theme="warning" style="margin-left:4px;">
            {{ pendingCount }}
          </t-tag>
        </t-radio-button>
        <t-radio-button value="pending">{{ t.permissionRequests.statusPending }}</t-radio-button>
        <t-radio-button value="approved">{{ t.permissionRequests.statusApproved }}</t-radio-button>
        <t-radio-button value="rejected">{{ t.permissionRequests.statusRejected }}</t-radio-button>
      </t-radio-group>
      <span class="pr-total">{{ t.permissionRequests.totalCount(total) }}</span>
    </div>

    <!-- 数据表格 -->
    <card-panel :title="t.permissionRequests.tableTitle" icon="user-setting" icon-theme="primary" style="margin-top: 16px;">
      <t-table
        :data="items"
        :columns="columns"
        row-key="id"
        size="medium"
        :empty="t.permissionRequests.noRecords"
        hover
        stripe
      >
        <!-- 申请人 -->
        <template #applicant="{ row }">
          <span class="pr-email">{{ row.email }}</span>
        </template>

        <!-- 申请页面 -->
        <template #fromPath="{ row }">
          <code class="pr-path">{{ row.fromPath }}</code>
        </template>

        <!-- 申请原因 -->
        <template #reason="{ row }">
          <span :style="{ color: row.reason ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: row.reason ? 'normal' : 'italic' }">
            {{ row.reason || t.permissionRequests.noReason }}
          </span>
        </template>

        <!-- 状态 -->
        <template #status="{ row }">
          <t-tag
            :theme="statusTheme(row.status)"
            variant="light"
            size="small"
          >
            {{ t.permissionRequests[`tag${capitalize(row.status)}` as 'tagPending' | 'tagApproved' | 'tagRejected'] }}
          </t-tag>
        </template>

        <!-- 处理人 -->
        <template #resolvedBy="{ row }">
          <span v-if="row.resolvedBy" style="color: var(--text-muted); font-size: 12px;">
            {{ row.resolvedBy }}
          </span>
          <span v-else style="color: var(--text-muted); opacity: 0.4;">—</span>
        </template>

        <!-- 操作 -->
        <template #actions="{ row }">
          <div v-if="row.status === 'pending'" class="pr-actions">
            <t-button
              theme="success"
              variant="outline"
              size="small"
              @click="handleApprove(row)"
            >
              {{ t.permissionRequests.btnApprove }}
            </t-button>
            <t-button
              theme="danger"
              variant="outline"
              size="small"
              @click="openRejectDialog(row)"
            >
              {{ t.permissionRequests.btnReject }}
            </t-button>
          </div>
          <span v-else style="color: var(--text-muted); font-size: 12px;">
            {{ row.resolvedAt ?? '—' }}
          </span>
        </template>
      </t-table>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="pr-pagination">
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

    <!-- 拒绝对话框 -->
    <reject-form-drawer
      v-model:visible="rejectDialogVisible"
      v-model:reject-reason="rejectReason"
      :t="t"
      :reject-target="rejectTarget"
      :reject-submitting="rejectSubmitting"
      @confirm="submitReject"
      @close="closeRejectDialog"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { usePermissionRequestsModel } from '@/models/permission-requests-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import RejectFormDrawer from '@/components/permission-requests/reject-form-drawer.vue';

const {
  t,
  items,
  total,
  pendingCount,
  page,
  pageSize,
  statusFilter,
  rejectDialogVisible,
  rejectTarget,
  rejectReason,
  rejectSubmitting,
  pageLoading,
  columns,
  load,
  onStatusChange,
  onPageChange,
  handleApprove,
  openRejectDialog,
  closeRejectDialog,
  submitReject,
  statusTheme,
  capitalize,
} = usePermissionRequestsModel();
</script>

<style scoped>
.pr-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.pr-total {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: auto;
}

.pr-email {
  font-weight: 500;
  color: var(--accent-primary);
}

.pr-path {
  font-size: 12px;
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.08);
  color: var(--accent-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

.pr-actions {
  display: flex;
  gap: 8px;
}

.pr-pagination {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}


</style>
