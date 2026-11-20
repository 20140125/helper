<template>
  <page-layout :page-loading="pageLoading" :title="t.templates.pageTitle" :subtitle="t.templates.subtitle">
    <div class="templates-two-col">
      <!-- 左侧：编辑 Card -->
      <template-editor-card
        :title="selectedTypeLabel"
        :t="t"
        :can-edit="canEdit()"
        :selector-fields="selectorFields"
        :selector-values="selectorValues"
        :content="editTemplateContent"
        :editor-ref="setEditorRef"
        @update:selector-values="selectorValues = $event"
        @update:content="onEditorChange"
        @save="handleSaveTemplate"
      />

      <!-- 右侧：预览 Card -->
      <template-preview-card
        :title="previewCardTitle"
        :type-label="selectedTypeLabel"
        :style-label="selectedStyleLabel"
        :has-content="!!previewContent"
        :html-content="previewContentHtml"
      />
    </div>
  </page-layout>
</template>

<script setup lang="ts">
import { useMessageTemplatesModel } from '@/models/message-templates-model';
import PageLayout from '@/components/common/page-layout.vue';
import TemplateEditorCard from '@/components/message-templates/template-editor-card.vue';
import TemplatePreviewCard from '@/components/message-templates/template-preview-card.vue';

const {
  t,
  previewContent,
  previewContentHtml,
  editTemplateContent,
  pageLoading,
  selectorFields,
  selectorValues,
  selectedTypeLabel,
  selectedStyleLabel,
  previewCardTitle,
  canEdit,
  handleSaveTemplate,
  setEditorRef,
  onEditorChange,
} = useMessageTemplatesModel();
</script>

<style scoped>
@import "@/styles/common.css";

/* ── 两栏布局：左右各一个 Card ── */
.templates-two-col {
  display: flex;
  gap: 16px;
  align-items: stretch;
  min-height: 0;
  height: calc(100vh - 220px);
  min-height: 400px;
}

/* ── 移动端适配（≤768px） ── */
@media (max-width: 768px) {
  /* 两栏布局改为上下堆叠 */
  .templates-two-col {
    flex-direction: column;
    height: auto;
    min-height: 0;
    gap: 12px;
  }
}
</style>
