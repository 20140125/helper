<template>
  <div class="execute-panel">
    <!-- 方法 + URL 行 -->
    <div class="execute-url-row">
      <t-tag
        :theme="METHOD_THEME[executingItem?.method ?? 'GET']"
        variant="light"
        size="large"
        class="method-tag"
      >
        {{ executingItem?.method ?? 'GET' }}
      </t-tag>
      <t-input
        v-model="urlModel"
        :placeholder="t.apiManagement.executeUrlPlaceholder"
        class="flex-1"
        size="large"
      />
      <t-button
        theme="primary"
        size="large"
        @click="emit('execute')"
      >
        <template #icon><t-icon name="play-circle" /></template>
        {{ t.apiManagement.executeSendBtn }}
      </t-button>
    </div>

    <!-- Query 参数 -->
    <div class="execute-section">
      <div class="execute-section-header">
        <span class="execute-section-title">{{ t.apiManagement.executeParamsLabel }}</span>
        <t-button variant="text" size="small" @click="emit('addParam')">
          <template #icon><t-icon name="add" /></template>
          {{ t.apiManagement.addParamBtn }}
        </t-button>
      </div>
      <div
        v-for="(param, index) in params"
        :key="index"
        class="header-row"
      >
        <t-checkbox v-model="param.enabled" />
        <t-input
          v-model="param.key"
          :placeholder="t.apiManagement.executeParamKeyPlaceholder"
          class="flex-1"
          size="large"
        />
        <t-input
          v-model="param.value"
          :placeholder="t.apiManagement.executeParamValuePlaceholder"
          class="flex-1"
          size="large"
        />
        <t-button
          variant="text"
          theme="danger"
          size="small"
          @click="emit('removeParam', index)"
        >
          <template #icon><t-icon name="delete" /></template>
        </t-button>
      </div>
    </div>

    <!-- 请求头 -->
    <div class="execute-section">
      <div class="execute-section-header">
        <span class="execute-section-title">{{ t.apiManagement.executeHeadersLabel }}</span>
        <t-button variant="text" size="small" @click="emit('addHeader')">
          <template #icon><t-icon name="add" /></template>
          {{ t.apiManagement.addHeaderBtn }}
        </t-button>
      </div>
      <div
        v-for="(header, index) in headers"
        :key="index"
        class="header-row"
      >
        <t-checkbox v-model="header.enabled" />
        <t-input
          v-model="header.key"
          :placeholder="t.apiManagement.executeHeaderKeyPlaceholder"
          class="flex-1"
          size="large"
        />
        <t-input
          v-model="header.value"
          :placeholder="t.apiManagement.executeHeaderValuePlaceholder"
          class="flex-1"
          size="large"
        />
        <t-button
          variant="text"
          theme="danger"
          size="small"
          @click="emit('removeHeader', index)"
        >
          <template #icon><t-icon name="delete" /></template>
        </t-button>
      </div>
    </div>

    <!-- 请求体（非 GET/DELETE 时显示，使用 JSON 编辑器） -->
    <div
      v-if="executingItem && !['GET', 'DELETE'].includes(executingItem.method)"
      class="execute-section"
    >
      <div class="execute-section-title">{{ t.apiManagement.executeBodyLabel }}</div>
      <div class="execute-body-editor">
        <file-content
          filename="body.json"
          :content="bodyInitial"
          @change="(val: string) => emit('bodyChange', val)"
        />
      </div>
    </div>

    <!-- 响应结果 -->
    <div class="execute-section">
      <div class="execute-section-title">{{ t.apiManagement.executeResultTitle }}</div>

      <!-- 无结果提示 -->
      <div
        v-if="!result && !errorMessage && !executing"
        class="execute-empty"
      >
        <t-icon name="play-circle" size="32px" style="opacity: 0.3; margin-bottom: 8px;" />
        <p class="text-sm">{{ t.apiManagement.executeNoResult }}</p>
      </div>

      <!-- 加载中 -->
      <div v-else-if="executing" class="execute-empty">
        <t-loading size="small" />
      </div>

      <!-- 错误 -->
      <t-alert
        v-else-if="errorMessage"
        theme="error"
        :message="t.apiManagement.executeErrorPrefix + errorMessage"
      />

      <!-- 结果 -->
      <template v-else-if="result">
        <!-- 状态行 -->
        <div class="result-meta">
          <t-tag :theme="isResponseSuccess ? 'success' : 'danger'" variant="light">
            {{ result.status }} {{ result.statusText }}
          </t-tag>
          <span class="result-duration" style="color: var(--text-muted);">
            {{ result.duration }}ms
          </span>
        </div>

        <!-- 响应头折叠 -->
        <t-collapse :default-value="[]">
          <t-collapse-panel value="headers" :header="t.apiManagement.executeResultHeaders">
            <div class="response-headers">
              <div
                v-for="(val, key) in result.headers"
                :key="key"
                class="header-item"
              >
                <span class="header-key">{{ key }}</span>
                <span class="header-val">{{ Array.isArray(val) ? val.join(', ') : val }}</span>
              </div>
            </div>
          </t-collapse-panel>
        </t-collapse>

        <!-- 响应体 -->
        <div class="response-body-label">{{ t.apiManagement.executeResultBody }}</div>
        <div class="response-body-editor">
          <file-content
            :filename="responseFilename"
            :content="formattedResponseBody"
            :empty-content-text="t.apiManagement.executeResultEmpty"
            readonly
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FileContent from '@/components/common/file-content.vue';
import { METHOD_THEME } from '@/constants/api-management';
import { useLocaleStore } from '@/stores/locale';
import type { ApiItem, ApiExecuteResult, HeaderEntry } from '@/types/api-management';

