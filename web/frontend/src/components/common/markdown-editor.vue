 <template>
  <div class="markdown-editor">
    <div class="markdown-editor-toolbar">
      <!-- toolbar-left slot: field label shares the row with the edit/preview switch -->
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
        :readonly="readonly"
        @change="handleContentChange"
      />
    </div>

    <div v-show="activeTab === 'preview'" class="preview-pane custom-scrollbar" :style="{ height: editorHeight }">
      <markdown-preview :t="t" :content="content" :html="previewHtml" />
    </div>

    <p v-if="contentHelp" class="field-help">{{ contentHelp }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FileContent from '@/components/common/file-content.vue';
import MarkdownPreview from '@/components/common/markdown-preview.vue';
import type { Locale } from '@/types/locale';
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
  /** 首次打开时的面板（查看场景传 preview，直接看渲染结果） */
  defaultTab?: EditorTab;
  /** 是否只读（查看场景为 true，只允许切换源码/预览） */
  readonly?: boolean;
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
  /** 默认打开编辑面板 */
  defaultTab: 'edit',
  /** 默认可编辑 */
  readonly: false,
});

/** Markdown 正文（v-model，Vue 3.4+ defineModel 语法糖） */
const content = defineModel<string>({ required: true });

const emit = defineEmits<{
  /** 正文变更时触发，携带最新 Markdown 文本 */
  (e: 'change', value: string): void;
}>();

/** 当前显示的面板（首次打开时由 defaultTab 决定） */
const activeTab = ref<EditorTab>(props.defaultTab);
/** 内层 CodeMirror 编辑器实例，用于对外暴露 getContent / resetEditor */
const editorRef = ref<FileContentInstance | undefined>(undefined);

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

.field-help {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
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
