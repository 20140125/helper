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
        <div class="content-split">
          <!-- 左：Markdown 编辑器 -->
          <div class="content-split-col markdown-editor-wrap">
            <file-content
              :t="t"
              :ref="setEditorRef"
              filename="greeting.md"
              :content="editorContent"
              :empty-content-text="t.greetings.contentPlaceholder"
              @change="handleEditorChange"
            />
          </div>
          <!-- 右：实时预览 -->
          <div class="content-split-col content-preview-wrap">
            <div class="content-preview-title">
              <t-icon name="browse" size="14px" style="margin-right: 4px;" />
              {{ t.greetings.previewTitle }}
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -- 实时预览：内容已由 DOMPurify 净化 -->
            <div class="content-preview markdown-body" v-html="editorContentHtml" />
          </div>
        </div>
      </template>
    </auto-form>
  </form-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Ref } from 'vue';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize-html';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import FileContent from '@/components/common/file-content.vue';
import type { GreetingItem } from '@/types/greetings';
import type { Locale } from '@/locales/zh';
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
const editorRef: Ref<InstanceType<typeof FileContent> | undefined> = ref(undefined);

// 将编辑器内容实时渲染为 HTML（开启 breaks，单个 \n 渲染为 <br>）
const editorContentHtml = computed(() => {
  const content = editorContent.value;
  if (!content) return '';
  return sanitizeHtml(marked.parse(content, { breaks: true }) as string);
});

// 设置 FileContent 编辑器组件实例引用
const setEditorRef = (el: unknown): void => {
  editorRef.value = el as InstanceType<typeof FileContent> | undefined;
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
/* ── 抽屉内 Markdown 编辑器 & 预览区（左右两栏，置于 auto-form 的 #content-content 插槽内） ── */
.content-split {
  display: flex;
  gap: 12px;
  align-items: stretch;
  width: 100%;
  min-height: 260px;
}

.content-split-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.markdown-editor-wrap {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  overflow: hidden;
  min-height: 260px;
}

.markdown-editor-wrap :deep(.cm-content) {
  font-size: 14px;
  line-height: 1.7;
}

.content-preview-wrap {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.content-preview-title {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  flex-shrink: 0;
}

.content-preview {
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.8;
  word-break: break-word;
  color: var(--text-primary);
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* 移动端：左右栏折叠为上下 */
@media (max-width: 768px) {
  .content-split {
    flex-direction: column;
    min-height: 0;
  }

  .markdown-editor-wrap {
    min-height: 200px;
  }
}

/* Markdown 渲染样式（与消息模板页保持一致） */
.content-preview.markdown-body :deep(h1),
.content-preview.markdown-body :deep(h2),
.content-preview.markdown-body :deep(h3),
.content-preview.markdown-body :deep(h4) {
  font-weight: 600;
  margin: 12px 0 6px;
  color: var(--text-primary);
}

.content-preview.markdown-body :deep(h1) { font-size: 18px; }
.content-preview.markdown-body :deep(h2) { font-size: 16px; }
.content-preview.markdown-body :deep(h3) { font-size: 15px; }

.content-preview.markdown-body :deep(p) {
  margin: 6px 0;
}

.content-preview.markdown-body :deep(strong) {
  font-weight: 600;
  color: var(--text-primary);
}

.content-preview.markdown-body :deep(em) {
  font-style: italic;
}

.content-preview.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--accent-primary);
  margin: 8px 0;
  padding: 4px 12px;
  color: var(--text-muted);
  background: var(--bg-primary);
  border-radius: 0 4px 4px 0;
}

.content-preview.markdown-body :deep(ul),
.content-preview.markdown-body :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}

.content-preview.markdown-body :deep(li) {
  margin: 3px 0;
}

.content-preview.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 12px 0;
}

.content-preview.markdown-body :deep(code) {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.content-preview.markdown-body :deep(pre) {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
}
</style>
