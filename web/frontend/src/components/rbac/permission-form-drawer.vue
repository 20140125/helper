<template>
  <form-drawer
    v-model="drawerVisible"
    :t="t"
    :header="header"
    :is-mobile="isMobile"
    :mode="mode"
    :readonly="readonly"
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
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 抽屉标题 */
  header: string;
  /** 是否为移动端 */
  isMobile: boolean;
  /** auto-form 字段配置 */
  formFields: AutoFormField[];
  /** 表单模式：Create=新增，Edit=编辑 */
  mode: FormMode;
  /** 设置 auto-form ref 的回调 */
  setFormRef: (el: unknown) => void;
  /** 只读模式：true=隐藏确认按钮，显示关闭按钮 */
  readonly?: boolean;
}>();

/** 抽屉显示状态（v-model:drawerVisible，Vue 3.4+ defineModel 语法糖） */
const drawerVisible = defineModel<boolean>('drawerVisible', { required: true 

});
/** 表单数据（v-model:formData，Vue 3.4+ defineModel 语法糖） */
const formData = defineModel<Record<string, unknown>>('formData', { required: true });

defineEmits<{
  /** 确认提交 */
  (e: 'confirm'): void;
  /** 关闭抽屉 */
  (e: 'close'): void;
}>();
</script>
