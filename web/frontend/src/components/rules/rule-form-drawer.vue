<template>
  <form-drawer
    v-model="drawerVisible"
    :t="t"
    :header="header"
    :mode="mode"
    :is-mobile="isMobile"
    @confirm="$emit('confirm')"
    @close="$emit('close')"
  >
    <auto-form
      :ref="setFormRef"
      v-model="formData"
      :fields="formFields"
    />
  </form-drawer>
</template>

<script setup lang="ts">
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import type { AutoFormField } from '@/types/auto-form';
import type { FormMode } from '@/constants/form';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 抽屉标题 */
  header: string;
  /** 表单模式：Create=新增，Edit=编辑 */
  mode: FormMode;
  /** 是否为移动端 */
  isMobile: boolean;
  /** auto-form 字段配置 */
  formFields: AutoFormField[];
  /** 设置 auto-form ref 的回调 */
  setFormRef: (el: unknown) => void;
}>();

/** 抽屉显示状态（v-model:drawerVisible，Vue 3.4+ defineModel 语法糖） */
const drawerVisible = defineModel<boolean>('drawerVisible', { required: true });
/** 表单数据（v-model:formData，Vue 3.4+ defineModel 语法糖） */
const formData = defineModel<Record<string, unknown>>('formData', { required: true });

defineEmits<{
  /** 确认提交 */
  (e: 'confirm'): void;
  /** 关闭抽屉 */
  (e: 'close'): void;
}>();
</script>
