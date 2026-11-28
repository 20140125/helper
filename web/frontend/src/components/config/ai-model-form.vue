<template>
  <div class="ai-model-inline-form">
    <auto-form ref="autoFormRef" v-model="modelValue" :fields="fields" />

    <div class="ai-model-editor">
      <div class="ai-model-editor__head">
        <span class="ai-model-editor__title">{{ t.playground.schema.aiModelEditorTitle }}</span>
        <span class="ai-model-editor__hint">{{ t.playground.schema.aiModelEditorHint }}</span>
      </div>

      <div class="ai-model-editor__tools">
        <t-button variant="outline" size="small" :loading="fetching" @click="emit('fetch-models')">
          <template #icon><t-icon name="cloud-download" /></template>
          {{ fetching ? t.playground.schema.aiModelFetching : t.playground.schema.aiModelFetchButton }}
        </t-button>
        <t-input
          v-model="manualId"
          class="ai-model-editor__manual"
          size="small"
          clearable
          :placeholder="t.playground.schema.aiModelManualPlaceholder"
          @enter="addManualModel"
        />
        <t-button variant="outline" size="small" @click="addManualModel">
          <template #icon><t-icon name="add" /></template>
          {{ t.playground.schema.aiModelManualAdd }}
        </t-button>
      </div>

      <div v-if="remoteModels.length > 0" class="ai-model-remote">
        <div class="ai-model-remote__head">
          <span>{{ t.playground.schema.aiModelRemoteTitle }}（{{ remoteModels.length }}）</span>
          <div class="ai-model-remote__actions">
            <t-button variant="text" size="small" @click="toggleSelectAll">
              {{ t.playground.schema.aiModelSelectAll }}
            </t-button>
            <t-button variant="outline" size="small" @click="importAllModels">
              {{ t.playground.schema.aiModelImportAll }}
            </t-button>
            <t-button theme="primary" size="small" :disabled="selectedRemoteIds.length === 0" @click="importSelected">
              {{ t.playground.schema.aiModelImportSelected }}
            </t-button>
          </div>
        </div>
        <t-checkbox-group v-model="selectedRemoteIds" class="ai-model-remote__list">
          <t-checkbox v-for="item in remoteModels" :key="item.id" :value="item.id" class="ai-model-remote__item">
            <span class="ai-model-remote__id">{{ item.id }}</span>
            <span v-if="item.label && item.label !== item.id" class="ai-model-remote__label">{{ item.label }}</span>
            <span v-if="remoteModelMeta(item)" class="ai-model-remote__meta" :title="remoteModelDetail(item)">
              {{ remoteModelMeta(item) }}
            </span>
          </t-checkbox>
        </t-checkbox-group>
      </div>

      <div v-if="models.length > 0" class="ai-model-table">
        <div class="ai-model-table__head">
          <span>{{ t.playground.schema.aiModelColumnId }}</span>
          <span>{{ t.playground.schema.aiModelColumnLabel }}</span>
          <span>{{ t.playground.schema.aiModelColumnDescription }}</span>
          <span>{{ t.playground.schema.aiModelColumnCapabilities }}</span>
          <span>{{ t.playground.schema.aiModelColumnDefault }}</span>
          <span>{{ t.playground.schema.aiModelColumnActions }}</span>
        </div>
        <div v-for="(model, index) in models" :key="model.id" class="ai-model-table__row">
          <div class="ai-model-table__id-cell">
            <span class="ai-model-table__id" :title="model.id">{{ model.id }}{{ model.testResult?.ok ? `(${model.testResult?.latencyMs}ms)` : ''}}</span>
            <t-button
              variant="text"
              size="small"
              :loading="testingId === model.id"
              @click="emit('test-model', model.id)"
            >
              {{ testingId === model.id ? t.playground.schema.aiModelTesting : t.playground.schema.aiModelTestButton }}
            </t-button>
            <span
              v-if="model.testResult"
              class="ai-model-test-state"
              :class="model.testResult.ok ? 'is-ok' : 'is-fail'"
              :title="testResultTitle(model.testResult)"
            >
              <t-icon :name="model.testResult.ok ? 'check-circle' : 'close-circle'" size="14px" />
            </span>
          </div>
          <t-input v-model="model.label" class="ai-model-table__input" size="small" />
          <t-input
            v-model="model.description"
            class="ai-model-table__input"
            size="small"
            :placeholder="t.playground.schema.aiModelColumnDescription"
          />
          <div class="ai-model-flags">
            <t-checkbox v-model="model.streamable" size="small">
              {{ t.playground.schema.aiModelColumnStreamable }}
            </t-checkbox>
            <t-checkbox v-model="model.vision" size="small">
              {{ t.playground.schema.aiModelColumnVision }}
            </t-checkbox>
            <t-checkbox v-model="model.free" size="small">
              {{ t.playground.schema.aiModelColumnFree }}
            </t-checkbox>
            <t-checkbox
              v-model="model.hidden"
              size="small"
              :disabled="model.isDefault"
              :title="model.isDefault
                ? t.playground.schema.aiModelHiddenDefaultDisabled
                : t.playground.schema.aiModelHiddenHint"
            >
              {{ t.playground.schema.aiModelHidden }}
            </t-checkbox>
          </div>
          <t-button
            variant="text"
            size="small"
            :theme="model.isDefault ? 'primary' : 'default'"
            @click="setDefaultModel(model.id)"
          >
            {{ model.isDefault ? t.playground.schema.aiModelIsDefault : t.playground.schema.aiModelSetDefault }}
          </t-button>
          <t-button variant="text" theme="danger" size="small" @click="removeModel(index)">
            <template #icon><t-icon name="delete" /></template>
          </t-button>
        </div>
      </div>
      <div v-else class="ai-model-editor__empty">{{ t.playground.schema.aiModelNoModels }}</div>
    </div>

    <div class="ai-model-inline-btns">
      <t-button variant="outline" size="large" @click="emit('cancel')">
        <template #icon><t-icon name="close" /></template>
        {{ t.config.webhookCancel }}
      </t-button>
      <t-button theme="primary" size="large" @click="emit('submit')">
        <template #icon><t-icon name="check" /></template>
        {{ t.config.webhookSave }}
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import AutoForm from '@/components/auto-form/index.vue';
import { createAiModelEntry, formatRemoteModelMeta, isAiModelIdValid } from '@/utils/ai-model-config';
import type { Locale } from '@/types/locale';
import type { AutoFormField } from '@/types/auto-form';
import type { AiModelEntry, AiModelEntryTestResult, RemoteModelOption } from '@/types/ai-model-config';

