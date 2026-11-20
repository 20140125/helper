<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.aiModels.pageTitle"
    :subtitle="t.aiModels.subtitle"
  >
    <card-panel
      :title="t.config.customModelsTitle"
      icon="robot"
      icon-color="#6366f1"
    >
      <template #actions>
        <t-button
          v-if="canManage"
          theme="primary"
          size="large"
          @click="startAddAiModel"
        >
          <template #icon><t-icon name="add" /></template>
          {{ t.config.addModel }}
        </t-button>
      </template>

      <ai-model-section
        :t="t"
        :groups="aiModelGroups"
        :is-adding="isAddingAiModel"
        :editing-id="editingAiModelId"
        :form="aiModelInlineForm"
        :fields="aiModelFields"
        :remote-models="remoteModels"
        :fetching="fetchingRemoteModels"
        :testing-id="testingModelId"
        :can-edit="canManage"
        @edit-group="startEditAiModel"
        @delete-group="removeAiModelGroup"
        @update:form="(val) => (aiModelInlineForm = val)"
        @set-form-ref="setAiModelFormRef"
        @fetch-models="fetchRemoteModels"
        @test-model="testAiModel"
        @cancel="cancelAiModelInline"
        @submit="submitAiModelInline"
      />
    </card-panel>
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import AiModelSection from '@/components/config/ai-model-section.vue';
import { useAiModelsModel } from '@/models/ai-models-model';

const {
  t,
  pageLoading,
  canManage,
  aiModelGroups,
  isAddingAiModel,
  editingAiModelId,
  aiModelInlineForm,
  aiModelFields,
  remoteModels,
  fetchingRemoteModels,
  testingModelId,
  fetchRemoteModels,
  testAiModel,
  startAddAiModel,
  startEditAiModel,
  cancelAiModelInline,
  submitAiModelInline,
  removeAiModelGroup,
  setAiModelFormRef,
} = useAiModelsModel();
</script>
