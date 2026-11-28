<template>
  <form-drawer
    v-model="visibleModel"
    :t="t"
    :header="t.database.initHeader"
    :mode="FormMode.Create"
    :is-mobile="isMobile"
    :loading="loading"
    :confirm-text="t.database.initConfirmBtn"
    @confirm="emit('confirm')"
    @close="emit('close')"
  >
    <t-alert theme="error" :message="t.database.initWarning" />
    <p class="db-init-help">{{ t.database.initConfirmHelp(databaseName) }}</p>
    <auto-form v-model="formModel" :fields="fields" />
  </form-drawer>
</template>

<script setup lang="ts">
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import { FormMode } from '@/constants/form';
import type { AutoFormField } from '@/types/auto-form';
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 初始化确认表单字段 */
  fields: AutoFormField[];
  /** 当前数据库名（用于提示用户输入） */
  databaseName: string;
  /** 是否为移动端 */
  isMobile: boolean;
  /** 初始化提交中标记 */
  loading: boolean;
}>();

const emit = defineEmits<{
  /** 点击确认初始化 */
  (e: 'confirm'): void;
  /** 关闭抽屉 */
  (e: 'close'): void;
}>();

/** 抽屉显示状态（v-model:visible，Vue 3.4+ defineModel 语法糖） */
const visibleModel = defineModel<boolean>('visible', { required: true });

/** 确认表单数据（v-model:form，Vue 3.4+ defineModel 语法糖） */
const formModel = defineModel<Record<string, unknown>>('form', { required: true });
</script>

<style scoped>
.db-init-help {
  margin: 14px 0;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
