<template>
  <form-drawer
    v-model="visibleModel"
    :t="t"
    :header="isCreate ? t.cacheAdmin.createHeader : t.cacheAdmin.editHeader"
    :mode="isCreate ? FormMode.Create : FormMode.Edit"
    :is-mobile="isMobile"
    :loading="loading"
    :readonly="readonly"
    @confirm="emit('confirm')"
  >
    <div class="cache-admin-editor">
      <section class="cache-admin-meta">
        <div class="cache-admin-meta-head">
          <span class="cache-admin-meta-title">{{ t.cacheAdmin.metaTitle }}</span>
          <t-tag v-if="row" :theme="periodTheme(row.periodType)" variant="light" size="small">
            {{ cachePeriodLabel(row.periodType, t) }}{{ row.periodKey ? ` · ${row.periodKey}` : '' }}
          </t-tag>
        </div>
        <div class="cache-admin-meta-grid">
          <div class="cache-admin-meta-item">
            <span>{{ t.cacheAdmin.colTable }}</span>
            <b>{{ row?.table ?? formModel.table }}</b>
          </div>
          <div v-if="row?.section" class="cache-admin-meta-item">
            <span>{{ t.cacheAdmin.colSection }}</span>
            <b>{{ row.section }}</b>
          </div>
          <div class="cache-admin-meta-item">
            <span>{{ t.cacheAdmin.colKey }}</span>
            <b>{{ row?.entryKey ?? formModel.key }}</b>
          </div>
          <div v-if="row" class="cache-admin-meta-item">
            <span>{{ t.cacheAdmin.colSize }}</span>
            <b>{{ formatCacheSize(row.size) }}</b>
          </div>
          <div v-if="row" class="cache-admin-meta-item">
            <span>{{ t.cacheAdmin.colUpdated }}</span>
            <b>{{ formatCacheTime(row.updatedAt) }}</b>
          </div>
        </div>
        <t-alert v-if="isFlat" theme="warning" :message="t.cacheAdmin.flatHint" class="cache-admin-flat-alert" />
      </section>

      <auto-form
        v-if="isCreate"
        v-model="formModel"
        :fields="fields"
        label-align="top"
        layout="inline"
        size="small"
        class="cache-admin-identity"
      />

      <section class="cache-admin-body">
        <div class="cache-admin-body-head">
          <div class="cache-admin-body-title">
            <t-icon name="file-code" size="16px" />
            <span>{{ t.cacheAdmin.previewTitle }}</span>
          </div>
          <div class="cache-admin-body-tools">
            <t-radio-group v-model="activeTab" variant="default-filled" size="small">
              <t-radio-button value="json">{{ t.cacheAdmin.tabJson }}</t-radio-button>
              <t-radio-button value="markdown">{{ t.cacheAdmin.tabMarkdown }}</t-radio-button>
            </t-radio-group>
            <t-button
              v-if="activeTab === 'json' && !readonly"
              variant="outline"
              size="small"
              @click="formatJson"
            >
              {{ t.cacheAdmin.formatBtn }}
            </t-button>
          </div>
        </div>

        <div v-show="activeTab === 'json'" class="cache-admin-code">
          <file-content
            :t="t"
            filename="cache.json"
            :content="bodyText"
            :readonly="readonly"
            :empty-content-text="t.cacheAdmin.fieldBodyPlaceholder"
            @change="onBodyChange"
          />
        </div>
        <div v-if="activeTab === 'markdown'" class="cache-admin-preview custom-scrollbar">
          <markdown-preview :t="t" :content="markdownText" />
        </div>
      </section>
    </div>
  </form-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import FormDrawer from '@/components/common/form-drawer.vue';
