<template>
  <div class="db-browser">
    <card-panel
      :title="t.database.tablesTitle"
      icon="server"
      icon-theme="secondary"
      class="db-browser-list"
    >
      <template #title-extra>
        <span class="text-xs" style="color: var(--text-muted);">
          {{ t.database.tableCount(tables.length) }}
        </span>
      </template>
      <t-input
        v-model="keywordModel"
        clearable
        :placeholder="t.database.tableSearchPlaceholder"
      />
      <div v-if="tables.length === 0" class="empty-tip">{{ t.database.noTables }}</div>
      <div v-else class="db-table-list custom-scrollbar-sm">
        <side-list-item
          v-for="table in tables"
          :key="table.name"
          :active="selectedTable === table.name"
          icon="server"
          :title="table.name"
          :meta="metaText(table)"
          @click="emit('select', table.name)"
        />
      </div>
    </card-panel>

    <card-panel
      :title="selectedTable || t.database.noTableSelected"
      icon="file-code"
      icon-theme="primary"
      class="db-browser-main"
    >
      <template v-if="selectedTable" #actions>
        <t-button variant="outline" size="small" @click="emit('select', selectedTable)">
          <template #icon><t-icon name="refresh" /></template>
          {{ t.common.refresh }}
        </t-button>
      </template>

      <div v-if="!selectedTable" class="empty-tip">{{ t.database.noTableSelected }}</div>
      <t-tabs v-else v-model="tabModel">
        <t-tab-panel value="schema" :label="t.database.tabSchema">
          <div class="db-table-scroll custom-scrollbar-sm">
            <t-table
              :data="schema?.columns ?? []"
              :columns="schemaColumns"
              row-key="field"
              hover
              stripe
              size="small"
            />
          </div>
          <div class="db-sub-title">{{ t.database.indexesTitle }}</div>
          <div v-if="indexRows.length === 0" class="empty-tip">{{ t.database.noIndexes }}</div>
          <t-table
            v-else
            :data="indexRows"
            :columns="indexColumns"
            row-key="name"
            hover
            stripe
            size="small"
          />
        </t-tab-panel>

        <t-tab-panel value="rows" :label="t.database.tabRows">
          <div class="db-pager">
            <t-button
              size="small"
              variant="outline"
              :disabled="offset === 0"
              @click="emit('change-page', -1)"
            >
              {{ t.database.prevPage }}
            </t-button>
            <span>{{ t.database.pageInfo(offset, preview?.rows.length ?? 0) }}</span>
            <t-button
              size="small"
              variant="outline"
              :disabled="(preview?.rows.length ?? 0) < DATABASE_PREVIEW_LIMIT"
              @click="emit('change-page', 1)"
            >
              {{ t.database.nextPage }}
            </t-button>
          </div>
          <div class="db-table-scroll custom-scrollbar-sm">
            <t-table
              :data="resultRows"
              :columns="resultColumns"
              row-key="__row"
              hover
              stripe
              size="small"
            />
          </div>
          <p class="db-hint">{{ t.database.rowsTruncated }}</p>
        </t-tab-panel>

        <t-tab-panel value="ddl" :label="t.database.tabDdl">
          <sql-editor
            :content="schema?.createSql ?? ''"
            :readonly="true"
            min-height="320px"
            max-height="380px"
          />
        </t-tab-panel>
      </t-tabs>
    </card-panel>
  </div>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import SideListItem from '@/components/common/side-list-item.vue';
import SqlEditor from '@/components/common/sql-editor.vue';
import { DATABASE_PREVIEW_LIMIT } from '@/constants/database';
import type { Locale } from '@/locales/zh';
import type {
  DatabaseTable,
  DatabaseTableSchema,
  SqlExecution,
} from '@/types/database';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 过滤后的表清单 */
  tables: DatabaseTable[];
  /** 当前选中的表名 */
  selectedTable: string;
  /** 当前选中表的结构 */
  schema: DatabaseTableSchema | null;
  /** 当前选中表的数据预览 */
  preview: SqlExecution | null;
  /** 数据预览偏移量 */
  offset: number;
  /** 字段表格列配置 */
  schemaColumns: Array<Record<string, unknown>>;
  /** 索引表格列配置 */
  indexColumns: Array<Record<string, unknown>>;
  /** 索引表格行数据 */
  indexRows: Array<Record<string, unknown>>;
  /** 数据预览列配置 */
  resultColumns: Array<Record<string, unknown>>;
  /** 数据预览行数据 */
  resultRows: Array<Record<string, unknown>>;
}>();

const emit = defineEmits<{
  /** 选中一张表 */
  (e: 'select', name: string): void;
  /** 数据预览翻页，1 为下一页、-1 为上一页 */
  (e: 'change-page', delta: number): void;
}>();

/** 表名搜索关键字（v-model:keyword，Vue 3.4+ defineModel 语法糖） */
const keywordModel = defineModel<string>('keyword', { required: true });

/** 右侧详情标签页（v-model:tab，Vue 3.4+ defineModel 语法糖） */
const tabModel = defineModel<string>('tab', { required: true });

const metaText = (table: DatabaseTable): string => {
  const kind = table.type === 'view'
    ? props.t.database.tableTypeView
    : props.t.database.tableTypeTable;
  return `${kind} · ${props.t.database.rowCount(table.rows)}`;
};
</script>

<style scoped>
@import "@/styles/common.css";
@import "@/styles/scrollbar.css";

.db-browser {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  min-height: 480px;
}

.t-tab-panel {
  padding: 16px;
}

.db-browser-list,
.db-browser-main {
  min-width: 0;
}

.db-table-list {
  max-height: 380px;
  overflow-y: auto;
  margin-top: 10px;
}

.db-table-scroll {
  overflow: auto;
  max-height: 360px;
}

.db-sub-title {
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.db-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.db-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .db-browser {
    grid-template-columns: 1fr;
  }
}
</style>
