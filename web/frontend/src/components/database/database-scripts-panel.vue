<template>
  <card-panel :title="t.database.scriptsTitle" icon="folder" icon-theme="secondary">
    <template #title-extra>
      <span class="text-xs" style="color: var(--text-muted);">
        {{ t.database.scriptsCount(scripts.length) }}
      </span>
    </template>

    <div class="db-scripts">
      <div class="db-scripts-side">
        <t-input
          v-model="keywordModel"
          clearable
          :placeholder="t.database.scriptSearchPlaceholder"
        />
        <div class="db-scripts-list custom-scrollbar-sm">
          <div v-if="scripts.length === 0" class="empty-tip">
            {{ keywordModel ? t.database.noMatchingScripts : t.database.noScripts }}
          </div>
          <side-list-item
            v-for="script in scripts"
            :key="script.path"
            :active="selectedScript === script.path"
            icon="file-code"
            :title="script.path"
            :meta="metaText(script)"
            @click="emit('select', script.path)"
          />
        </div>
      </div>
      <div class="db-scripts-content">
        <div class="db-sub-title">{{ t.database.scriptPreviewTitle }}</div>
        <sql-editor
          v-if="selectedScript"
          :content="content"
          :readonly="true"
          min-height="320px"
          max-height="320px"
        />
        <div v-else class="empty-tip">{{ t.database.scriptSelectHint }}</div>
      </div>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import SideListItem from '@/components/common/side-list-item.vue';
import SqlEditor from '@/components/common/sql-editor.vue';
import { formatBytes } from '@/utils/database';
import type { Locale } from '@/locales/zh';
import type { DatabaseScriptFile } from '@/types/database';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 按关键字过滤后的脚本清单 */
  scripts: DatabaseScriptFile[];
  /** 当前查看的脚本路径 */
  selectedScript: string;
  /** 当前查看的脚本正文 */
  content: string;
}>();

const emit = defineEmits<{
  /** 选中一个 SQL 脚本 */
  (e: 'select', path: string): void;
}>();

/** 脚本搜索关键字（v-model:keyword，Vue 3.4+ defineModel 语法糖） */
const keywordModel = defineModel<string>('keyword', { required: true });

const metaText = (script: DatabaseScriptFile): string => {
  const moduleName = script.module === 'entry'
    ? props.t.database.scriptEntry
    : script.module;
  return `${moduleName} · ${formatBytes(script.size)}`;
};
</script>

<style scoped>
@import "@/styles/common.css";
@import "@/styles/scrollbar.css";

.db-scripts {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

/* 左侧搜索框 + 列表跟随右侧内容高度填满，避免底部留出空缺 */
.db-scripts-side {
  display: flex;
  flex-direction: column;
  min-width: 0;
  contain: size;
  height: 0;
  min-height: 100%;
  overflow: hidden;
}

.db-scripts-side :deep(.t-input) {
  flex-shrink: 0;
}

.db-scripts-list {
  flex: 1;
  min-height: 0;
  margin-top: 10px;
  overflow-y: auto;
}

.db-scripts-content {
  min-width: 0;
}

.db-sub-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .db-scripts {
    grid-template-columns: 1fr;
  }

  /* 单列时没有右侧可跟随：解除 contain/0 高度，列表改回限高滚动 */
  .db-scripts-side {
    contain: none;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .db-scripts-list {
    flex: none;
    max-height: min(380px, 50vh);
  }
}
</style>
