<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.logs.pageTitle"
    :subtitle="t.logs.subtitle"
    :disable-anchor="true"
  >
    <!-- 移动端：日志文件选择器 -->
    <div class="panel-mobile-select">
      <t-select
        :value="activeKey"
        size="large"
        :placeholder="t.logs.selectPlaceholder"
        @change="selectLog"
      >
        <template #valueDisplay="{ value }">
          <div class="panel-select-option">
            <t-icon name="file-paste" size="14px" style="color: var(--accent-secondary); flex-shrink: 0;" />
            <span>{{ LOG_LABELS[value] }}</span>
          </div>
        </template>
        <t-option
          v-for="log in logs"
          :key="log.key"
          :value="log.key"
          :label="LOG_LABELS[log.key]"
        >
          <template #default>
            <div class="panel-select-option">
              <t-icon name="file-paste" size="14px" style="color: var(--accent-secondary); flex-shrink: 0;" />
              <span>{{ LOG_LABELS[log.key] }}</span>
              <t-tag v-if="!log.exists" size="small" theme="default" variant="light" class="log-empty-tag">{{ t.logs.noFile }}</t-tag>
            </div>
          </template>
        </t-option>
      </t-select>
    </div>

    <!-- 主体：左右两栏 -->
    <div class="panel-layout">
      <!-- 左侧日志列表 -->
      <card-panel
        :title="t.logs.fileListTitle"
        icon="file-paste"
        icon-theme="secondary"
        class="panel-list"
        full-height
      >
        <template #title-extra>
          <span class="text-xs" style="color: var(--text-muted);">{{ t.logs.logCount(logs.length) }}</span>
        </template>
          <side-list-item
            v-for="log in logs"
            :key="log.key"
            :active="activeKey === log.key"
            icon="file-paste"
            :title="LOG_LABELS[log.key]"
            :size="log.exists ? log.size : undefined"
            :mtime="log.mtime"
            :class="{ 'log-item-empty': !log.exists }"
            @click="selectLog(log.key)"
          >
            <template v-if="!log.exists" #extra>
              <t-tag size="small" theme="default" variant="light" class="log-empty-tag">{{ t.logs.noFile }}</t-tag>
            </template>
          </side-list-item>
      </card-panel>

      <!-- 右侧日志内容 -->
      <card-panel
        :title="activeKey ? LOG_LABELS[activeKey] : t.logs.selectPlaceholder"
        icon="file-code"
        icon-theme="secondary"
        class="panel-main"
        full-height
      >
        <template #actions>
            <t-select
              v-model="lineCount"
              size="large"
              class="logs-line-select"
              @change="loadContent"
            >
              <t-option :value="50" :label="t.logs.lines(50)" />
              <t-option :value="100" :label="t.logs.lines(100)" />
              <t-option :value="200" :label="t.logs.lines(200)" />
              <t-option :value="500" :label="t.logs.lines(500)" />
            </t-select>
            <t-button
              variant="outline"
              size="large"
              @click="loadContent"
            >
              <template #icon><t-icon name="refresh" /></template>
              {{ t.common.refresh }}
            </t-button>
            <t-popconfirm
              v-if="canEdit()"
              :content="t.logs.clearConfirm"
              @confirm="clearLog"
            >
              <t-button
                variant="outline"
                theme="danger"
                size="large"
              >
                <template #icon><t-icon name="delete" /></template>
                {{ t.logs.clearBtn }}
              </t-button>
            </t-popconfirm>
        </template>

        <!-- 接口访问日志：使用美化的卡片式查看器 -->
        <access-log-viewer
          v-if="activeKey === 'access_log' || activeKey === 'access_log_backup'"
          :content="logContent"
          :t="t"
          :empty-text="t.logs.emptyHint"
        />

        <!-- 其他日志：使用通用纯文本查看器 -->
        <file-content
          v-else
          class="p-0"
          :filename="activeKey ? `${activeKey}.log` : ''"
          :t="t"
          :content="logContent"
          :empty-text="t.logs.emptyHint"
          :empty-content-text="t.logs.fileEmpty"
          :readonly="true"
        />
      </card-panel>
    </div>
  </page-layout>
</template>

<script setup lang="ts">
import { useLogsModel } from '@/models/logs-model';
import SideListItem from '@/components/common/side-list-item.vue';
import FileContent from '@/components/common/file-content.vue';
import AccessLogViewer from '@/components/common/access-log-viewer.vue';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';

const {
  t,
  logs,
  activeKey,
  logContent,
  lineCount,
  pageLoading,
  LOG_LABELS,
  canEdit,
  loadContent,
  selectLog,
  clearLog,
} = useLogsModel();
</script>

<style scoped>
@import "@/styles/panel-layout.css";

/* logs 独有样式 */
.log-item-empty {
  opacity: 0.55;
}

.log-empty-tag {
  font-size: 11px;
  padding: 0 5px;
  height: 18px;
  line-height: 18px;
  border-radius: 4px;
  color: var(--text-muted) !important;
  background: var(--bg-secondary) !important;
  border-color: transparent !important;
}

.logs-line-select {
  width: 110px;
}

@media (max-width: 768px) {
  .logs-line-select {
    width: 88px;
  }
}
</style>