defineProps<{


  /** 正在执行的 API 项 */
  executingItem: ApiItem | null;
  /** 请求体初始值 */
  bodyInitial: string;
  /** 请求头 */
  headers: HeaderEntry[];
  /** 请求参数 */
  params: HeaderEntry[];
  /** 是否正在执行 */
  executing: boolean;
  /** 执行结果 */
  result: ApiExecuteResult | null;
  /** 错误信息 */
  errorMessage: string;
  /** 格式化后的响应体 */
  formattedResponseBody: string;
  /** 响应体文件名 */
  responseFilename: string;
  /** 响应是否成功 */
  isResponseSuccess: boolean;
}>();

const emit = defineEmits<{


  /** 请求体变化 */
  (e: 'bodyChange', value: string): void;
  /** 添加请求头 */
  (e: 'addHeader'): void;
  /** 移除请求头 */
  (e: 'removeHeader', index: number): void;
  /** 添加请求参数 */
  (e: 'addParam'): void;
  /** 移除请求参数 */
  (e: 'removeParam', index: number): void;
  /** 执行请求 */
  (e: 'execute'): void;
}>();

/** 国际化 */
const localeStore = useLocaleStore();
const t = computed(() => localeStore.t);

/** URL 双向绑定（Vue 3.4+ defineModel 语法糖，自动生成 url prop 与 update:url 事件） */
const urlModel = defineModel<string>('url', { required: true 



});
</script>

<style scoped>
.execute-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0;
}

.execute-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.method-tag {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 13px;
}

.execute-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.execute-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.execute-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.execute-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
  color: var(--text-muted);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.result-duration {
  font-size: 12px;
}

.response-headers {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  font-family: monospace;
}

.header-key {
  color: var(--accent-primary);
  min-width: 160px;
  flex-shrink: 0;
}

.header-val {
  color: var(--text-secondary);
  word-break: break-all;
}

.response-body-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: 8px;
}

.execute-body-editor {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  height: 200px;
  display: flex;
  flex-direction: column;
}

.response-body-editor {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  height: 300px;
  display: flex;
  flex-direction: column;
}
</style>
