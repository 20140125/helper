<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.database.pageTitle"
    :subtitle="t.database.subtitle"
    :disable-anchor="true"
  >
    <template #actions>
      <t-button variant="outline" size="large" :loading="pageLoading" @click="refreshAll">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.database.refreshAll }}
      </t-button>
      <t-button
        v-if="canEdit()"
        theme="danger"
        variant="outline"
        size="large"
        @click="openInitDrawer"
      >
        <template #icon><t-icon name="refresh" /></template>
        {{ t.database.initBtn }}
      </t-button>
    </template>

    <database-status-card
      :t="t"
      :status="status"
      @refresh="loadStatus"
    />

    <database-table-browser
      v-model:keyword="tableKeyword"
      v-model:tab="activeTab"
      :t="t"
      :tables="filteredTables"
      :selected-table="selectedTable"
      :schema="schema"
      :preview="preview"
      :offset="previewOffset"
      :schema-columns="schemaColumns"
      :index-columns="indexColumns"
      :index-rows="indexRows"
      :result-columns="previewColumns"
      :result-rows="previewRows"
      @select="selectTable"
      @change-page="changePage"
    />

    <database-sql-console
      v-model:sql="sqlText"
      :t="t"
      :tables="tables"
      :result="queryResult"
      :columns="queryColumns"
      :rows="queryRows"
      :running="running"
      :can-edit="canEdit()"
      @run-query="runQuery"
      @execute="executeSql"
    />

    <database-scripts-panel
      :t="t"
      :scripts="scripts"
      :selected-script="selectedScript"
      :content="scriptContent"
      @select="selectScript"
    />

    <database-init-drawer
      v-model:visible="initDrawerVisible"
      v-model:form="initFormData"
      :t="t"
      :fields="initFields"
      :loading="initLoading"
      :database-name="databaseName"
      :is-mobile="isMobile"
      @confirm="submitInit"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { useDatabaseModel } from '@/models/database-model';
import PageLayout from '@/components/common/page-layout.vue';
import DatabaseStatusCard from '@/components/database/database-status-card.vue';
import DatabaseTableBrowser from '@/components/database/database-table-browser.vue';
import DatabaseSqlConsole from '@/components/database/database-sql-console.vue';
import DatabaseScriptsPanel from '@/components/database/database-scripts-panel.vue';
import DatabaseInitDrawer from '@/components/database/database-init-drawer.vue';

const {
  t,
  pageLoading,
  isMobile,
  status,
  tables,
  filteredTables,
  tableKeyword,
  selectedTable,
  schema,
  preview,
  previewOffset,
  activeTab,
  schemaColumns,
  indexColumns,
  indexRows,
  previewColumns,
  previewRows,
  sqlText,
  queryResult,
  running,
  queryColumns,
  queryRows,
  scripts,
  selectedScript,
  scriptContent,
  initDrawerVisible,
  initLoading,
  initFormData,
  initFields,
  databaseName,
  canEdit,
  loadStatus,
  selectTable,
  changePage,
  runQuery,
  executeSql,
  selectScript,
  openInitDrawer,
  submitInit,
  refreshAll,
} = useDatabaseModel();
</script>
