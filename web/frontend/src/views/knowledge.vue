<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.knowledgeBase.pageTitle"
    :subtitle="t.knowledgeBase.subtitle"
  >
    <template #actions>
      <t-button
        v-if="canEdit()"
        variant="outline"
        size="large"
        @click="openDirsDrawer"
      >
        <template #icon><t-icon name="folder-setting" /></template>
        {{ t.knowledgeBase.dirsConfigBtn }}
      </t-button>
      <t-button
        v-if="canEdit()"
        variant="outline"
        size="large"
        :loading="pageLoading"
        @click="handleReindex"
      >
        <template #icon><t-icon name="refresh" /></template>
        {{ t.knowledgeBase.rebuildIndexBtn }}
      </t-button>
      <t-button
        v-if="canEdit()"
        theme="primary"
        size="large"
        @click="openCreateDoc"
      >
        <template #icon><t-icon name="add" /></template>
        {{ t.knowledgeBase.createDocBtn }}
      </t-button>
    </template>

    <card-panel
      :title="t.knowledgeBase.docListTitle"
      icon="folder"
      icon-theme="secondary"
    >
      <template #actions>
        <t-button variant="outline" size="large" @click="loadOverview(true)">
          <template #icon><t-icon name="refresh" /></template>
          {{ t.common.refresh }}
        </t-button>
      </template>
      <template #title-extra>
        <span class="text-xs" style="color: var(--text-muted);">
          {{ t.knowledgeBase.docListSubtitle }}
        </span>
      </template>

      <div
        v-if="docs.length === 0"
        class="flex flex-col items-center py-12"
        style="color: var(--text-muted);"
      >
        <t-icon name="folder" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
        <p class="text-sm">{{ t.knowledgeBase.noDocs }}</p>
      </div>

      <t-table
        v-else
        :data="docs"
        :columns="docColumns"
        row-key="name"
        hover
        stripe
        size="medium"
      >
        <template #actions="{ row }">
          <div class="flex gap-2">
            <template v-if="canEdit() && row.readonly">
              <t-button
                variant="text"
                size="small"
                @click="importDoc(row)"
              >
                <template #icon><t-icon name="download" /></template>
                {{ t.knowledgeBase.importBtn }}
              </t-button>
            </template>
            <template v-else-if="canEdit()">
              <t-button
                variant="text"
                size="small"
                @click="openEditDoc(row)"
              >
                <template #icon><t-icon name="edit" /></template>
              </t-button>
              <t-popconfirm
                :content="t.knowledgeBase.deleteDocConfirm"
                @confirm="removeDoc(row.path)"
              >
                <t-button
                  variant="text"
                  theme="danger"
                  size="small"
                >
                  <template #icon><t-icon name="delete" /></template>
                </t-button>
              </t-popconfirm>
            </template>
          </div>
        </template>
      </t-table>
    </card-panel>

    <card-panel
      :title="t.knowledgeBase.searchTitle"
      icon="search"
      icon-theme="primary"
    >
      <template #title-extra>
        <span class="text-xs" style="color: var(--text-muted);">
          {{ reindexInfo
            ? t.knowledgeBase.indexStatus(reindexInfo.chunkCount, reindexInfo.sources)
            : t.knowledgeBase.indexIdle }}
        </span>
      </template>

      <div class="knowledge-dirs">
        <span>{{ t.knowledgeBase.currentDirs }}:</span>
        <t-tag v-for="dir in config.dirs" :key="dir" size="small">{{ dir }}</t-tag>
      </div>

      <div class="knowledge-search-bar">
        <t-input
          v-model="searchQuery"
          :placeholder="t.knowledgeBase.searchPlaceholder"
          clearable
          @enter="handleSearch"
        />
        <t-button theme="primary" :loading="searching" @click="handleSearch">
          {{ t.knowledgeBase.searchBtn }}
        </t-button>
      </div>

      <div v-if="!searchPerformed" class="empty-tip">
        {{ t.knowledgeBase.searchIdle }}
      </div>
      <div v-else-if="searchHits.length === 0" class="empty-tip">
        {{ t.knowledgeBase.searchEmpty }}
      </div>
      <div v-else>
        <p class="text-sm" style="color: var(--text-muted); margin-bottom: 12px;">
          {{ t.knowledgeBase.resultCount(searchHits.length) }}
        </p>
        <div
          v-for="(hit, index) in searchHits"
          :key="`${hit.source}-${index}`"
          class="knowledge-hit"
        >
          <div class="hit-header">
            <span class="hit-title">{{ hit.title }}</span>
            <span class="hit-meta">
              {{ hit.source }} · {{ t.knowledgeBase.scoreLabel }} {{ hit.score.toFixed(3) }}
            </span>
          </div>
          <pre class="hit-text">{{ hit.text }}</pre>
        </div>
      </div>
    </card-panel>

    <form-drawer
      v-model="docDrawerVisible"
      :t="t"
      :header="editingDoc ? t.knowledgeBase.editDocHeader : t.knowledgeBase.createDocHeader"
      :mode="docFormMode"
      :is-mobile="isMobile"
      :readonly="!canEdit()"
      @confirm="submitDocForm"
      @close="closeDocDrawer"
    >
      <auto-form v-model="docFormData" :fields="docFormFields" />
    </form-drawer>

    <form-drawer
      v-model="dirsDrawerVisible"
      :t="t"
      :header="t.knowledgeBase.dirsHeader"
      :mode="dirsFormMode"
      :is-mobile="isMobile"
      :readonly="!canEdit()"
      @confirm="submitDirsForm"
      @close="closeDirsDrawer"
    >
      <auto-form v-model="dirsFormData" :fields="dirsFormFields" />
    </form-drawer>
  </page-layout>
</template>

<script setup lang="ts">
import { useKnowledgeModel } from '@/models/knowledge-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';

const {
  t,
  pageLoading,
  isMobile,
  canEdit,
  docs,
  config,
  docColumns,
  docDrawerVisible,
  editingDoc,
  docFormData,
  docFormMode,
  docFormFields,
  dirsDrawerVisible,
  dirsFormData,
  dirsFormMode,
  dirsFormFields,
  searchQuery,
  searchHits,
  searchPerformed,
  searching,
  reindexInfo,
  loadOverview,
  openCreateDoc,
  openEditDoc,
  closeDocDrawer,
  submitDocForm,
  removeDoc,
  importDoc,
  openDirsDrawer,
  closeDirsDrawer,
  submitDirsForm,
  handleReindex,
  handleSearch,
} = useKnowledgeModel();
</script>

<style scoped>
@import "@/styles/common.css";

.knowledge-dirs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.knowledge-search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.knowledge-hit {
  padding: 12px 16px;
  margin-bottom: 12px;
  border: 1px solid var(--td-component-stroke);
  border-radius: 8px;
}

.hit-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.hit-title {
  font-weight: 600;
}

.hit-meta {
  color: var(--text-muted);
  font-size: 12px;
}

.hit-text {
  max-height: 220px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.7;
}
</style>
