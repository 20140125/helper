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

      <!-- 编辑区：使用项目内置的 Markdown 编辑器（file-content md 模式） -->
      <div class="edit-panel">
        <div class="editor-wrap markdown-editor-wrap">
          <file-content
            :ref="editorRef"
            :t="t"
            filename="template.md"
            :content="content"
            :empty-content-text="t.templates.editorPlaceholder"
            @change="content = $event"
          />
        </div>
      </div>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import AutoForm from '@/components/auto-form/index.vue';
import CardPanel from '@/components/common/card-panel.vue';
import FileContent from '@/components/common/file-content.vue';
import type { Locale } from '@/locales/zh';
import type { AutoFormField } from '@/types/auto-form';

defineProps<{
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
}>();
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

/* 编辑区 */
.edit-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 编辑器 */
.editor-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Markdown 编辑器容器：统一边框与圆角，保持与原 textarea 相似的视觉风格 */
.markdown-editor-wrap {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  overflow: hidden;
}

.markdown-editor-wrap :deep(.cm-content) {
  font-size: 14px;
  line-height: 1.7;
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

  .markdown-editor-wrap {
    min-height: 200px;
  }

  /* 编辑器字号适配小屏 */
  .markdown-editor-wrap :deep(.cm-content) {
    font-size: 13px;
    line-height: 1.6;
  }
}
</style>
