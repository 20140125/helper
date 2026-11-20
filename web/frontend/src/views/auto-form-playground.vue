<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.playground.pageTitle"
    :subtitle="t.playground.subtitle"
    :disable-anchor="true"
  >
    <!-- 主体布局 -->
    <div class="playground-layout">
      <!-- 左侧：JSON 编辑器 -->
      <playground-editor-panel
        :t="t"
        :templates="templates"
        :json-text="jsonText"
        :active-template-index="activeTemplateIndex"
        :can-edit="canEdit()"
        :is-adding-template="isAddingTemplate"
        :new-template-name="newTemplateName"
        @format-json="formatJson"
        @copy-json="copyJson"
        @save-template="saveTemplate"
        @apply-template="applyTemplate"
        @delete-template="deleteTemplate"
        @add-template="addTemplate"
        @cancel-add-template="cancelAddTemplate"
        @start-add-template="startAddTemplate"
        @editor-change="onEditorChange"
        @set-file-content-ref="setFileContentRef"
      />

      <!-- 右侧：表单预览 -->
      <playground-preview-panel
        :t="t"
        v-model:form-data="formData"
        :parsed-fields="parsedFields"
        :is-json-valid="isJsonValid"
        :active-template-index="activeTemplateIndex"
        :label-align="labelAlign"
        :required-mark="requiredMark"
        :form-size="formSize"
        :show-colon="showColon"
        :formatted-form-data="formattedFormData"
        :permission-selection="permissionSelection"
        @reset-form="resetForm"
        @submit-form="submitForm"
        @set-auto-form-ref="setAutoFormRef"
      />
    </div>

    <!-- 提交结果抽屉 -->
    <playground-result-drawer
      :t="t"
      v-model:visible="showResultDialog"
      :formatted-result="formattedResult"
    />
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import PlaygroundEditorPanel from '@/components/playground-form/playground-editor-panel.vue';
import PlaygroundPreviewPanel from '@/components/playground-form/playground-preview-panel.vue';
import PlaygroundResultDrawer from '@/components/playground-form/playground-result-drawer.vue';
import { useAutoFormPlaygroundModel } from '@/models/auto-form-playground-model';

const {
  t,
  setAutoFormRef,
  setFileContentRef,
  templates,
  jsonText,
  formData,
  activeTemplateIndex,
  showResultDialog,
  labelAlign,
  formSize,
  showColon,
  parsedFields,
  isJsonValid,
  formattedResult,
  formattedFormData,
  requiredMark,
  pageLoading,
  canEdit,
  applyTemplate,
  formatJson,
  resetForm,
  submitForm,
  copyJson,
  saveTemplate,
  addTemplate,
  deleteTemplate,
  isAddingTemplate,
  newTemplateName,
  startAddTemplate,
  cancelAddTemplate,
  onEditorChange,
  permissionSelection,
} = useAutoFormPlaygroundModel();
</script>

<style scoped>
@import "@/styles/common.css";

.playground-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 120px);
  min-height: 600px;
}

@media (max-width: 900px) {
  .playground-layout {
    flex-direction: column;
    height: auto;
  }
}
</style>
