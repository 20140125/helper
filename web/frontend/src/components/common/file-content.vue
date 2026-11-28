<template>
  <div class="file-content-wrap">
    <!-- 未选中状态 -->
    <div v-if="!filename" class="empty-tip">
      <t-icon name="file-code" size="40px" style="color: var(--text-muted);" />
      <p style="color: var(--text-muted);">{{ displayEmptyText }}</p>
    </div>

    <!-- 加载中 -->
    <div v-else-if="loading" class="empty-tip">
      <loading-spinner :t="t" :size="20" text="" />
    </div>

    <!-- JSON 编辑器模式 -->
    <template v-else-if="isJsonMode">
      <!-- JSON 格式错误提示 -->
      <div v-if="jsonError" class="json-error-bar">
        <t-icon name="close-circle" size="14px" />
        <span>{{ jsonError }}</span>
      </div>
      <div ref="editorContainer" class="cm-container custom-scrollbar" />
    </template>

    <!-- Markdown 编辑器模式 -->
    <template v-else-if="isMarkdownMode">
      <div ref="editorContainer" class="cm-container" />
    </template>

    <!-- 纯文本模式（log / txt 等） -->
    <template v-else>
      <div v-if="!content" class="empty-tip">
        <t-icon name="file-unknown" size="40px" style="color: var(--text-muted);" />
        <p style="color: var(--text-muted);">{{ displayEmptyContentText }}</p>
      </div>
      <pre v-else ref="plainContentRef" class="plain-text custom-scrollbar">{{ cleanContent }}</pre>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import LoadingSpinner from '@/components/common/loading-spinner.vue';
import type { Locale } from '@/types/locale';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';

const props = withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 当前文件名（含后缀），为空时显示空状态 */
  filename: string;
  /** 文件文本内容 */
  content: string;
  /** 是否加载中 */
  loading?: boolean;
  /** 未选中文件时的提示文字 */
  emptyText?: string;
  /** 文件内容为空时的提示文字 */
  emptyContentText?: string;
  /** 是否只读（仅 JSON 模式生效） */
  readonly?: boolean;
}>(), {
  loading: false,
  emptyText: '',
  emptyContentText: '',
  readonly: false,
});

/** 未选中文件时的提示文字（prop 优先，fallback 到 locale） */
const displayEmptyText = computed(() => props.emptyText || props.t.cache.emptyHint);
/** 文件内容为空时的提示文字（prop 优先，fallback 到 locale） */
const displayEmptyContentText = computed(() => props.emptyContentText || props.t.cache.emptyContent);

// ─── Emits ───────────────────────────────────────────────────────────────────

const emit = defineEmits<{


  /** JSON 内容变更时触发，携带最新内容和是否有格式错误 */
  (e: 'change', content: string, hasError: boolean): void;
}>();

// ─── 模式判断 ─────────────────────────────────────────────────────────────────

/** 去除 ANSI 转义码（兜底处理，防止日志文件含终端颜色码） */
const stripAnsi = (str: string): string =>
  str
    ? str.replace(
        // eslint-disable-next-line no-control-regex -- ANSI 转义码本身就是控制字符，只能按码点匹配
        /[\x1b\x9b][[\]()#;?]*(?:(?:(?:;[-\w/#&.:=?%@~])*|[a-zA-Z\d]*(?:;[-\w/#&.:=?%@~]*)*)?\x07|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g,
        '',
      )
    : '';
/** 纯文本模式下去除 ANSI 转义码后的内容 */
const cleanContent = computed(() => stripAnsi(props.content));

/** 从 filename 中提取小写后缀 */
const fileExt = computed(() => {
  if (!props.filename) return '';
  return props.filename.split('.').pop()?.toLowerCase() ?? '';
});

const isJsonMode = computed(() => fileExt.value === 'json');

const isMarkdownMode = computed(() => fileExt.value === 'md' || fileExt.value === 'markdown');

/** 是否启用 CodeMirror 编辑器（JSON / Markdown 均使用 CodeMirror） */
const isEditorMode = computed(() => isJsonMode.value || isMarkdownMode.value);

// ─── JSON 编辑器 ──────────────────────────────────────────────────────────────

const editorContainer = ref<HTMLElement | null>(null);
const plainContentRef = ref<HTMLElement | null>(null);
const jsonError = ref('');
let editorView: EditorView | null = null;
/** 当前编辑器对应的文件名：文件名变化时必须重建（语法模式可能不同） */
let editorFilename = '';

const isLightTheme = () => {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  return theme === 'light' || theme === 'light-blue';
};

const lightTheme = EditorView.theme({
  '&': { color: '#1a1d2e', backgroundColor: 'transparent' },
  '.cm-content': {
    caretColor: '#6366f1',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '13px',
    lineHeight: '1.6',
  },
  '.cm-cursor': { borderLeftColor: '#6366f1' },
  '.cm-gutters': {
    backgroundColor: '#f8f9fc',
    color: '#9ca3af',
    border: 'none',
    borderRight: '1px solid rgba(99,102,241,0.15)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(99,102,241,0.08)' },
  '.cm-activeLine': { backgroundColor: 'rgba(99,102,241,0.06)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(99,102,241,0.2) !important' },
  '.cm-foldPlaceholder': { backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366f1', border: 'none' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(99,102,241,0.2)', outline: '1px solid rgba(99,102,241,0.4)' },
  '.cm-tooltip': { backgroundColor: '#ffffff', border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'rgba(99,102,241,0.15)', color: '#1a1d2e' },
}, { dark: false });

const darkTheme = EditorView.theme({
  '&': { color: '#e6edf3', backgroundColor: 'transparent' },
  '.cm-content': {
    caretColor: '#818cf8',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '13px',
    lineHeight: '1.6',
  },
  '.cm-cursor': { borderLeftColor: '#818cf8' },
  '.cm-gutters': {
    backgroundColor: '#1a1d2e',
    color: '#484f58',
    border: 'none',
    borderRight: '1px solid rgba(99,102,241,0.15)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(99,102,241,0.1)' },
  '.cm-activeLine': { backgroundColor: 'rgba(99,102,241,0.07)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(99,102,241,0.25) !important' },
  '.cm-foldPlaceholder': { backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: 'none' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(99,102,241,0.25)', outline: '1px solid rgba(99,102,241,0.5)' },
  '.cm-tooltip': { backgroundColor: '#1c2333', border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'rgba(99,102,241,0.2)', color: '#e6edf3' },
}, { dark: true });

const buildExtensions = (light: boolean) => {
  /** Markdown 模式下使用 markdown() 语法，其他场景默认 JSON */
  const langExtension = isMarkdownMode.value ? markdown() : json();

  /** Markdown 模式下关闭行号以获得更接近普通编辑器的观感 */
  const gutterExtensions = isMarkdownMode.value ? [] : [lineNumbers(), foldGutter()];

  return [
    ...gutterExtensions,
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    langExtension,
    // Markdown 模式启用软换行，避免长行溢出编辑器
    isMarkdownMode.value ? EditorView.lineWrapping : [],
    keymap.of([...defaultKeymap, ...historyKeymap]),
    light ? lightTheme : darkTheme,
    light ? [] : oneDark,
    EditorView.editable.of(!props.readonly),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const text = update.state.doc.toString();
      let hasError = false;
      // 仅 JSON 模式校验格式；Markdown / 其他模式不产生校验错误
      if (isJsonMode.value) {
        try {
          JSON.parse(text);
          jsonError.value = '';
        } catch (e: unknown) {
          jsonError.value = `${props.t.cache.jsonParseError}${(e as Error).message}`;
          hasError = true;
        }
      } else {
        jsonError.value = '';
      }
      emit('change', text, hasError);
    }),
  ];
};

