<template>
  <form-drawer
    v-model="localVisible"
    :t="t"
    :header="editingGreeting ? t.greetings.editHeader : t.greetings.createHeader"
    :mode="mode"
    :is-mobile="isMobile"
    :readonly="!canEdit"
    @confirm="handleConfirm"
    @close="handleClose"
  >
    <auto-form
      v-model="localFormData"
      :fields="fields"
    >
      <!-- #content-content 插槽：替换 content 字段的控件，label 仍由 auto-form 渲染保持对齐 -->
      <template #content-content>
        <markdown-editor
          v-model="editorContent"
          :ref="setEditorRef"
          :t="t"
          filename="greeting.md"
          :empty-content-text="t.greetings.contentPlaceholder"
          editor-height="300px"
          @change="handleEditorChange"
        />
      </template>
    </auto-form>
  </form-drawer>
</template>

<script setup lang="ts">
import { ref, watch, type Ref } from 'vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import MarkdownEditor from '@/components/common/markdown-editor.vue';
import type { FileContentInstance } from '@/types/component-instances';
import type { GreetingItem } from '@/types/greetings';
import type { Locale } from '@/types/locale';
import type { FormMode } from '@/constants/form';
import type { AutoFormField } from '@/types/auto-form';


defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 表单模式：Create=新增，Edit=编辑 */
  mode: FormMode;
  /** 是否为移动端 */
  isMobile: boolean;
  /** 是否允许编辑（权限控制提交按钮） */
  canEdit: boolean;
  /** 当前正在编辑的祝福语条目，新增时为 null */
  editingGreeting: GreetingItem | null;
  /** auto-form 字段配置 */
  fields: AutoFormField[];
}>();

const emit = defineEmits<{
  /** 点击确认 */
  (e: 'confirm', formData: Partial<GreetingItem>): void;
  /** 点击关闭 */
  (e: 'close'): void;
  /** 编辑器内容变更 */
  (e: 'editor-change', content: string): void;
}>();

/** 抽屉显示状态（v-model，Vue 3.4+ defineModel 语法糖） */
const localVisible = defineModel<boolean>('visible', { required: true 

});
/** 表单数据（v-model:formData，Vue 3.4+ defineModel 语法糖） */
const localFormData = defineModel<Partial<GreetingItem>>('formData', { required: true });

// Markdown 编辑器状态
const editorContent: Ref<string> = ref('');
const editorRef: Ref<FileContentInstance | undefined> = ref(undefined);

// 设置通用 Markdown 编辑器实例引用
const setEditorRef = (el: unknown): void => {
  editorRef.value = el as FileContentInstance | undefined;
};

// 处理 Markdown 编辑器内容变更
const handleEditorChange = (content: string): void => {
  editorContent.value = content;
  emit('editor-change', content);
  localFormData.value = { ...localFormData.value, content };
};

// 提交表单
const handleConfirm = (): void => {
  emit('confirm', localFormData.value);
};

// 关闭抽屉
const handleClose = (): void => {
  emit('close');
};

// 将外部内容同步到编辑器
const syncEditorContent = (content: string): void => {
  editorContent.value = content;
  // 等待抽屉渲染后再 reset（编辑器初始化后才能调用）
  void Promise.resolve().then(async () => {
    await Promise.resolve();
    if (editorRef.value && typeof editorRef.value.resetEditor === 'function') {
      await editorRef.value.resetEditor(content);
    }
  });
};

// 监听 formData 变化，同步编辑器内容
watch(
  () => localFormData.value?.content,
  (newContent) => {
    if (newContent !== undefined && newContent !== editorContent.value) {
      syncEditorContent(newContent);
    }
  },
  { immediate: true }
);
</script>

<style scoped>
/* Markdown 编辑与预览样式已统一收敛到 common/markdown-editor.vue */
</style>
