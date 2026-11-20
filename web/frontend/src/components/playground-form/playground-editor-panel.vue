<template>
  <card-panel
    :title="t.playground.panelEditor"
    icon="code"
    icon-theme="secondary"
    class="playground-editor"
    full-height
  >
    <template #actions>
      <div class="panel-actions">
        <t-button size="large" variant="text" @click="$emit('format-json')">
          <template #icon><t-icon name="format-horizontal-align-center" /></template>
          {{ t.playground.btnFormat }}
        </t-button>
        <t-button size="large" variant="text" @click="$emit('copy-json')">
          <template #icon><t-icon name="file-copy" /></template>
          {{ t.playground.btnCopy }}
        </t-button>
        <t-button v-if="canEdit" size="large" variant="text" @click="$emit('save-template')">
          <template #icon><t-icon name="save" /></template>
          {{ t.playground.btnSave }}
        </t-button>
      </div>
    </template>

    <!-- 模板快速切换 -->
    <div class="template-tabs">
      <t-tag
        v-for="(tpl, idx) in templates"
        :key="idx"
        size="large"
        :theme="activeTemplateIndex === idx ? 'primary' : 'default'"
        class="template-tag"
        :closable="!tpl.category && canEdit"
        @click.self="$emit('apply-template', idx)"
        @close="() => $emit('delete-template', idx)"
      >
        {{ resolveI18nString(tpl.label) }}
      </t-tag>
      <t-input
        v-if="isAddingTemplate"
        :value="newTemplateName"
        size="large"
        class="template-name-input"
        autofocus
        @keydown.enter="$emit('add-template')"
        @keydown.esc="$emit('cancel-add-template')"
        @blur="$emit('add-template')"
      />
      <t-button v-if="canEdit" size="large" variant="text" @click="$emit('start-add-template')">
        <template #icon><t-icon name="add" /></template>
        {{ t.playground.btnAdd }}
      </t-button>
    </div>

    <!-- JSON 文本编辑区 -->
    <div class="editor-wrap">
      <file-content
        :t="t"
        :ref="setFileContentRef"
        filename="config.json"
        :content="jsonText"
        @change="(content: string, hasError: boolean) => $emit('editor-change', content, hasError)"
      />
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import FileContent from '@/components/common/file-content.vue';
import CardPanel from '@/components/common/card-panel.vue';
import type { TemplateItem } from '@/types/playground';
import { resolveI18nString as resolveI18nRaw } from '@/utils/field-enhancer';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 模板列表 */
  templates: TemplateItem[];
  /** 当前 JSON 文本 */
  jsonText: string;
  /** 当前选中的模板下标 */
  activeTemplateIndex: number;
  /** 是否允许编辑（权限控制） */
  canEdit: boolean;
  /** 是否正在输入新模板名 */
  isAddingTemplate: boolean;
  /** 新模板名输入框当前值 */
  newTemplateName: string;
}>();

const emit = defineEmits<{
  /** 格式化 JSON */
  (e: 'format-json'): void;
  /** 复制 JSON 到剪贴板 */
  (e: 'copy-json'): void;
  /** 保存当前模板 */
  (e: 'save-template'): void;
  /** 应用指定下标的模板 */
  (e: 'apply-template', index: number): void;
  /** 删除指定下标的模板 */
  (e: 'delete-template', index: number): void;
  /** 提交新增模板（输入名称后回车 / 失焦） */
  (e: 'add-template'): void;
  /** 取消新增模板 */
  (e: 'cancel-add-template'): void;
  /** 开始新增模板（展示名称输入框） */
  (e: 'start-add-template'): void;
  /** 编辑器内容变化，传出内容与是否有语法错误 */
  (e: 'editor-change', content: string, hasError: boolean): void;
  /** 设置 FileContent 组件实例引用 */
  (e: 'set-file-content-ref', el: unknown): void;
}>();



/**
 * 将可能带 $t: 前缀的 label 解析为当前语言下的字符串
 */
const resolveI18nString = (val: unknown): string => {
  const ret = resolveI18nRaw(val);
  return typeof ret === 'string' ? ret : String(ret ?? '');
};

/**
 * 设置 FileContent 组件实例引用
 */
const setFileContentRef = (el: unknown): void => {
  emit('set-file-content-ref', el);
};
</script>

<style scoped>
.playground-editor {
  width: 600px;
  flex-shrink: 0;
  overflow: hidden;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.template-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.template-tag {
  cursor: pointer;
  user-select: none;
}

.template-name-input {
  width: 120px;
}

.editor-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (max-width: 900px) {
  .playground-editor {
    width: 100%;
    height: 400px;
  }

  .panel-actions {
    flex-wrap: wrap;
  }

  .template-tabs {
    padding: 8px 12px;
    gap: 4px;
  }
}
</style>
