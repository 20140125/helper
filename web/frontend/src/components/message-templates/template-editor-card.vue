<template>
  <card-panel :title="title" icon="edit" icon-theme="secondary" class="templates-card" full-height>
    <template #actions>
      <t-button
        v-if="canEdit"
        theme="primary"
        size="large"
        @click="handleSave"
      >
        <template #icon><t-icon name="save" /></template>
        {{ t.templates.saveBtn }}
      </t-button>
    </template>

    <div class="edit-layout">
      <!-- 选择器区域 -->
      <div class="selector-area">
        <auto-form
          v-model="selectorValues"
          :fields="selectorFields"
          layout="inline"
        />
      </div>

      <!-- 编辑区：复用通用 Markdown 编辑预览组件，预览优先使用后端渲染结果 -->
      <div class="edit-panel">
        <markdown-editor
          v-model="content"
          :ref="editorRef"
          :t="t"
          filename="template.md"
          :empty-content-text="t.templates.editorPlaceholder"
          :preview-html="previewHtml"
          editor-height="500px"
        />
      </div>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import AutoForm from '@/components/auto-form/index.vue';
import CardPanel from '@/components/common/card-panel.vue';
import MarkdownEditor from '@/components/common/markdown-editor.vue';
import type { Locale } from '@/locales/zh';
import type { AutoFormField } from '@/types/auto-form';

withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 卡片标题 */
  title: string;
  /** 是否允许编辑（权限控制保存按钮） */
  canEdit: boolean;
  /** 选择器表单字段配置 */
  selectorFields: AutoFormField[];
  /** 设置编辑器 ref 的回调 */
  editorRef?: (el: unknown) => void;
  /** 后端 preview 接口渲染后的 HTML，传入后编辑卡片的预览页优先使用 */
  previewHtml?: string;
}>(), {
  /** 默认不传后端预览 HTML，由通用组件本地渲染 */
  previewHtml: '',
});
const emit = defineEmits<{
  /** 保存模板 */
  (e: 'save'): void;
}>();

/** 选择器字段值（v-model:selectorValues，Vue 3.4+ defineModel 语法糖） */
const selectorValues = defineModel<Record<string, unknown>>('selectorValues', { required: true });
/** 编辑器内容（v-model:content，Vue 3.4+ defineModel 语法糖） */
const content = defineModel<string>('content', { required: true });

const handleSave = () => {
  emit('save');
};
</script>

<style scoped>
@import "@/styles/common.css";

.templates-card {
  flex: 1;
  min-width: 0;
}

/* ── 左侧 Card 内部：选择器 + 编辑器纵向排列 ── */
.edit-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 22px;
  gap: 16px;
  overflow: hidden;
}

/* 选择器区域 */
.selector-area {
  flex-shrink: 0;
}

/* 编辑区：高度由通用 Markdown 编辑器决定，不再强制拉伸 */
.edit-panel {
  flex: 0 0 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── 移动端适配（≤768px） ── */
@media (max-width: 768px) {
  /* 左侧编辑 Card 内部：缩小 padding */
  .edit-layout {
    padding: 14px;
    gap: 12px;
  }

  /* 选择器区域：缩小表单项间距 */
  .selector-area :deep(.auto-form--inline) {
    row-gap: 12px !important;
  }

  .selector-area :deep(.auto-form-item) {
    padding-bottom: 4px !important;
  }

  /* 编辑器区域设置固定最小高度，避免太矮 */
  .edit-panel {
    min-height: 200px;
  }
}
</style>
