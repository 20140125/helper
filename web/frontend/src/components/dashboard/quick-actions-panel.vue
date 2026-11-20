<template>
  <card-panel :title="t.dashboard.projectInfo" icon="folder" icon-theme="amber" class="flex-1">
    <div>
      <p class="text-xs mb-2" style="color: var(--text-muted);">{{ t.dashboard.projectDir }}</p>
      <p class="text-sm font-mono break-all px-3 py-2.5 rounded-lg" style="color: var(--accent-primary); background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.08); border: 1px solid var(--border-color);">
        {{ statusStore.projectDir }}
      </p>
    </div>

    <!-- 服务器信息 -->
    <div v-if="statusStore.hostname">
      <p class="text-xs mb-2.5" style="color: var(--text-muted);">{{ t.dashboard.serverInfo }}</p>
      <div class="flex flex-col gap-2">
        <div
          v-for="item in serverInfoItems"
          :key="item.label"
          class="flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg"
          style="background: rgba(var(--accent-amber-rgb, 245, 158, 11), 0.06); border: 1px solid rgba(var(--accent-amber-rgb, 245, 158, 11), 0.15);"
        >
          <span style="color: var(--text-muted);">{{ item.label }}</span>
          <span class="font-mono text-right" style="color: var(--text-primary); max-width: 60%; word-break: break-all;">{{ item.value }}</span>
        </div>
      </div>
    </div>

    <div>
      <p class="text-xs mb-3" style="color: var(--text-muted);">{{ t.dashboard.shortcuts }}</p>
      <div class="flex flex-col gap-2.5">
        <t-button
          variant="outline"
          size="large"
          block
          @click="emit('goToTrigger')"
        >
          <template #icon><t-icon name="play-circle" /></template>
          {{ t.dashboard.shortcutTrigger }}
        </t-button>
        <t-button
          variant="outline"
          size="large"
          block
          @click="emit('goToLogs')"
        >
          <template #icon><t-icon name="file-paste" /></template>
          {{ t.dashboard.shortcutLogs }}
        </t-button>
      </div>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import type { Locale } from '@/locales/zh';
import type { useStatusStore } from '@/stores/status';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 状态存储（源于 useStatusStore） */
  statusStore: ReturnType<typeof useStatusStore>;
  /** 服务器信息项列表（主机名 / 系统 / IP 等键值对） */
  serverInfoItems: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  /** 跳转到触发器页面 */
  (e: 'goToTrigger'): void;
  /** 跳转到日志页面 */
  (e: 'goToLogs'): void;
}>();

</script>