const props = defineProps<{
  /** i18n 翻译对象（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 配置组基础字段（名称 / 接口地址 / API Key / 最大 token / 长期记忆 / 单价表） */
  fields: AutoFormField[];
  /** 从接口拉取到的候选模型 */
  remoteModels: RemoteModelOption[];
  /** 是否正在拉取模型列表 */
  fetching: boolean;
  /** 正在测试可用性的模型 ID */
  testingId: string;
}>();

const emit = defineEmits<{
  /** 抛出 auto-form 实例供父级提交前校验 */
  (e: 'set-ref', el: unknown): void;
  /** 从接口拉取模型列表 */
  (e: 'fetch-models'): void;
  /** 测试指定模型是否可用 */
  (e: 'test-model', modelId: string): void;
  /** 取消新增/编辑 */
  (e: 'cancel'): void;
  /** 提交行内表单 */
  (e: 'submit'): void;
}>();

/** 表单值（v-model，Vue 3.4+ defineModel 语法糖） */
const modelValue = defineModel<Record<string, unknown>>({ required: true });

const autoFormRef = ref<InstanceType<typeof AutoForm> | null>(null);
const manualId = ref('');
const selectedRemoteIds = ref<string[]>([]);

/** 已选模型（结构化条目，逐项可编辑说明与开关） */
const models = computed<AiModelEntry[]>(() =>
  Array.isArray(modelValue.value.models) ? (modelValue.value.models as AiModelEntry[]) : [],
);

/**
 * 写回模型列表
 * @param {AiModelEntry[]} next - 新的模型列表
 * @returns {void}
 */
const setModels = (next: AiModelEntry[]): void => {
  modelValue.value = { ...modelValue.value, models: next };
};

/** 手动添加一个模型 ID */
const addManualModel = (): void => {
  const id = manualId.value.trim();
  if (!id) return;
  if (!isAiModelIdValid(id)) {
    MessagePlugin.warning(props.t.playground.schema.aiModelNamesInvalid);
    return;
  }
  if (models.value.some((model) => model.id === id)) {
    MessagePlugin.warning(props.t.playground.schema.aiModelDuplicate);
    return;
  }
  setModels([...models.value, createAiModelEntry(id)]);
  manualId.value = '';
};

/** 候选模型的一行元信息摘要（来源 / 发布时间 / 上下文 / 端点类型） */
const remoteModelMeta = (item: RemoteModelOption): string => formatRemoteModelMeta(item);

/**
 * 模型内测试结果的悬浮说明
 * @param {AiModelEntryTestResult} result - 模型条目保存的最近一次测试结果
 * @returns {string} 状态、耗时、失败原因与测试时间
 */
const testResultTitle = (result: AiModelEntryTestResult): string => {
  const schema = props.t.playground.schema;
  const head = result.ok
    ? `${schema.aiModelTestOk} (${result.latencyMs}ms)`
    : `${schema.aiModelTestFail}：${result.message}`;
  return `${head} · ${new Date(result.testedAt).toLocaleString()}`;
};

/**
 * 候选模型的完整信息，供鼠标悬停查看
 * @param {RemoteModelOption} item - 候选模型
 * @returns {string} 展示名、简介与元信息拼成的文本
 */
