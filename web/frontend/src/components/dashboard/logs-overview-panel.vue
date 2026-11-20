<template>
  <card-panel :title="t.dashboard.logsOverview" icon="file-paste" class="lg:col-span-2">
    <template #actions>
      <t-button
        variant="outline"
        size="large"
        @click="emit('loadLogs')"
      >
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </template>
    
    <!-- 加载中 -->
    <loading-spinner v-if="logsLoading" :t="t" :text="t.common.loading" :size="16" center padding-y="24px" />

    <!-- 加载完成 -->
    <template v-else>
      <div class="flex flex-col gap-3">
        <div
          v-for="log in recentLogs"
          :key="log.key"
        >
          <!-- 条目行 -->
          <div
            class="log-item"
            style="cursor: pointer;"
            @click="emit('toggleLog', log.key)"
          >
            <div class="log-dot log-dot-active" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium" style="color: var(--text-primary);">{{ logLabels[log.key] }}</p>
              <p class="text-xs mt-0.5 truncate" style="color: var(--text-muted);">
                {{ `${formatSize(log.size)} · ${log.mtime}` }}
              </p>
            </div>
            <t-icon
              :name="activeLogKey === log.key ? 'chevron-down' : 'chevron-right'"
              style="color: var(--text-muted); transition: transform 0.2s;"
              size="14px"
              class="flex-shrink-0"
            />
          </div>
          <!-- 内联日志内容 -->
          <div v-if="activeLogKey === log.key" class="px-2 pt-2 pb-3">
            <log-output
              :t="t"
              :stdout="activeLogContent"
              max-height="240px"
              font-size="11px"
              :empty-text="t.dashboard.logEmpty"
            />
          </div>
        </div>
        <div
          v-if="recentLogs.length === 0"
          class="text-sm text-center py-4"
          style="color: var(--text-muted);"
        >
          {{ t.dashboard.noLogs }}
        </div>
      </div>
      <div class="mt-4 pt-3" style="border-top: 1px solid var(--border-color);">
        <t-button
          variant="outline"
          size="small"
          block
          @click="emit('goToLogs')"
        >
          {{ t.dashboard.viewAllLogs }}
        </t-button>
      </div>
    </template>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import LogOutput from '@/components/common/log-output.vue';
import LoadingSpinner from '@/components/common/loading-spinner.vue';
import { formatSize } from '@/utils/format';
import type { LogItem } from '@/types/log';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 近期日志文件列表（面板只展示几条） */
  recentLogs: LogItem[];
  /** 日志列表加载中 */
  logsLoading: boolean;
  /** 当前展开查看的日志 key，未展开为空串 */
  activeLogKey: string;
  /** 当前日志的文本内容 */
  activeLogContent: string;
  /** 日志内容加载中 */
  contentLoading: boolean;
  /** key → 展示名映射（随 locale 变化） */
  logLabels: Record<string, string>;
}>();

const emit = defineEmits<{
  /** 刷新日志 */
  (e: 'loadLogs'): void;
  /** 切换日志 */
  (e: 'toggleLog', key: string): void;
  /** 跳转到日志页面 */
  (e: 'goToLogs'): void;
}>();

</script>
