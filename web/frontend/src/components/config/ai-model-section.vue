<template>
  <div class="ai-model-list">
    <div v-if="groups.length === 0 && !isAdding && !editingId" class="ai-model-list__empty">
      {{ t.config.noCustomModels }}
    </div>

    <!-- 明确展示脚本/定时任务实际使用的默认模型，避免只能靠猜第一个配置组 -->
    <div v-if="groups.length > 0" class="ai-model-default-hint">
      <t-icon name="info-circle" />
      <span>{{ t.config.modelDefaultHint }}：<strong>{{ defaultModelLabel }}</strong></span>
      <span class="ai-model-default-hint__tip">{{ t.config.modelDefaultHintTip }}</span>
    </div>

    <!-- 一组接口与 Key 下挂多个模型名称；编辑表单紧跟被编辑的组，避免看起来在别的组下面展开 -->
    <template v-for="group in groups" :key="group.id">
      <div class="ai-model-group" :class="{ 'is-editing': editingId === group.id }">
        <div class="ai-model-row">
          <div class="ai-model-info">
            <p class="ai-model-name">{{ group.name }}</p>
            <p class="ai-model-meta">
              {{ group.baseUrl }} · {{ group.apiKey }} ·
              {{ group.memoryEnabled === false ? t.config.modelMemoryOff : t.config.modelMemoryOn }}
            </p>
          </div>
          <div v-if="canEdit" class="ai-model-actions">
            <t-tooltip :content="t.common.edit">
              <t-button variant="text" size="large" @click="emit('edit-group', group)">
                <template #icon><t-icon name="edit" /></template>
              </t-button>
            </t-tooltip>
            <t-popconfirm :content="t.config.deleteModelConfirm" @confirm="emit('delete-group', group.id)">
              <t-tooltip :content="t.common.delete">
                <t-button variant="text" theme="danger" size="large">
                  <template #icon><t-icon name="delete" /></template>
                </t-button>
              </t-tooltip>
            </t-popconfirm>
          </div>
        </div>
        <div class="ai-model-tags">
          <!-- 组级汇总：标签密集时比逐个弱化更扫得快；只在存在隐藏模型时出现 -->
          <t-tooltip v-if="hiddenModels(group).length > 0" :content="hiddenModelsHint(group)">
            <t-tag theme="warning" variant="light" size="small" class="ai-model-hidden-summary">
              <t-icon name="browse-off" size="12px" />
              {{ t.playground.schema.aiModelHiddenCount.replace('{count}', String(hiddenModels(group).length)) }}
            </t-tag>
          </t-tooltip>
          <!-- 隐藏模型仍留在配置页（可进编辑表单取消），只做降权展示，不做过滤 -->
          <template v-for="model in sortedModels(group)" :key="model.id">
            <t-tooltip v-if="model.hidden" :content="modelTagHint(model)">
              <t-tag
                class="ai-model-tag--hidden"
                :theme="model.isDefault ? 'primary' : 'default'"
                variant="light-outline"
                size="small"
              >
                <t-icon name="browse-off" size="12px" />
                {{ model.isDefault ? t.config.modelDefaultTag + model.label : model.label }}
              </t-tag>
            </t-tooltip>
            <t-tag
              v-else
              :theme="model.isDefault ? 'primary' : 'default'"
              variant="light-outline"
              size="small"
            >
              {{ model.isDefault ? t.config.modelDefaultTag + model.label : model.label }}
            </t-tag>
          </template>
        </div>
      </div>

      <!-- 与 Webhook 一致的行内编辑表单：只在被编辑的组下方展开 -->
      <ai-model-form
        v-if="editingId === group.id"
        class="ai-model-add-form ai-model-add-form--under"
        :model-value="form"
        :fields="fields"
        :t="t"
        :remote-models="remoteModels"
        :fetching="fetching"
        :testing-id="testingId"
        @update:model-value="emit('update:form', $event)"
        @set-ref="emit('set-form-ref', $event)"
        @fetch-models="emit('fetch-models')"
        @test-model="emit('test-model', $event)"
        @cancel="emit('cancel')"
        @submit="emit('submit')"
      />
    </template>

    <!-- 新增表单仍在所有配置组之后展开 -->
    <ai-model-form
      v-if="isAdding && !editingId"
      class="ai-model-add-form"
      :model-value="form"
      :fields="fields"
      :t="t"
      :remote-models="remoteModels"
      :fetching="fetching"
      :testing-id="testingId"
      @update:model-value="emit('update:form', $event)"
      @set-ref="emit('set-form-ref', $event)"
      @fetch-models="emit('fetch-models')"
      @test-model="emit('test-model', $event)"
      @cancel="emit('cancel')"
      @submit="emit('submit')"
    />
  </div>
</template>

<script setup lang="ts">
import AiModelForm from './ai-model-form.vue';
import type { Locale } from '@/locales/zh';
import { computed } from 'vue';
import type { AutoFormField } from '@/types/auto-form';
import type { AiModelEntry, AiModelGroup, RemoteModelOption } from '@/types/ai-model-config';

