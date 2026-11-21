<template>
  <div class="markdown-editor">
    <div class="markdown-editor-toolbar">
      <!-- toolbar 左侧插槽：用于放置字段 label，与编辑/预览按钮同一行 -->
      <slot name="toolbar-left" />
      <t-radio-group
        class="editor-tab-group"
        :value="activeTab"
        variant="default-filled"
        size="small"
        @change="handleTabChange"
      >
        <t-radio-button value="edit">
          {{ t.common.edit }}
        </t-radio-button>
        <t-radio-button value="preview">
          {{ t.common.preview }}
        </t-radio-button>
      </t-radio-group>
    </div>

    <div v-show="activeTab === 'edit'" class="editor-pane" :style="{ height: editorHeight }">
      <file-content
        :ref="setEditorRef"
        :t="t"
        :filename="filename"
        :content="content"
        :empty-content-text="emptyContentText"
        @change="handleContentChange"
      />
    </div>

    <div v-show="activeTab === 'preview'" class="preview-pane custom-scrollbar" :style="{ height: editorHeight }">
      <!-- eslint-disable vue/no-v-html -- 内容经 marked + DOMPurify 净化，或由后端 preview 接口提供 -->
      <div
        v-if="renderedPreviewHtml"
        class="markdown-preview markdown-body"
        v-html="renderedPreviewHtml"
      />
      <!-- eslint-enable vue/no-v-html -->
      <div v-else class="preview-empty">
        <t-icon name="file-copy" size="32px" style="opacity: 0.35; margin-bottom: 8px;" />
        <p>{{ content.trim() ? t.common.previewFailed : t.common.previewEmpty }}</p>
      </div>
    </div>

    <p v-if="contentHelp" class="field-help">{{ contentHelp }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FileContent from '@/components/common/file-content.vue';
import { buildMarkdownFullHtml } from '@/utils/greetings/markdown-preview';
import type { Locale } from '@/locales/zh';
import type { FileContentInstance } from '@/types/component-instances';

/** 编辑/预览切换状态 */
type EditorTab = 'edit' | 'preview';

const props = withDefaults(defineProps<{
  /** i18n 翻译对象（由父组件传入 LocaleStore.t，响应式） */
  t: Locale;
  /** 编辑器虚拟文件名，决定 file-content 的 Markdown 模式 */
  filename?: string;
  /** 空正文占位文案 */
  emptyContentText?: string;
  /** 编辑器下方的说明文案 */
  contentHelp?: string;
  /** 后端已渲染的预览 HTML，传入后优先展示（如消息模板占位符替换结果） */
  previewHtml?: string;
  /** 编辑区与预览区高度 */
  editorHeight?: string;
}>(), {
  /** 默认虚拟文件名 */
  filename: 'document.md',
  /** 默认空正文占位文案 */
  emptyContentText: '',
  /** 默认不展示说明文案 */
  contentHelp: '',
  /** 默认使用前端本地渲染预览 */
  previewHtml: '',
  /** 默认编辑区高度 */
  editorHeight: '360px',
});

/** Markdown 正文（v-model，Vue 3.4+ defineModel 语法糖） */
const content = defineModel<string>({ required: true });

const emit = defineEmits<{
  /** 正文变更时触发，携带最新 Markdown 文本 */
  (e: 'change', value: string): void;
}>();

/** 当前显示的面板 */
const activeTab = ref<EditorTab>('edit');
/** 内层 CodeMirror 编辑器实例，用于对外暴露 getContent / resetEditor */
const editorRef = ref<FileContentInstance | undefined>(undefined);

/** 预览区最终 HTML：后端渲染结果优先，否则用 marked + DOMPurify 实时渲染 */
const renderedPreviewHtml = computed(() => {
  if (props.previewHtml) return props.previewHtml;
  if (!content.value.trim()) return '';
  try {
    return buildMarkdownFullHtml(content.value);
  } catch {
    return '';
  }
});

/**
 * 切换编辑/预览面板
 * @param {string | number} value - t-radio-group 选中的值
 */
const handleTabChange = (value: string | number): void => {
  activeTab.value = value === 'preview' ? 'preview' : 'edit';
};

/** 接收 file-content 的编辑器实例引用 */
const setEditorRef = (el: unknown): void => {
  editorRef.value = el as FileContentInstance | undefined;
};

/**
 * 接收 CodeMirror 编辑器正文变更
 * @param {string} value - 最新 Markdown 正文
 * @param {boolean} _hasError - JSON 模式格式错误标记，Markdown 模式忽略
 */
const handleContentChange = (value: string, _hasError: boolean): void => {
  content.value = value;
  emit('change', value);
};

defineExpose({
  /** 获取编辑器当前内容 */
  getContent: (): string => editorRef.value?.getContent?.() ?? '',
  /** 重新初始化编辑器内容 */
  resetEditor: async (text: string): Promise<void> => {
    await editorRef.value?.resetEditor?.(text);
  },
});
</script>

<style scoped>
@import "@/styles/common.css";

.markdown-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.markdown-editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.editor-tab-group {
  flex-shrink: 0;
  margin-left: auto;
}

.editor-pane,
.preview-pane {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  overflow: hidden;
}

.editor-pane :deep(.file-content-wrap),
.editor-pane :deep(.cm-container) {
  height: 100%;
}

.editor-pane :deep(.cm-content) {
  font-size: 14px;
  line-height: 1.7;
}

.preview-pane {
  padding: 16px 20px;
  overflow: auto;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
}

.preview-empty p {
  margin: 0;
}

.field-help {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4) {
  margin: 18px 0 8px;
  color: var(--text-primary);
  line-height: 1.35;
}

.markdown-preview :deep(h1:first-child),
.markdown-preview :deep(h2:first-child),
.markdown-preview :deep(h3:first-child) {
  margin-top: 0;
}

.markdown-preview :deep(p),
.markdown-preview :deep(li) {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.75;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.markdown-preview :deep(blockquote) {
  padding: 8px 14px;
  margin: 12px 0;
  color: var(--text-muted);
  border-left: 3px solid var(--td-brand-color);
  background: var(--bg-secondary);
}

.markdown-preview :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--bg-secondary);
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
  font-size: 0.9em;
}

.markdown-preview :deep(pre) {
  padding: 14px;
  margin: 12px 0;
  border-radius: 6px;
  background: var(--bg-secondary);
  overflow: auto;
}

.markdown-preview :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-preview :deep(table) {
  width: 100%;
  margin: 12px 0;
  border-collapse: collapse;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  text-align: left;
  font-size: 13px;
}

.markdown-preview :deep(a) {
  color: var(--td-brand-color);
}

.markdown-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .editor-pane,
  .preview-pane {
    height: 300px;
  }

  .preview-pane {
    padding: 12px 14px;
  }
}
</style>
