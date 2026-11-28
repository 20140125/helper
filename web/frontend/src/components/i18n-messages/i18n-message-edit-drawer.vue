<template>
  <form-drawer
    v-model="visibleModel"
    :t="t"
    :header="t.i18nMessages.editHeader"
    :mode="FormMode.Edit"
    :is-mobile="isMobile"
    :loading="loading"
    :readonly="readonly"
    desktop-size="620px"
    @confirm="emit('confirm')"
    @close="emit('close')"
  >
    <div class="i18n-edit">
      <section v-if="row" class="i18n-edit-meta">
        <div class="i18n-edit-meta__head">
          <span class="i18n-edit-meta__icon"><t-icon name="file-code" size="16px" /></span>
          <span class="i18n-edit-meta__title">{{ t.i18nMessages.colKeyPath }}</span>
          <t-tag :theme="row.valueType === 'function' ? 'warning' : 'success'" variant="light" size="small">
            {{ valueTypeLabel }}
          </t-tag>
        </div>
        <code class="i18n-edit-meta__key">{{ row.keyPath }}</code>
        <div class="i18n-edit-meta__grid">
          <div class="i18n-edit-meta__item">
            <span class="i18n-edit-meta__label">{{ t.i18nMessages.langLabel }}</span>
            <span class="i18n-edit-meta__value">{{ langName }}</span>
          </div>
          <div class="i18n-edit-meta__item">
            <span class="i18n-edit-meta__label">{{ t.i18nMessages.colNamespace }}</span>
            <span class="i18n-edit-meta__value">{{ row.namespace }}</span>
          </div>
        </div>
      </section>

      <t-alert
        v-if="row?.valueType === 'function'"
        theme="warning"
        :message="t.i18nMessages.functionReadonly"
        class="i18n-edit-alert"
      />

      <section class="i18n-edit-body">
        <auto-form v-model="formModel" :fields="fields" label-align="top" class="i18n-edit-form" />
      </section>
    </div>
  </form-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import { FormMode } from '@/constants/form';
import type { AutoFormField } from '@/types/auto-form';
import type { Locale } from '@/types/locale';
import type { I18nMessage } from '@/types/i18n';

const props = defineProps<{
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

/** 当前记录的语言显示名 */
const langName = computed(() => props.row?.lang === 'zh'
  ? props.t.i18nMessages.langZh
  : props.t.i18nMessages.langEn);

/** 当前记录的值类型标签 */
const valueTypeLabel = computed(() => props.row?.valueType === 'function'
  ? props.t.i18nMessages.typeFunction
  : props.t.i18nMessages.typeText);
</script>

<style scoped>
.i18n-edit {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.i18n-edit-meta {
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.i18n-edit-meta__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.i18n-edit-meta__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.i18n-edit-meta__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.i18n-edit-meta__key {
  display: block;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.i18n-edit-meta__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.16));
}

.i18n-edit-meta__item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.i18n-edit-meta__label {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--text-secondary);
}

.i18n-edit-meta__value {
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.i18n-edit-body {
  padding: 12px 14px 6px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
}

.i18n-edit-form :deep(.t-form__label) {
  padding-bottom: 6px !important;
  color: var(--text-primary) !important;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4 !important;
}

.i18n-edit-form :deep(.t-textarea__inner) {
  padding: 10px 12px 22px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary) !important;
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .i18n-edit-meta,
  .i18n-edit-body {
    padding: 12px;
  }

  .i18n-edit-meta__grid {
    grid-template-columns: 1fr;
  }
}
</style>
