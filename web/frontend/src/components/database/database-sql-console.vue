<template>
  <card-panel :title="t.database.sqlTitle" icon="code" icon-theme="primary">
    <sql-editor
      :content="sqlInitial"
      :placeholder="t.database.sqlPlaceholder"
      :table-names="tableNames"
      @change="handleSqlChange"
      @submit="emit('run-query')"
    />
    <div class="db-sql-actions">
      <t-button theme="primary" :loading="running" @click="emit('run-query')">
        <template #icon><t-icon name="search" /></template>
        {{ t.database.runQueryBtn }}
      </t-button>
      <t-button
        v-if="canEdit"
        theme="danger"
        variant="outline"
        :loading="running"
        @click="emit('execute')"
      >
        <template #icon><t-icon name="play-circle" /></template>
        {{ t.database.executeBtn }}
      </t-button>
      <span class="db-sql-hint">{{ t.database.sqlShortcutHint }}</span>
    </div>

    <div v-if="result" class="db-sub-title">{{ t.database.resultTitle }}</div>
    <div v-if="!result" class="empty-tip">{{ t.database.resultIdle }}</div>
    <template v-else>
      <p class="db-hint">
        {{ t.database.resultMeta(result.rows.length, result.elapsedMs) }}
        · {{ t.database.affectedRows(result.affectedRows) }}
      </p>
      <p v-if="result.truncated" class="db-hint">{{ t.database.resultTruncated }}</p>
      <div v-if="rows.length === 0" class="empty-tip">{{ t.database.resultEmpty }}</div>
      <div v-else class="db-table-scroll custom-scrollbar-sm">
        <t-table
          :data="rows"
          :columns="columns"
          row-key="__row"
          hover
          stripe
          size="small"
        />
      </div>
    </template>
  </card-panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import CardPanel from '@/components/common/card-panel.vue';
import SqlEditor from '@/components/common/sql-editor.vue';
import type { Locale } from '@/types/locale';
import type { DatabaseTable, SqlExecution } from '@/types/database';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 库表清单，用于表名补全 */
  tables: DatabaseTable[];
  /** 最近一次 SQL 执行结果 */
  result: SqlExecution | null;
  /** 结果表格列配置 */
  columns: Array<Record<string, unknown>>;
  /** 结果表格行数据 */
  rows: Array<Record<string, unknown>>;
  /** SQL 执行中标记 */
  running: boolean;
  /** 是否允许执行写 SQL */
  canEdit: boolean;
}>();

const emit = defineEmits<{
  /** 执行只读查询 */
  (e: 'run-query'): void;
  /** 执行写 SQL */
  (e: 'execute'): void;
}>();

/** SQL 编辑器内容（v-model:sql，Vue 3.4+ defineModel 语法糖） */
const sqlModel = defineModel<string>('sql', { required: true });

/** SQL 冷值：仅初始化 / 外部重置时写入编辑器，用户输入不回写 */
const sqlInitial = ref(sqlModel.value);

/** 表名补全清单 */
const tableNames = computed<string[]>(() => props.tables.map((table) => table.name));

/** 最近一次由编辑器输入产生的文本，用于区分父组件外部写入 */
let editorText = sqlModel.value;

/** 编辑器输入回写热值 */
const handleSqlChange = (value: string): void => {
  editorText = value;
  sqlModel.value = value;
};

/** 父组件外部写入时同步冷值，交给编辑器更新文档 */
watch(() => sqlModel.value, (value: string) => {
  if (value === editorText) return;
  editorText = value;
  sqlInitial.value = value;
});
</script>

<style scoped>
@import "@/styles/common.css";
@import "@/styles/scrollbar.css";

.db-sql-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.db-sql-hint {
  margin-left: auto;
  align-self: center;
  font-size: 12px;
  color: var(--text-muted);
}

.db-sub-title {
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.db-table-scroll {
  overflow: auto;
  max-height: 360px;
}

.db-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
</style>
