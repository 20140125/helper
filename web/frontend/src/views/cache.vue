<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.cache.pageTitle"
    :subtitle="t.cache.subtitle"
    :disable-anchor="true"
  >
    <template #actions>
      <t-button
        variant="outline"
        size="large"
        @click="loadFileList"
      >
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
    </template>

    <!-- 移动端：文件选择器 -->
    <div class="panel-mobile-select">
      <t-select
        :value="selectedFile"
        size="large"
        :placeholder="t.cache.selectPlaceholder"
        @change="(val: string) => selectFile(val)"
      >
        <template #valueDisplay="{ value }">
          <div class="panel-select-option">
            <t-icon name="file-code" size="14px" style="color: var(--accent-secondary); flex-shrink: 0;" />
            <span>{{ value }}</span>
          </div>
        </template>
        <t-option
          v-for="file in files"
          :key="file.name"
          :value="file.name"
          :label="file.name"
        >
          <template #default>
            <div class="panel-select-option">
              <t-icon name="file-code" size="14px" style="color: var(--accent-secondary); flex-shrink: 0;" />
              <span>{{ file.name }}</span>
            </div>
          </template>
        </t-option>
      </t-select>
    </div>

    <!-- 主体：左右两栏 -->
    <div class="panel-layout">
      <!-- 左侧文件列表 -->
      <card-panel
        :title="t.cache.fileListTitle"
        icon="folder"
        icon-theme="secondary"
        class="panel-list"
        full-height
      >
        <template #title-extra>
          <span class="text-xs" style="color: var(--text-muted);">{{ t.cache.fileCount(files.length) }}</span>
        </template>
        <div v-if="files.length === 0" class="empty-tip">
          <t-icon name="file" size="32px" style="color: var(--text-muted);" />
          <p style="color: var(--text-muted);">{{ t.cache.noFiles }}</p>
        </div>
        <side-list-item
          v-for="file in files"
          :key="file.name"
          :active="selectedFile === file.name"
          icon="file-code"
          :title="file.name"
          :size="file.size"
          :mtime="file.mtime"
          @click="selectFile(file.name)"
        />
      </card-panel>

      <!-- 右侧内容编辑区 -->
      <card-panel
        :title="selectedFile || t.cache.selectPlaceholder"
        icon="file-code"
        icon-theme="secondary"
        class="panel-main"
        full-height
      >
        <template v-if="selectedFile" #actions>
          <t-button
            variant="outline"
            size="large"
            class="panel-toolbar-btn"
            @click="loadFileContent(selectedFile)"
          >
            <template #icon><t-icon name="refresh" /></template>
            {{ t.common.refresh }}
          </t-button>
          <t-button
            v-if="canEdit()"
            theme="primary"
            size="large"
            class="panel-toolbar-btn"
            :disabled="!isDirty"
            @click="handleSave"
          >
            <template #icon><t-icon name="save" /></template>
            {{ t.common.save }}
          </t-button>
        </template>
        <file-content
          :ref="(el) => { fileContentRef = el as any }"
          class="p-0"
          :t="t"
          :filename="selectedFile"
          :content="fileRawContent"
          :empty-text="t.cache.emptyHint"
          @change="handleEditorChange"
        />
      </card-panel>
    </div>
  </page-layout>
</template>

<script setup lang="ts">
import { useCacheModel } from '@/models/cache-model';
import SideListItem from '@/components/common/side-list-item.vue';
import FileContent from '@/components/common/file-content.vue';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';

const {
  t,
  files,
  selectedFile,
  fileRawContent,
  isDirty,
  fileContentRef,
  pageLoading,
  canEdit,
  loadFileList,
  loadFileContent,
  selectFile,
  handleSave,
  handleEditorChange,
} = useCacheModel();
</script>

<style scoped>
@import "@/styles/panel-layout.css";
</style>