const remoteModelDetail = (item: RemoteModelOption): string => [
  item.label && item.label !== item.id ? item.label : '',
  item.description ?? '',
  formatRemoteModelMeta(item),
].filter(Boolean).join(' · ');

/** 全选 / 取消全选接口返回的模型 */
const toggleSelectAll = (): void => {
  const all = props.remoteModels.map((model) => model.id);
  selectedRemoteIds.value = selectedRemoteIds.value.length === all.length ? [] : all;
};

/**
 * 按模型 ID 批量导入远端模型
 * @param {string[]} ids - 待导入的模型 ID
 * @returns {void}
 * @description 自动跳过已存在的模型，导入后清空勾选；
 *   接口元信息预填到「模型说明」，用户仍可自行修改
 */
const importModels = (ids: string[]): void => {
  const existing = new Set(models.value.map((model) => model.id));
  const selected = new Set(ids);
  const added = props.remoteModels
    .filter((model) => selected.has(model.id) && !existing.has(model.id))
    .map((model) => createAiModelEntry(model.id, model.label, remoteModelMeta(model)));
  if (added.length > 0) setModels([...models.value, ...added]);
  selectedRemoteIds.value = [];
};

/**
 * 把某个模型设为全局默认（同组内互斥）
 * @param {string} id - 目标模型 ID
 * @returns {void}
 * @description 脚本、定时巡检等未显式传 model 的自动链路会使用该模型及其所属配置组；
 *   跨组的旧标记由后端 ensureSingleDefaultModel 在保存时清除
 */
const setDefaultModel = (id: string): void => {
  setModels(models.value.map((model) => ({ ...model, isDefault: model.id === id })));
};

/** 导入当前勾选的模型 */
const importSelected = (): void => importModels(selectedRemoteIds.value);

/** 一次性导入接口返回的全部模型 */
const importAllModels = (): void => importModels(props.remoteModels.map((model) => model.id));

/** 拉取结果变化时默认全选，方便一键导入接口提供的全部模型 */
watch(() => props.remoteModels, (list) => {
  selectedRemoteIds.value = list.map((model) => model.id);
});

/**
 * 移除一个模型
 * @param {number} index - 模型在列表中的下标
 * @returns {void}
 */
const removeModel = (index: number): void => {
  setModels(models.value.filter((_, i) => i !== index));
};

onMounted(() => {
  if (autoFormRef.value) emit('set-ref', autoFormRef.value);
});
</script>

<style scoped>
.ai-model-inline-form {
  padding: 16px;
  background: var(--bg-secondary, var(--card-bg));
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.ai-model-editor {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
}

.ai-model-editor__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-model-editor__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-model-editor__hint {
  font-size: 12px;
  color: var(--text-muted);
}

.ai-model-editor__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
}

.ai-model-editor__manual {
  flex: 1 1 220px;
  min-width: 160px;
}

.ai-model-editor__empty {
  font-size: 12px;
  font-style: italic;
  color: var(--text-muted);
  padding: 10px 0;
}

.ai-model-remote {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 12px;
}

.ai-model-remote__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-primary);
}

.ai-model-remote__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ai-model-remote__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  margin-top: 8px;
}

.ai-model-remote__item {
  display: flex;
  align-items: center;
}

.ai-model-remote__id {
  font-family: monospace;
  font-size: 12px;
}

.ai-model-remote__label {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 8px;
}

.ai-model-remote__meta {
  display: inline-block;
  max-width: 320px;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.85;
}

.ai-model-table {
  min-width: 860px;
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
}

.ai-model-table__head {
  text-align: center;
}
.ai-model-table__head,
.ai-model-table__row {
  display: grid;
  grid-template-columns: minmax(190px, 1fr) minmax(120px, 1fr) minmax(160px, 1fr) minmax(170px, 1fr) 70px 30px;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
}

.ai-model-table__head {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-secondary, rgba(127, 127, 127, 0.05));
  border-bottom: 1px solid var(--border-color);
}

.ai-model-table__row {
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.15s ease;
}

.ai-model-table__row:last-child {
  border-bottom: none;
}

.ai-model-table__row:hover {
  background: rgba(127, 127, 127, 0.05);
}

.ai-model-table__id-cell {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.ai-model-table__id {
  flex: 1;
  min-width: 0;
  font-family: monospace;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-model-test-state {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.ai-model-test-state.is-ok {
  color: var(--td-success-color-5, #2ba471);
}

.ai-model-test-state.is-fail {
  color: var(--td-error-color-5, #d54941);
}

.ai-model-table__input {
  width: 100%;
}

.ai-model-flags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 10px;
}

.ai-model-flags :deep(.t-checkbox) {
  margin-right: 0;
}

.ai-model-flags :deep(.t-checkbox__label) {
  font-size: 12px;
  color: var(--text-primary);
  margin-left: 4px;
}

.ai-model-inline-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

@media (max-width: 768px) {
  .ai-model-editor__tools {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
