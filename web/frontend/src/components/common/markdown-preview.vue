<template>
  <div class="markdown-preview-wrap">
    <!-- eslint-disable vue/no-v-html -- rendered with marked + DOMPurify, or provided by backend preview API -->
    <div v-if="renderedHtml" class="markdown-preview markdown-body" v-html="renderedHtml" />
    <!-- eslint-enable vue/no-v-html -->
    <div v-else class="preview-empty">
      <t-icon name="file-copy" size="32px" style="opacity: 0.35; margin-bottom: 8px;" />
      <p>{{ content.trim() ? t.common.previewFailed : t.common.previewEmpty }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { buildMarkdownFullHtml } from '@/utils/greetings/markdown-preview';
import type { Locale } from '@/types/locale';

const props = withDefaults(defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** Markdown 源码，未传 html 时由前端实时渲染 */
  content?: string;
  /** 已渲染的 HTML（如后端预览结果），传入后优先展示 */
  html?: string;
}>(), {
  content: '',
  html: '',
});

/** 最终渲染的 HTML：后端结果优先，否则用 marked + DOMPurify 本地渲染 */
const renderedHtml = computed(() => {
  if (props.html) return props.html;
  if (!props.content.trim()) return '';
  try {
    return buildMarkdownFullHtml(props.content);
  } catch {
    return '';
  }
});
</script>

<style scoped>
@import "@/styles/common.css";

.markdown-preview-wrap {
  height: 100%;
  min-width: 0;
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
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
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
</style>
