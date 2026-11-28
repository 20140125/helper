<template>
  <div class="webhook-list">
    <div v-if="webhooksStore.loading" class="webhook-empty">{{ t.common.loading }}</div>
    <div v-else-if="webhooksStore.webhooks.length === 0 && !isAddingWebhook" class="webhook-empty">
      {{ t.config.noWebhooks(t.config.addWebhook) }}
    </div>

    <!-- 已有机器人列表 -->
    <div
      v-for="webhook in webhooksStore.webhooks"
      :key="webhook.id"
      class="webhook-item-wrap"
    >
      <div v-if="editingWebhookId !== webhook.id" class="webhook-row">
        <div class="webhook-info">
          <p class="webhook-name">{{ webhook.name }}</p>
          <p class="webhook-url">{{ webhook.url }}</p>
        </div>
        <div v-if="canEdit" class="webhook-actions">
          <t-tooltip :content="t.common.edit">
            <t-button variant="text" size="large" @click="$emit('edit-webhook', webhook)">
              <template #icon><t-icon name="edit" /></template>
            </t-button>
          </t-tooltip>
          <t-popconfirm :content="t.config.deleteWebhookConfirm" @confirm="webhooksStore.removeWebhook(String(webhook.id))">
            <t-tooltip :content="t.common.delete">
              <t-button variant="text" theme="danger" size="large">
                <template #icon><t-icon name="delete" /></template>
              </t-button>
            </t-tooltip>
          </t-popconfirm>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑表单（统一展示在列表底部） -->
    <webhook-form
      v-if="isAddingWebhook || editingWebhookId"
      class="webhook-add-form"
      :model-value="webhookInlineForm"
      :fields="fields"
      :t="t"
      @update:model-value="handleFormUpdate"
      @set-ref="$emit('set-webhook-form-ref', $event)"
      @cancel="$emit('cancel-webhook')"
      @submit="$emit('submit-webhook')"
    />
  </div>
</template>

<script setup lang="ts">
import WebhookForm from './webhook-form.vue';
import type { AutoFormField } from '@/types/auto-form';
import type { ConfigWebHook } from '@/types/config';
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** Webhook 列表数据 */
  webhooksStore: {
    /** 是否正在加载 */
    loading: boolean;
    /** Webhook 列表 */
    webhooks: ConfigWebHook[];
    /** 删除 Webhook */
    removeWebhook: (id: string) => void;
  };
  /** 当前正在编辑的 Webhook ID */
  editingWebhookId: string | null;
  /** 是否正在添加 Webhook */
  isAddingWebhook: boolean;
  /** Webhook 表单数据 */
  webhookInlineForm: ConfigWebHook;
  /** Webhook 表单字段 */
  fields: AutoFormField[];
  /** 是否可编辑 */
  canEdit: boolean;
}>();

const emit = defineEmits<{
  /** 编辑 Webhook */
  (e: 'edit-webhook', webhook: ConfigWebHook): void;
  /** 更新 Webhook 表单数据 */
  (e: 'update:webhook-form', val: ConfigWebHook): void;
  /** 设置 Webhook 表单引用 */
  (e: 'set-webhook-form-ref', el: unknown): void;
  /** 取消编辑 Webhook */
  (e: 'cancel-webhook'): void;
  /** 提交 Webhook 表单 */
  (e: 'submit-webhook'): void;
}>();

/**
 * 处理子表单 update:model-value 事件
 * 子组件抛出的是 Record<string, unknown>，运行时实际就是 ConfigWebHook（父组件传入的就是该类型），
 * 这里做一层类型收窄，避免模板内写类型断言。
 */
function handleFormUpdate(val: Record<string, unknown>): void {
  emit('update:webhook-form', val as ConfigWebHook);
}
</script>

<style scoped>
.webhook-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.webhook-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 12px 0;
  font-style: italic;
}

.webhook-item-wrap {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.webhook-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--card-bg);
}

.webhook-info {
  flex: 1;
  min-width: 0;
}

.webhook-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.webhook-url {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 2px 0 0;
}

.webhook-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.webhook-add-form {
  margin-top: 4px;
}

@media (max-width: 768px) {
  /* webhook 操作按钮缩小间距 */
  .webhook-row {
    gap: 8px;
    padding: 8px 10px;
  }

  /* webhook URL 可换行显示 */
  .webhook-url {
    white-space: normal;
    word-break: break-all;
  }
}
</style>
