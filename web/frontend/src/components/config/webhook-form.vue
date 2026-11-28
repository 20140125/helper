<template>
  <div class="webhook-inline-form">
    <auto-form
      ref="autoFormRef"
      v-model="modelValue"
      :fields="fields"
    />
    <div class="webhook-inline-btns">
      <t-button variant="outline" size="large" @click="emit('cancel')">
        <template #icon><t-icon name="close" /></template>
        {{ t.config.webhookCancel }}
      </t-button>
      <t-button theme="primary" size="large" @click="emit('submit')">
        <template #icon><t-icon name="check" /></template>
        {{ t.config.webhookSave }}
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AutoForm from '@/components/auto-form/index.vue';
import type { AutoFormField } from '@/types/auto-form';
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 表单字段 */
  fields: AutoFormField[];
}>();

const emit = defineEmits<{


  /** 设置表单 ref */
  (e: 'set-ref', el: unknown): void;
  /** 取消 */
  (e: 'cancel'): void;
  /** 提交 */
  (e: 'submit'): void;
}>();

/** 表单值（v-model，Vue 3.4+ defineModel 语法糖） */
const modelValue = defineModel<Record<string, unknown>>({ required: true 



});

const autoFormRef = ref<InstanceType<typeof AutoForm> | null>(null);

onMounted(() => {
  if (autoFormRef.value) {
    emit('set-ref', autoFormRef.value);
  }
});
</script>

<style scoped>
.webhook-inline-form {
  padding: 16px;
  background: var(--bg-secondary, var(--card-bg));
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.webhook-inline-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
