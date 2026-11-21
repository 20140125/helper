<template>
  <page-layout :page-loading="pageLoading" :title="t.templates.pageTitle" :subtitle="t.templates.subtitle">
    <template-editor-card
      class="templates-editor"
      :title="selectedTypeLabel"
      :t="t"
      :can-edit="canEdit()"
      :selector-fields="selectorFields"
      :selector-values="selectorValues"
      :content="editTemplateContent"
      :preview-html="previewContentHtml"
      :editor-ref="setEditorRef"
      @update:selector-values="selectorValues = $event"
      @update:content="onEditorChange"
      @save="handleSaveTemplate"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { useMessageTemplatesModel } from '@/models/message-templates-model';
import PageLayout from '@/components/common/page-layout.vue';
import TemplateEditorCard from '@/components/message-templates/template-editor-card.vue';

const {
  t,
  previewContentHtml,
  editTemplateContent,
  pageLoading,
  selectorFields,
  selectorValues,
  selectedTypeLabel,
  canEdit,
  handleSaveTemplate,
  setEditorRef,
  onEditorChange,
} = useMessageTemplatesModel();
</script>

<style scoped>
@import "@/styles/common.css";

/* 编辑与预览已合并到同一个 Card：高度按内容自适应，与知识库编辑器一致 */
.templates-editor {
  height: auto;
  min-height: 0;
}

/* ── 移动端适配（≤768px） ── */
@media (max-width: 768px) {
  .templates-editor {
    height: auto;
    min-height: 0;
  }
}
</style>