const initEditor = (text: string) => {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
  if (!editorContainer.value) return;
  editorFilename = props.filename;

  const light = isLightTheme();
  const state = EditorState.create({
    doc: text,
    extensions: buildExtensions(light),
  });
  editorView = new EditorView({ state, parent: editorContainer.value });
};

const updateEditorTheme = () => {
  if (!editorView) return;
  const text = editorView.state.doc.toString();
  initEditor(text);
};

/** 供父组件调用：获取编辑器当前内容 */
const getContent = () => editorView?.state.doc.toString() ?? '';

/** 供父组件调用：重新初始化编辑器（切换文件后调用） */
const resetEditor = async (text: string) => {
  await nextTick();
  initEditor(text);
};

defineExpose({ getContent, resetEditor });

// ─── 主题监听 ─────────────────────────────────────────────────────────────────

let themeObserver: MutationObserver | null = null;

const observeTheme = () => {
  themeObserver = new MutationObserver(() => updateEditorTheme());
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
};

// ─── 纯文本模式：内容变化后自动滚到底部 ────────────────────────────────────────

watch(
  () => [props.content, props.loading],
  async ([newContent, newLoading]) => {
    if (isEditorMode.value || newLoading || !newContent) return;
    await nextTick();
    if (plainContentRef.value) {
      plainContentRef.value.scrollTop = plainContentRef.value.scrollHeight;
    }
  },
);

// ─── 监听 content 变化，自动刷新编辑器 ────────────────────────────────────────

watch(
  () => [props.filename, props.content, props.loading],
  async ([newFilename, , newLoading]) => {
    if (!newFilename || newLoading) return;
    if (isEditorMode.value) {
      // 用户输入回写导致的 content 变化：编辑器里已是同一份文本，跳过重建以免光标回跳
      if (editorView && editorFilename === props.filename
        && editorView.state.doc.toString() === props.content) return;
      await nextTick();
      initEditor(props.content);
    }
  },
);

// ─── 生命周期 ─────────────────────────────────────────────────────────────────

observeTheme();

// 首次挂载时：若已处于 JSON 模式且有 filename + content，必须主动初始化编辑器
// 否则（watch 默认非 immediate）首屏 CodeMirror 不会渲染，导致编辑器空白
onMounted(async () => {
  if (!props.filename || props.loading) return;
  if (isEditorMode.value) {
    await nextTick();
    initEditor(props.content);
  }
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  editorView?.destroy();
});
</script>

<style scoped>
@import "@/styles/common.css";
@import "@/styles/scrollbar.css";

.file-content-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}


/* ── JSON 编辑器 ── */
.json-error-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(244, 63, 94, 0.1);
  border-bottom: 1px solid rgba(244, 63, 94, 0.2);
  color: #f43f5e;
  font-size: 12px;
  flex-shrink: 0;
}

.cm-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.cm-container :deep(.cm-editor) {
  height: 100%;
  outline: none;
}

.cm-container :deep(.cm-scroller) {
  overflow: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  /* 移动端触摸滚动支持 */
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pan-y;
}

/* 行号列：position:sticky 使其在横向滚动时固定在左侧
   z-index 高于内容区，确保行号始终在文字上层
   背景色必须不透明，否则文字会透过来 */
.cm-container :deep(.cm-gutters) {
  position: sticky !important;
  left: 0 !important;
  z-index: 10 !important;
}

.cm-container :deep(.cm-content) {
  position: relative !important;
  z-index: 1 !important;
}


</style>