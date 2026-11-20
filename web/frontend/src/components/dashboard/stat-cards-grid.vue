<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    <!-- Web 服务 -->
    <service-status-card
      :label="t.dashboard.webService"
      :t="t"
      icon="server"
      :running="webRunning"
      :pids="[
        { label: t.dashboard.webService, pid: webPid },
        { label: t.dashboard.daemonProcess, pid: launcherPid },
      ]"
      :show-controls="canEdit(Permission.WEB_SERVICE_VIEW)"
      @start="emit('webStart')"
      @stop="emit('webStop')"
      @restart="emit('webRestart')"
    />

    <!-- 守护进程 -->
    <service-status-card
      :t="t"
      :label="t.dashboard.daemonProcess"
      :icon="statusStore.daemonRunning ? 'check-circle' : 'close-circle'"
      :running="statusStore.daemonRunning"
      :pids="[
        { label: t.dashboard.dailyReminder, pid: statusStore.daemonPid },
        { label: t.dashboard.annualScheduler, pid: statusStore.annualPid },
      ]"
      :show-controls="canEdit(Permission.DAEMON_VIEW)"
      @start="emit('daemonStart')"
      @stop="emit('daemonStop')"
      @restart="emit('daemonRestart')"
    />

    <!-- 服务器时间 -->
    <stat-card
      :label="t.dashboard.serverTime"
      theme="green"
      :value="displayServerTime"
      desc="Asia/Hong_Kong"
      icon="time"
    >
      <template #extra>
        <div class="flex flex-col gap-1.5 mt-3">
          <div class="flex items-center gap-2">
            <t-icon name="calendar" style="color: var(--accent-primary); opacity: 0.7;" size="13px" />
            <span class="text-xs" style="color: var(--text-muted);">{{ todayWeekday }}</span>
          </div>
          <div v-if="statusStore.daemonRunning && daemonUptime" class="flex items-center gap-2">
            <t-icon name="time" style="color: var(--accent-primary); opacity: 0.7;" size="13px" />
            <span class="text-xs" style="color: var(--text-muted);">{{ t.dashboard.processUptime(daemonUptime) }}</span>
          </div>
        </div>
      </template>
    </stat-card>

    <!-- 缓存文件（入口已收起，仍可直连 /cache 兜底） -->
    <info-stat-card
      :label="t.menu.cache"
      theme="violet"
      :value="statusStore.cacheFiles"
      :desc="t.dashboard.descCacheFiles"
      icon="file"
      route-name="cache"
      :extra-path="statusStore.projectDir ? statusStore.projectDir + '/cache' : undefined"
    />

    <!-- 自定义规则 -->
    <info-stat-card
      :label="t.menu.rules"
      theme="indigo"
      :value="rulesStore.rules.length"
      :desc="t.dashboard.enabledRules(enabledRulesCount)"
      icon="filter"
      route-name="rules"
      :tags="ruleTypeSummary"
      :empty-text="t.rules.noRules"
    />
  </div>
</template>

<script setup lang="ts">
import ServiceStatusCard from '@/components/dashboard/service-status-card.vue';
import InfoStatCard from '@/components/dashboard/info-stat-card.vue';
import StatCard from '@/components/common/stat-card.vue';
import { Permission } from '@/models/base-model';
import type { useStatusStore } from '@/stores/status';
import type { useRulesStore } from '@/stores/rules';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 状态存储 */
  statusStore: ReturnType<typeof useStatusStore>;
  /** 规则存储 */
  rulesStore: ReturnType<typeof useRulesStore>;
  /** 是否有权限 */
  canEdit: (permission: Permission) => boolean;
  /** Web 服务是否运行中 */
  webRunning: boolean;
  /** Web服务PID */
  webPid: number | null;
  /** 启动器PID */
  launcherPid: number | null;
  /** 显示服务器时间 */
  displayServerTime: string;
  /** 今天是周几 */
  todayWeekday: string;
  /** 守护进程运行时间 */
  daemonUptime: string;
  /** 启用的规则数量 */
  enabledRulesCount: number;
  /** 规则类型摘要 */
  ruleTypeSummary: Array<{type: string, label: string, count: number}>;
}>();

const emit = defineEmits<{
  /** 启动 Web 服务 */
  (e: 'webStart'): void;
  /** 停止 Web 服务 */
  (e: 'webStop'): void;
  /** 重启 Web 服务 */
  (e: 'webRestart'): void;
  /** 启动守护进程 */
  (e: 'daemonStart'): void;
  /** 停止守护进程 */
  (e: 'daemonStop'): void;
  /** 重启守护进程 */
  (e: 'daemonRestart'): void;
}>();

</script>
