<template>
  <div class="knowledge-doc-editor">
    <div class="doc-name-field">
      <label class="field-label">{{ t.knowledgeBase.fieldName }}</label>
      <t-input
        v-model="name"
        :placeholder="t.knowledgeBase.fieldNamePlaceholder"
        :maxlength="80"
        :disabled="nameDisabled"
      />
      <p class="field-help">{{ t.knowledgeBase.fieldNameHelp }}</p>
    </div>

    <div class="doc-content-field">
      <markdown-editor
        v-model="content"
        :t="t"
        filename="knowledge.md"
        :empty-content-text="t.knowledgeBase.fieldContentPlaceholder"
        :content-help="t.knowledgeBase.fieldContentHelp"
      >
        <template #toolbar-left>
          <label class="field-label">{{ t.knowledgeBase.fieldContent }}</label>
        </template>
      </markdown-editor>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownEditor from '@/components/common/markdown-editor.vue';
import type { Locale } from '@/locales/zh';

withDefaults(defineProps<{
  /** i18n 翻译对象（由父组件传入 LocaleStore.t，响应式） */
  t: Locale;
  /** 编辑态禁用文档名输入（文档名是业务主键） */
  nameDisabled?: boolean;
}>(), {
  /** 默认允许编辑文档名 */
  nameDisabled: false,
});

/** 文档名（v-model:name，Vue 3.4+ defineModel 语法糖） */
const name = defineModel<string>('name', { required: true });
/** Markdown 正文（v-model:content，Vue 3.4+ defineModel 语法糖） */
const content = defineModel<string>('content', { required: true });
</script>

<style scoped>
@import "@/styles/common.css";

.knowledge-doc-editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.doc-name-field,
.doc-content-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.field-help {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}
</style>
