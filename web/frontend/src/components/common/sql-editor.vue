<template>
  <div
    ref="editorContainer"
    class="sql-editor custom-scrollbar"
    :style="{ '--sql-editor-min-height': minHeight, '--sql-editor-max-height': maxHeight }"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { sql, MySQL } from '@codemirror/lang-sql';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';

const props = withDefaults(defineProps<{
  /** 编辑器冷值：切换内容时重新载入，用户输入不回写此值 */
  content: string;
  /** 是否只读（脚本 / 建表语句预览） */
  readonly?: boolean;
  /** 空内容占位文案 */
  placeholder?: string;
  /** 可补全的表名清单 */
  tableNames?: string[];
  /** 编辑器最小高度 */
  minHeight?: string;
  /** 编辑器最大高度 */
  maxHeight?: string;
}>(), {
  /** 默认可编辑 */
  readonly: false,
  /** 默认不显示占位文案 */
  placeholder: '',
  /** 默认不提供表名补全 */
  tableNames: () => [],
  /** 默认最小高度 */
  minHeight: '120px',
  /** 默认最大高度 */
  maxHeight: '360px',
});

const emit = defineEmits<{
  /** 内容变更，携带编辑器最新文本 */
  (e: 'change', value: string): void;
  /** Ctrl / ⌘ + Enter 快捷键触发 */
  (e: 'submit'): void;
}>();

const editorContainer = ref<HTMLElement | null>(null);
let editorView: EditorView | null = null;
let themeObserver: MutationObserver | null = null;
/** SQL 语言扩展的独立舱位：表清单变化后可热更新补全词库 */
const sqlCompartment = new Compartment();
/** 占位文案的独立舱位：语言切换时无需重建编辑器 */
const localeCompartment = new Compartment();

const isLightTheme = (): boolean => {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  return theme === 'light' || theme === 'light-blue';
};

/** 构造 MySQL 语言扩展，表名补全词库由调用方提供 */
const buildSqlExtension = (): Extension => sql({
  dialect: MySQL,
  schema: Object.fromEntries(props.tableNames.map((name): [string, string[]] => [name, []])),
  upperCaseKeywords: true,
});

/** 编辑器基础外观：沿用页面主题变量与等宽字体 */
const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', fontSize: '13px' },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    lineHeight: '1.6',
    padding: '10px 0',
    minHeight: '120px',
  },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)' },
  '.cm-activeLine': { backgroundColor: 'rgba(99,102,241,0.06)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(99,102,241,0.08)' },
  '.cm-placeholder': { color: 'var(--text-muted)' },
}, { dark: false });

const buildExtensions = (light: boolean): Extension[] => [
  lineNumbers(),
  foldGutter(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  EditorState.readOnly.of(props.readonly),
  EditorView.editable.of(!props.readonly),
  ...(props.readonly ? [] : [
    history(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
  ]),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  sqlCompartment.of(buildSqlExtension()),
  localeCompartment.of(cmPlaceholder(props.placeholder)),
  EditorView.lineWrapping,
  keymap.of([
    ...(props.readonly ? [] : [{ key: 'Mod-Enter', run: () => { emit('submit'); return true; } }]),
    ...defaultKeymap,
    ...(props.readonly ? [] : historyKeymap),
  ]),
  ...(light ? [] : [oneDark]),
  baseTheme,
  EditorView.updateListener.of((update) => {
    if (!update.docChanged || props.readonly) return;
    // 热值：输入只 emit，不因 content 变化重建编辑器，避免光标回跳
    emit('change', update.state.doc.toString());
  }),
];

const initEditor = (doc: string): void => {
  editorView?.destroy();
  editorView = null;
  if (!editorContainer.value) return;
  editorView = new EditorView({
    state: EditorState.create({ doc, extensions: buildExtensions(isLightTheme()) }),
    parent: editorContainer.value,
  });
};

/** 外部内容变化：只读场景重建以重置滚动位置，可编辑场景用 dispatch 保留实例 */
const syncContent = (value: string): void => {
  const view = editorView;
  if (!view || view.state.doc.toString() === value) return;
  if (props.readonly) {
    initEditor(value);
    return;
  }
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
};

watch(() => props.content, syncContent);

watch(() => props.tableNames, () => {
  editorView?.dispatch({ effects: sqlCompartment.reconfigure(buildSqlExtension()) });
});

watch(() => props.placeholder, (text: string) => {
  editorView?.dispatch({ effects: localeCompartment.reconfigure(cmPlaceholder(text)) });
});

const observeTheme = (): void => {
  themeObserver = new MutationObserver(() => {
    initEditor(editorView?.state.doc.toString() ?? props.content);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
};

onMounted(async () => {
  await nextTick();
  initEditor(props.content);
  observeTheme();
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  editorView?.destroy();
});
</script>

<style scoped>
@import "@/styles/scrollbar.css";

.sql-editor {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.sql-editor :deep(.cm-editor) {
  min-height: var(--sql-editor-min-height, 120px);
  outline: none;
}

.sql-editor :deep(.cm-scroller) {
  max-height: var(--sql-editor-max-height, 360px);
  overflow: auto;
}
</style>