import FileContent from '@/components/common/file-content.vue';
import MarkdownPreview from '@/components/common/markdown-preview.vue';
import AutoForm from '@/components/auto-form/index.vue';
import { FormMode } from '@/constants/form';
import { CACHE_ADMIN_FLAT_TABLES } from '@/constants/cache-admin';
import {
  cachePeriodLabel,
  formatCacheSize,
  formatCacheTime,
  jsonToMarkdown,
} from '@/utils/cache-admin';
import type { AutoFormField } from '@/types/auto-form';
import type { Locale } from '@/types/locale';
import type { CacheAdminEntry, CacheAdminPeriod } from '@/types/cache-admin';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 新增模式下的身份字段 */
  fields: AutoFormField[];
  /** 当前编辑的记录，null 表示新增 */
  row: CacheAdminEntry | null;
  /** 是否为新增模式 */
  isCreate: boolean;
  /** 加载 / 保存中标记 */
  loading: boolean;
  /** 是否只读（无编辑权限时隐藏确认按钮） */
  readonly: boolean;
  /** 是否为移动端 */
  isMobile: boolean;
}>();

const emit = defineEmits<{
  /** 点击确认保存 */
  (e: 'confirm'): void;
}>();

/** 抽屉显示状态（v-model:visible，Vue 3.4+ defineModel 语法糖） */
const visibleModel = defineModel<boolean>('visible', { required: true });

/** 编辑表单数据（v-model:form，Vue 3.4+ defineModel 语法糖） */
const formModel = defineModel<Record<string, unknown>>('form', { required: true });

/** 正文面板：json=CodeMirror 源码，markdown=Markdown 渲染 */
const activeTab = ref<'json' | 'markdown'>('json');

/** 当前正文 */
const bodyText = computed(() => String(formModel.value.body ?? ''));

/** 是否为整表同步覆盖的展平表 */
const isFlat = computed(() => CACHE_ADMIN_FLAT_TABLES.includes(String(formModel.value.table ?? '')));

/** 粒度标签主题 */
const periodTheme = (value: CacheAdminPeriod): string =>
  (value === 'day' ? 'primary' : value === 'static' ? 'default' : 'success');

/** 交给通用 Markdown 组件渲染的正文（JSON 转 Markdown，只读） */
const markdownText = ref('');
watchEffect(() => {
  const body = bodyText.value;
  const markdown = jsonToMarkdown(body, {
    title: props.t.cacheAdmin.previewTitle,
    maxLength: 20000,
    truncatedLabel: props.t.cacheAdmin.truncatedHint,
  });
  markdownText.value = markdown === null
    ? `> ${props.t.cacheAdmin.previewNotJson}\n\n\`\`\`text\n${body}\n\`\`\``
    : markdown;
});

/** CodeMirror 内容变更时回写表单（赋新对象以触发 v-model 更新） */
const onBodyChange = (content: string): void => {
  formModel.value = { ...formModel.value, body: content };
};

/** 一键格式化 JSON 缩进 */
const formatJson = (): void => {
  try {
    const formatted = JSON.stringify(JSON.parse(bodyText.value), null, 2);
    formModel.value = { ...formModel.value, body: formatted };
    MessagePlugin.success(props.t.cacheAdmin.formatSuccess);
  } catch {
    MessagePlugin.warning(props.t.cacheAdmin.formatFailed);
  }
};
</script>

<style scoped>
@import "@/styles/scrollbar.css";

.cache-admin-editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cache-admin-meta {
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.cache-admin-meta-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.cache-admin-meta-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.cache-admin-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px 18px;
}

.cache-admin-meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.cache-admin-meta-item span {
  font-size: 11px;
  color: var(--text-muted);
}

.cache-admin-meta-item b {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-all;
}

.cache-admin-flat-alert {
  margin-top: 14px;
}

.cache-admin-identity {
  padding: 2px 0 4px;
  border-bottom: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.16));
}

.cache-admin-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cache-admin-body-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cache-admin-body-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.cache-admin-body-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cache-admin-code {
  display: flex;
  height: 420px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
}

.cache-admin-code :deep(.file-content-wrap) {
  width: 100%;
}

.cache-admin-code :deep(.cm-scroller) {
  font-size: 13px;
}

.cache-admin-preview {
  height: 420px;
  padding: 16px 20px;
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  font-size: 13px;
}

@media (max-width: 768px) {
  .cache-admin-code,
  .cache-admin-preview {
    height: 320px;
  }
}
</style>
