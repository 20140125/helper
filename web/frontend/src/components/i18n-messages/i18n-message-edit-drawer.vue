<template>
  <form-drawer
    v-model="visibleModel"
    :t="t"
    :header="t.i18nMessages.editHeader"
    :mode="FormMode.Edit"
    :is-mobile="isMobile"
    :loading="loading"
    :readonly="readonly"
    @confirm="emit('confirm')"
    @close="emit('close')"
  >
    <t-alert v-if="row?.valueType === 'function'" theme="warning" :message="t.i18nMessages.functionReadonly" />
    <div class="i18n-edit-meta">
      <div><b>{{ t.i18nMessages.colKeyPath }}：</b>{{ row?.keyPath }}</div>
      <div><b>{{ t.i18nMessages.langLabel }}：</b>{{ row?.lang }}</div>
    </div>
    <auto-form v-model="formModel" :fields="fields" />
  </form-drawer>
</template>

<script setup lang="ts">
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import { FormMode } from '@/constants/form';
import type { AutoFormField } from '@/types/auto-form';
import type { Locale } from '@/types/locale';
import type { I18nMessage } from '@/types/i18n';

defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 编辑表单字段 */
  fields: AutoFormField[];
  /** 当前编辑的记录 */
  row: I18nMessage | null;
  /** 保存中标记 */
  loading: boolean;
  /** 是否只读（无编辑权限时隐藏确认按钮） */
  readonly: boolean;
  /** 是否为移动端 */
  isMobile: boolean;
}>();

const emit = defineEmits<{
  /** 点击确认保存 */
  (e: 'confirm'): void;
  /** 关闭抽屉 */
  (e: 'close'): void;
}>();

/** 抽屉显示状态（v-model:visible，Vue 3.4+ defineModel 语法糖） */
const visibleModel = defineModel<boolean>('visible', { required: true });

/** 编辑表单数据（v-model:form，Vue 3.4+ defineModel 语法糖） */
const formModel = defineModel<Record<string, unknown>>('form', { required: true });
</script>

<style scoped>
.i18n-edit-meta {
  display: grid;
  gap: 6px;
  margin: 14px 0 18px;
  font-size: 13px;
  color: var(--text-muted);
  word-break: break-all;
}
</style>
