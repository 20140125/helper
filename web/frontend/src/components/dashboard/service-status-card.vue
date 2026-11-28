<template>
  <stat-card
    :label="label"
    :theme="running ? 'green' : 'red'"
    :value="running ? t.components.running : t.components.stopped"
    :value-color="running ? 'var(--accent-primary)' : 'var(--accent-red)'"
    :icon="icon"
    :icon-color="running ? 'var(--accent-primary)' : 'var(--accent-red)'"
    :icon-bg="running ? undefined : 'rgba(var(--accent-red-rgb, 244, 63, 94), 0.12)'"
    :icon-shadow="running ? undefined : '0 0 16px rgba(var(--accent-red-rgb, 244, 63, 94), 0.15)'"
  >
    <template #value-extra>
      <div v-if="running && pids.length > 0" class="inline-flex flex-col gap-1">
        <div
          v-for="item in pids"
          :key="item.label"
          class="font-mono text-xs px-2 py-1 rounded"
          style="color: var(--text-muted); background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.07); border: 1px solid rgba(var(--accent-primary-rgb, 99, 102, 241), 0.15);"
        >
          <span style="color: var(--text-secondary);">{{ item.label }}</span>
          &nbsp;·&nbsp;
          <span v-if="item.pid">PID: {{ item.pid }}</span>
          <span v-else style="opacity: 0.5;">{{ t.components.processNotRunning }}</span>
        </div>
      </div>
      <p v-else-if="!running" class="stat-desc">{{ t.components.processNotStarted }}</p>
    </template>

    <template #extra>
      <div v-if="showControls" class="flex flex-row gap-2.5 mt-3 flex-wrap">
        <t-button
          v-if="!running"
          size="large"
          theme="success"
          variant="outline"
          block
          @click="emit('start')"
        >
          <template #icon><t-icon name="play-circle" /></template>
          {{ t.common.start }}
        </t-button>
        <t-button
          v-if="running"
          size="large"
          theme="danger"
          variant="outline"
          style="flex: 1"
          @click="emit('stop')"
        >
          <template #icon><t-icon name="stop-circle" /></template>
          {{ t.common.stop }}
        </t-button>
        <t-button
          v-if="running"
          size="large"
          variant="outline"
          style="flex: 1"
          @click="emit('restart')"
        >
          <template #icon><t-icon name="refresh" /></template>
          {{ t.common.restart }}
        </t-button>
      </div>
    </template>
  </stat-card>
</template>

<script setup lang="ts">
import StatCard from '@/components/common/stat-card.vue';
import type { PidItem } from '@/types/web-service';
import type { Locale } from '@/locales/zh';

withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 卡片标签 */
  label: string;
  /** 右上角图标 */
  icon: string;
  /** 服务是否运行中 */
  running: boolean;
  /** PID 列表，每项包含标签和 PID 值 */
  pids?: PidItem[];
  /** 按钮加载状态 */
  loading?: boolean;
  /** 是否显示启停控制按钮（权限控制） */
  showControls?: boolean;
}>(), {
  pids: () => [],
  loading: false,
  showControls: true,
});

const emit = defineEmits<{
  /** 启动服务 */
  (e: 'start'): void;
  /** 停止服务 */
  (e: 'stop'): void;
  /** 重启服务 */
  (e: 'restart'): void;
}>();
</script>
