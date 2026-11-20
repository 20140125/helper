<template>
  <page-layout :page-loading="pageLoading" :title="t.dashboard.pageTitle" :subtitle="t.dashboard.subtitle">
    <template #actions>
      <t-button
        variant="outline"
        size="large"
        @click="refresh"
      >
        <template #icon><t-icon name="refresh" /></template>
        {{ t.dashboard.refreshAll }}
      </t-button>
    </template>

    <!-- 状态卡片网格 -->
    <stat-cards-grid
      :t="t"
      :status-store="statusStore"
      :rules-store="rulesStore"
      :can-edit="canEdit"
      :web-running="webRunning"
      :web-pid="webPid"
      :launcher-pid="launcherPid"
      :web-loading="webLoading"
      :daemon-loading="daemonLoading"
      :display-server-time="displayServerTime"
      :today-weekday="todayWeekday"
      :daemon-uptime="daemonUptime"
      :enabled-rules-count="enabledRulesCount"
      :rule-type-summary="ruleTypeSummary"
      @web-start="webStart"
      @web-stop="webStop"
      @web-restart="webRestart"
      @daemon-start="daemonStart"
      @daemon-stop="daemonStop"
      @daemon-restart="daemonRestart"
    />

    <!-- 日志概览 + 项目信息 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <!-- 日志文件概览 -->
      <logs-overview-panel
        :t="t"
        :recent-logs="recentLogs"
        :logs-loading="logsLoading"
        :active-log-key="activeLogKey"
        :active-log-content="activeLogContent"
        :content-loading="contentLoading"
        :log-labels="logLabels"
        @load-logs="loadLogs"
        @toggle-log="toggleLog"
        @go-to-logs="goToLogs"
      />

      <!-- 项目信息与快捷操作 -->
      <div class="flex flex-col gap-5">
        <quick-actions-panel
          :t="t"
          :status-store="statusStore"
          :server-info-items="serverInfoItems"
          @go-to-trigger="goToTrigger"
          @go-to-logs="goToLogs"
        />
      </div>
    </div>
  </page-layout>
</template>

<script setup lang="ts">
import { useDashboardModel } from '@/models/dashboard-model';
import PageLayout from '@/components/common/page-layout.vue';
import StatCardsGrid from '@/components/dashboard/stat-cards-grid.vue';
import LogsOverviewPanel from '@/components/dashboard/logs-overview-panel.vue';
import QuickActionsPanel from '@/components/dashboard/quick-actions-panel.vue';

const {
  t,
  statusStore,
  rulesStore,
  canEdit,
  recentLogs,
  logLabels,
  logsLoading,
  daemonLoading,
  pageLoading,
  enabledRulesCount,
  ruleTypeSummary,
  todayWeekday,
  daemonUptime,
  activeLogKey,
  activeLogContent,
  contentLoading,
  loadLogs,
  refresh,
  daemonStart,
  daemonStop,
  daemonRestart,
  toggleLog,
  goToLogs,
  goToTrigger,
  webRunning,
  webPid,
  launcherPid,
  webLoading,
  webStart,
  webStop,
  webRestart,
  serverInfoItems,
  displayServerTime,
} = useDashboardModel();
</script>
