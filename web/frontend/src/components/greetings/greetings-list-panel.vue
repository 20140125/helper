<template>
  <card-panel
    :title="group.label"
    icon="gift"
    icon-theme="secondary"
  >
    <template #title-extra>
      <span class="text-xs" style="color: var(--text-muted);">
        {{ t.greetings.totalCount(group.items.length) }}
      </span>
    </template>

    <!-- 空态 -->
    <div
      v-if="group.items.length === 0"
      class="flex flex-col items-center py-12"
      style="color: var(--text-muted);"
    >
      <t-icon name="gift" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
      <p class="text-sm">{{ t.greetings.noItems }}</p>
    </div>

    <!-- 分组条目表格 -->
    <t-table
      v-else
      :data="group.items"
      :columns="columns"
      row-key="id"
      hover
      stripe
      size="medium"
    >
      <template #group="{ row }">
        <t-tag theme="primary" variant="light-outline">{{ getGroupLabel(row.group) }}</t-tag>
      </template>
      <template #name="{ row }">
        <span v-if="row.name">{{ row.name }}</span>
        <span v-else style="color: var(--text-muted);">{{ t.greetings.noName }}</span>
      </template>
      <!-- eslint-disable vue/no-v-html -- 列表预览：内容经 greetings-model 渲染并已由 DOMPurify 净化 -->
      <template #preview="{ row }">
        <t-tooltip placement="top-left" :show-arrow="true" overlay-class-name="greeting-preview-tip">
          <template #content>
            <div class="greeting-preview-tip-body markdown-body" v-html="getRowFullHtml(row)" />
          </template>
          <span
            class="preview-cell markdown-body"
            v-html="getRowPreviewHtml(row)"
          />
        </t-tooltip>
      </template>
      <!-- eslint-enable vue/no-v-html -->
      <template #actions="{ row }">
        <div class="flex gap-2">
          <t-button
            v-if="canEdit(viewPermission)"
            variant="text"
            size="small"
            @click="emit('edit', row)"
          >
            <template #icon><t-icon name="edit" /></template>
          </t-button>
          <t-popconfirm :content="t.greetings.deleteConfirm" @confirm="emit('delete', row.id)">
            <t-button
              v-if="canEdit(viewPermission)"
              variant="text"
              theme="danger"
              size="small"
            >
              <template #icon><t-icon name="delete" /></template>
            </t-button>
          </t-popconfirm>
        </div>
      </template>
    </t-table>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import type { Locale } from '@/types/locale';
import type { GreetingItem, GreetingsGroup } from '@/types/greetings';
import type { Permission } from '@/types/permission';

interface GreetingsGroupBucket {
  group: GreetingsGroup;
  label: string;
  items: GreetingItem[];
}

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 当前分组（类别 + 标签 + 条目列表） */
  group: GreetingsGroupBucket;
  /** t-table 列定义 */
  columns: unknown[];
  /** 权限校验函数：传入操作权限返回是否允许 */
  canEdit: (perm?: Permission) => boolean;
  /** 当前页面的查看权限标识 */
  viewPermission: Permission;
  /** 通过分组 key 取标签文案 */
  getGroupLabel: (group: GreetingsGroup) => string;
  /** 表格单元格预览 HTML（单行 inline） */
  getRowPreviewHtml: (row: GreetingItem) => string;
  /** tooltip 渲染的完整 HTML */
  getRowFullHtml: (row: GreetingItem) => string;
}>();

const emit = defineEmits<{
  /** 编辑条目 */
  (e: 'edit', row: GreetingItem): void;
  /** 删除条目，参数为条目 ID */
  (e: 'delete', id: string): void;
}>();
</script>

<style scoped>
/* 表格 preview 单元格：Markdown 单行 inline 渲染，完整内容由 tooltip 查看 */
.preview-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  line-height: 1.6;
  color: var(--text-primary);
}

.preview-cell :deep(*) {
  display: inline !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: inherit !important;
  line-height: inherit !important;
  font-weight: inherit;
  background: transparent !important;
  border: none !important;
}

.preview-cell :deep(strong) {
  font-weight: 600;
}

.preview-cell :deep(em) {
  font-style: italic;
}

.preview-cell :deep(code) {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 3px;
  padding: 0 4px !important;
  font-size: 12px !important;
  font-family: 'SFMono-Regular', Consolas, monospace;
}
</style>

<!-- 非 scoped：t-tooltip 的 overlay 在 body 下挂载，scoped 样式命中不到 -->
<style>
.greeting-preview-tip.t-popup .t-popup__content {
  max-width: 560px;
  max-height: 360px;
  overflow: auto;
  padding: 10px 12px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
  border: 1px solid var(--border-color, #e5e5e5);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 13px;
  line-height: 1.7;
}

.greeting-preview-tip .greeting-preview-tip-body h1,
.greeting-preview-tip .greeting-preview-tip-body h2,
.greeting-preview-tip .greeting-preview-tip-body h3,
.greeting-preview-tip .greeting-preview-tip-body h4 {
  font-weight: 600;
  margin: 8px 0 4px;
  line-height: 1.4;
}

.greeting-preview-tip .greeting-preview-tip-body h1 { font-size: 16px; }
.greeting-preview-tip .greeting-preview-tip-body h2 { font-size: 15px; }
.greeting-preview-tip .greeting-preview-tip-body h3 { font-size: 14px; }
.greeting-preview-tip .greeting-preview-tip-body h4 { font-size: 13px; }

.greeting-preview-tip .greeting-preview-tip-body p {
  margin: 4px 0;
}

.greeting-preview-tip .greeting-preview-tip-body ul,
.greeting-preview-tip .greeting-preview-tip-body ol {
  padding-left: 20px;
  margin: 4px 0;
}

.greeting-preview-tip .greeting-preview-tip-body li {
  margin: 2px 0;
}

.greeting-preview-tip .greeting-preview-tip-body blockquote {
  border-left: 3px solid var(--accent-primary, #0052d9);
  margin: 6px 0;
  padding: 2px 10px;
  color: var(--text-muted, #888);
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 0 4px 4px 0;
}

.greeting-preview-tip .greeting-preview-tip-body code {
  background: var(--bg-secondary, #f5f5f5);
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 3px;
  padding: 0 4px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.greeting-preview-tip .greeting-preview-tip-body pre {
  background: var(--bg-secondary, #f5f5f5);
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 4px;
  padding: 8px 10px;
  margin: 6px 0;
  overflow-x: auto;
}

.greeting-preview-tip .greeting-preview-tip-body hr {
  border: none;
  border-top: 1px dashed var(--border-color, #e5e5e5);
  margin: 8px 0;
}
</style>
