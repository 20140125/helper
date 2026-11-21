<template>
  <page-layout :page-loading="pageLoading" :title="t.config.pageTitle" :subtitle="t.config.subtitle">
    <div class="config-flow">
      <div
        v-for="(column, columnIndex) in sectionColumns"
        :key="columnIndex"
        :ref="getColumnRef(columnIndex)"
        class="config-column"
      >
        <config-section-card
          v-for="section in column"
          :key="section.key"
          :data-section-key="section.key"
          :title="section.title"
          :icon="section.icon"
          :icon-color="section.iconColor"
          :bar-color="section.barColor"
          draggable
          :drag-hint="t.config.dragSortHint"
        >
          <template #actions>
            <!-- Webhook card 操作按钮 -->
            <template v-if="section.key === 'webhook'">
              <t-button v-if="canEdit(Permission.WEBHOOK_VIEW)" theme="primary" size="large" @click="startAddWebhook">
                <template #icon><t-icon name="add" /></template>
                {{ t.config.addWebhook }}
              </t-button>
            </template>

            <!-- 普通 section card 操作按钮 -->
            <template v-else>
              <template v-if="editingKey === section.key">
                <t-button variant="outline" size="large" @click="cancelEdit(section.key)">
                  <template #icon><t-icon name="close" /></template>
                  {{ t.common.cancel }}
                </t-button>
                <t-button v-if="canEdit(Permission.CONFIG_VIEW)" theme="primary" size="large" @click="handleSaveWithValidate(section.key)">
                  <template #icon><t-icon name="check" /></template>
                  {{ t.common.save }}
                </t-button>
              </template>
              <template v-else>
                <t-button v-if="canEdit(Permission.CONFIG_VIEW)" theme="primary" size="large" @click="toggleEdit(section.key)">
                  <template #icon><t-icon name="edit" /></template>
                  {{ t.common.edit }}
                </t-button>
              </template>
            </template>
          </template>

          <!-- Webhook 内容 -->
          <webhook-section
            v-if="section.key === 'webhook'"
            :t="t"
            :webhooks-store="webhooksStore"
            :editing-webhook-id="editingWebhookId"
            :is-adding-webhook="isAddingWebhook"
            :webhook-inline-form="webhookInlineForm"
            :fields="section.fields"
            :can-edit="canEdit(Permission.WEBHOOK_VIEW)"
            @edit-webhook="startEditWebhook"
            @update:webhook-form="(val) => (webhookInlineForm = val as ConfigWebHook)"
            @set-webhook-form-ref="setWebhookFormRef"
            @cancel-webhook="cancelWebhookInline"
            @submit-webhook="submitWebhookInline"
          />

          <!-- 普通 section auto-form 内容 -->
          <template v-else-if="section.form">
            <auto-form
              :ref="(el) => setSectionFormRef(section.key, el)"
              :model-value="section.form.value"
              :fields="section.fields"
              :disabled="editingKey !== section.key"
              @update:model-value="(val) => (section.form!.value = val)"
            />
          </template>
        </config-section-card>
      </div>
    </div>
  </page-layout>
</template>

<script setup lang="ts">
import { useConfigModel } from '@/models/config-model';
import type { ConfigWebHook } from '@/types/config';
import PageLayout from '@/components/common/page-layout.vue';
import ConfigSectionCard from '@/components/config/config-section-card.vue';
import AutoForm from '@/components/auto-form/index.vue';
import WebhookSection from '@/components/config/webhook-section.vue';

const {
  t,
  pageLoading,
  editingKey,
  sectionColumns,
  getColumnRef,
  canEdit,
  Permission,
  setSectionFormRef,
  handleSaveWithValidate,
  toggleEdit,
  cancelEdit,
  webhooksStore,
  editingWebhookId,
  isAddingWebhook,
  webhookInlineForm,
  startAddWebhook,
  startEditWebhook,
  cancelWebhookInline,
  submitWebhookInline,
  setWebhookFormRef,
} = useConfigModel();
</script>

<style scoped>
.config-flow {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.config-column {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 双列变窄后，标题与操作按钮允许换行，长标题可折行 */
.config-flow :deep(.card-header) {
  flex-wrap: wrap;
  gap: 10px;
}

.config-flow :deep(.card-header > div:first-child) {
  flex: 1;
  min-width: 0;
}

.config-flow :deep(.card-title) {
  overflow-wrap: anywhere;
}

.config-column :deep(.config-card--drag-ghost) {
  opacity: 0.45;
  border: 1px dashed var(--brand-primary, #07c160);
}

@media (max-width: 768px) {
  .config-flow,
  .config-column {
    gap: 14px;
  }
}
</style>
