<template>
  <t-drawer
    v-model:visible="modelValue"
    :header="$slots.header ? undefined : header"
    :size="drawerSize"
    attach="body"
    :close-btn="showHeaderClose"
    :confirm-btn="finalConfirmBtn"
    :cancel-btn="finalCancelBtn"
    :close-on-esc="false"
    :close-on-overlay-click="false"
    @confirm="$emit('confirm')"
    @close="$emit('close')"
  >
    <!-- header 具名 slot：父组件可完全自定义 header（覆盖 :header 字符串） -->
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <slot />
  </t-drawer>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { FormMode } from '@/constants/form';
import type { Locale } from '@/types/locale';

const props = withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 抽屉标题 */
  header: string;
  /** 确认按钮 loading 状态 */
  loading?: boolean;
  /** 表单模式：Create=新增（默认），Edit=编辑，View=只读/保存 */
  mode?: FormMode;
  /** 确认按钮文案（显式覆盖 mode 映射，用于如"执行发送"等特殊文案） */
  confirmText?: string;
  /** 桌面端宽度，默认 720px */
  desktopSize?: string;
  /** 移动端宽度，默认 92vw */
  mobileSize?: string;
  /** 是否为移动端 */
  isMobile?: boolean;
  /** 只读模式：true=隐藏确认按钮，显示关闭按钮 */
  readonly?: boolean;
  /** 取消按钮显式覆盖：传 null 彻底隐藏取消按钮（与 readonly + 自定义 header 关闭按钮配合使用） */
  cancelBtn?: unknown;
  /** 是否在 header 右上角显示 t-drawer 自带的关闭按钮，默认 false */
  showHeaderClose?: boolean;
}>(), {
  loading: false,
  mode: FormMode.Create,
  confirmText: '',
  desktopSize: '50%',
  mobileSize: '100vw',
  isMobile: false,
  readonly: false,
  cancelBtn: undefined,
  showHeaderClose: false,
});

defineEmits<{
  /** 点击确认按钮 */
  (e: 'confirm'): void;
  /** 关闭抽屉（点击关闭/遮罩） */
  (e: 'close'): void;
}>();

/** 抽屉显示状态（v-model，Vue 3.4+ defineModel 语法糖） */
const modelValue = defineModel<boolean>({ required: true });

const drawerSize = computed(() => props.isMobile ? props.mobileSize : props.desktopSize);

/** 按优先级决定确认按钮文案：显式 confirmText > mode 自动映射 > 兜底 saveBtn */
const resolvedConfirmText = computed(() => {
  if (props.confirmText) return props.confirmText;
  const c = props.t.components;
  if (props.mode === FormMode.Edit) return c.confirmEdit;
  if (props.mode === FormMode.Create) return c.confirmCreate;
  return c.saveBtn;
});

const confirmBtn = computed(() => ({
  content: resolvedConfirmText.value,
  loading: props.loading,
  size: 'large' as const,
}));

/** 最终确认按钮配置：只读模式下隐藏确认按钮 */
const finalConfirmBtn = computed(() => {
  return props.readonly ? null : confirmBtn.value;
});

/** 最终取消按钮配置：cancelBtn=null 显式隐藏；否则只读模式下显示「关闭」，普通模式下显示「取消」 */
const finalCancelBtn = computed(() => {
  if (props.cancelBtn === null) {
    return null;
  }
  return {
    content: props.readonly ? props.t.common.close : props.t.common.cancel,
    size: 'large' as const,
  };
});
</script>