const props = defineProps<{
  /** i18n 翻译对象（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 模型配置组列表 */
  groups: AiModelGroup[];
  /** 是否正在新增 */
  isAdding: boolean;
  /** 当前编辑的配置组 ID */
  editingId: string | null;
  /** 行内表单数据 */
  form: Record<string, unknown>;
  /** 行内表单字段 */
  fields: AutoFormField[];
  /** 从接口拉取到的候选模型 */
  remoteModels: RemoteModelOption[];
  /** 是否正在拉取模型列表 */
  fetching: boolean;
  /** 正在测试可用性的模型 ID */
  testingId: string;
  /** 是否可编辑 */
  canEdit: boolean;
}>();

const emit = defineEmits<{
  /** 编辑指定配置组 */
  (e: 'edit-group', group: AiModelGroup): void;
  /** 删除指定配置组 */
  (e: 'delete-group', id: string): void;
  /** 更新行内表单数据 */
  (e: 'update:form', val: Record<string, unknown>): void;
  /** 设置行内表单 ref */
  (e: 'set-form-ref', el: unknown): void;
  /** 从接口拉取模型列表 */
  (e: 'fetch-models'): void;
  /** 测试指定模型是否可用 */
  (e: 'test-model', modelId: string): void;
  /** 取消新增/编辑 */
  (e: 'cancel'): void;
  /** 提交行内表单 */
  (e: 'submit'): void;
}>();

/**
 * 卡片标签的展示顺序：可用模型在前、隐藏模型在后
 * @param {AiModelGroup} group - 配置组
 * @returns {AiModelEntry[]} 排序后的模型条目（不修改原数组）
 * @description 只影响只读卡片的渲染顺序，groups 数据与编辑表格顺序均不变；
 *   用两次 filter 拼接，保持两部分各自原有的相对顺序
 */
const sortedModels = (group: AiModelGroup): AiModelEntry[] => [
  ...group.models.filter((model) => !model.hidden),
  ...group.models.filter((model) => model.hidden),
];

/**
 * 取配置组内已隐藏的模型
 * @param {AiModelGroup} group - 配置组
 * @returns {AiModelEntry[]} 已隐藏的模型条目
 * @description 数据来自已保存的 groups，卡片只反映已生效状态；编辑表单里的勾选属于草稿
 */
const hiddenModels = (group: AiModelGroup): AiModelEntry[] =>
  group.models.filter((model) => model.hidden);

/**
 * 组级隐藏汇总的悬浮说明
 * @param {AiModelGroup} group - 配置组
 * @returns {string} 隐藏提示与被隐藏的模型 ID 列表
 */
const hiddenModelsHint = (group: AiModelGroup): string => [
  props.t.playground.schema.aiModelHiddenHint,
  ...hiddenModels(group).map((model) => model.id),
].join(' · ');

/**
 * 单个隐藏模型的悬浮说明
 * @param {AiModelEntry} model - 模型条目
 * @returns {string} 隐藏提示，测试失败时附上失败原因
 */
const modelTagHint = (model: AiModelEntry): string => {
  const parts = [props.t.playground.schema.aiModelHiddenHint];
  if (model.testResult && !model.testResult.ok && model.testResult.message) {
    parts.push(model.testResult.message);
  }
  return parts.join(' · ');
};

/** 当前默认模型的「配置组 / 模型」展示（未显式标记时回退到首个配置组的首个模型） */
const defaultModelLabel = computed((): string => {
  for (const group of props.groups) {
    const model = group.models.find((item) => item.isDefault);
    if (model) return `${group.name} / ${model.label}`;
  }
  const first = props.groups[0];
  return first?.models[0] ? `${first.name} / ${first.models[0].label}` : '';
});
</script>

<style scoped>
.ai-model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-model-list__empty {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
  padding: 8px 0;
}

.ai-model-default-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary, rgba(127, 127, 127, 0.05));
  font-size: 12px;
  color: var(--text-primary);
}

.ai-model-default-hint strong {
  color: var(--accent-primary, #0052d9);
}

.ai-model-default-hint__tip {
  color: var(--text-muted);
}

.ai-model-group {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  padding: 10px 14px;
}

.ai-model-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-model-info {
  flex: 1;
  min-width: 0;
}

.ai-model-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.ai-model-meta {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 2px 0 0;
}

.ai-model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

/* 让标签内的隐藏图标与文字基线对齐 */
.ai-model-tags :deep(.t-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 隐藏只做降权：不改 theme、不过滤，避免与默认模型的强调色混淆 */
.ai-model-tags :deep(.t-tag.ai-model-tag--hidden) {
  opacity: 0.55;
  border-style: dashed;
}

.ai-model-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ai-model-add-form {
  margin-top: 4px;
}

/* 正在编辑的组高亮，表单用同一强调色边框表明归属 */
.ai-model-group.is-editing {
  border-color: var(--accent-primary, #0052d9);
  box-shadow: 0 0 0 2px var(--accent-primary-bg, rgba(0, 82, 217, 0.08));
}

.ai-model-list > .ai-model-add-form--under {
  margin-top: 0;
  margin-bottom: 4px;
  border-color: var(--accent-primary, #0052d9);
}

@media (max-width: 768px) {
  .ai-model-meta {
    white-space: normal;
    word-break: break-all;
  }
}
</style>
