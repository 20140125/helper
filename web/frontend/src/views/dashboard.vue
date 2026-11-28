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

    <!-- 项目信息与快捷操作 -->
    <quick-actions-panel
      :t="t"
      :status-store="statusStore"
      :server-info-items="serverInfoItems"
      @go-to-trigger="goToTrigger"
      @go-to-logs="goToLogs"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { useDashboardModel } from '@/models/dashboard-model';
import PageLayout from '@/components/common/page-layout.vue';
import StatCardsGrid from '@/components/dashboard/stat-cards-grid.vue';
import QuickActionsPanel from '@/components/dashboard/quick-actions-panel.vue';

const {
  t,
  statusStore,
  rulesStore,
  canEdit,
  daemonLoading,
  pageLoading,
  enabledRulesCount,
  ruleTypeSummary,
  todayWeekday,
  daemonUptime,
  refresh,
  daemonStart,
  daemonStop,
  daemonRestart,
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
