<template>
  <card-panel
    :title="t.playground.panelPreview"
    icon="view-list"
    icon-theme="secondary"
    class="playground-preview"
    full-height
  >
    <template #actions>
      <div class="panel-actions">
        <t-button size="large" variant="text" @click="$emit('reset-form')">
          <template #icon><t-icon name="refresh" /></template>
          {{ t.playground.btnReset }}
        </t-button>
        <t-button size="large" theme="primary" @click="$emit('submit-form')">
          <template #icon><t-icon name="check-circle" /></template>
          {{ t.playground.btnSubmit }}
        </t-button>
      </div>
    </template>

    <!-- 表单区域 -->
    <div class="preview-body">
      <t-alert
        v-if="!isJsonValid"
        theme="error"
        :message="t.playground.errorParse"
        class="mb-4"
      />
      <t-empty
        v-else-if="parsedFields.length === 0"
        :description="t.playground.emptyHint"
        style="padding: 60px 0;"
      />
      <auto-form
        v-else
        :key="activeTemplateIndex"
        :ref="setAutoFormRef"
        v-model="localFormData"
        :fields="parsedFields"
        :label-align="labelAlign"
        :required-mark="requiredMark"
        :size="formSize"
        :colon="showColon"
      >
        <!-- 权限分组选择器插槽：当模板含 permissions 字段时自动渲染 -->
        <template #content-permissions>
          <permission-checker
            :t="t"
            :model-value="(localFormData.permissions as string[]) ?? []"
            :permission-groups="permissionSelection.permissionGroups"
            :total-count="permissionSelection.allPermissionCodes.length"
            :is-all-checked="permissionSelection.isAllChecked"
            :is-indeterminate="permissionSelection.isIndeterminate"
            :is-group-all-checked="permissionSelection.isGroupAllChecked"
            :is-group-indeterminate="permissionSelection.isGroupIndeterminate"
            @toggle-all="permissionSelection.toggleAll"
            @toggle-group="permissionSelection.toggleGroup"
            @toggle="permissionSelection.toggle"
          />
        </template>
      </auto-form>
    </div>

    <!-- 实时数据展示 -->
    <div class="data-panel">
      <div class="data-panel-title">
        <t-icon name="data" size="14px" />
        {{ t.playground.liveData }}
      </div>
      <pre class="data-output">{{ formattedFormData }}</pre>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import AutoForm from '@/components/auto-form/index.vue';
import PermissionChecker from '@/components/rbac/permission-checker.vue';
import CardPanel from '@/components/common/card-panel.vue';
import type { AutoFormField } from '@/types/auto-form';
import type { PermissionSelection } from '@/utils/rbac';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 解析后的 auto-form 字段配置 */
  parsedFields: AutoFormField[];
  /** 当前 JSON 是否为合法语法（决定是否渲染表单） */
  isJsonValid: boolean;
  /** 当前选中的模板下标（作为 key 重置表单状态） */
  activeTemplateIndex: number;
  /** label 对齐方式 */
  labelAlign: 'left' | 'right' | 'top';
  /** 必填标记开关，undefined 为默认 */
  requiredMark: boolean | undefined;
  /** 表单尺寸 */
  formSize: 'small' | 'medium' | 'large';
  /** 是否显示冒号 */
  showColon: boolean;
  /** 格式化后的表单数据（用于低部实时展示） */
  formattedFormData: string;
  /** 权限选择器上下文（包含分组与全选状态计算器） */
  permissionSelection: PermissionSelection;
}>();

const emit = defineEmits<{
  /** 重置表单 */
  (e: 'reset-form'): void;
  /** 提交表单 */
  (e: 'submit-form'): void;
  /** 设置 AutoForm 组件实例引用 */
  (e: 'set-auto-form-ref', el: unknown): void;
}>();

/** 表单数据（v-model:formData，Vue 3.4+ defineModel 语法糖） */
const localFormData = defineModel<Record<string, unknown>>('formData', { required: true });

/**
 * 设置 AutoForm 组件实例引用
 */
const setAutoFormRef = (el: unknown): void => {
  emit('set-auto-form-ref', el);
};
</script>

<style scoped>
.playground-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.preview-body :deep(.t-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.data-panel {
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-secondary);
}

.data-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
}

.data-output {
  margin: 0;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 900px) {
  .playground-preview {
    height: 600px;
  }

  .panel-actions {
    flex-wrap: wrap;
  }

  .preview-body {
    padding: 16px;
  }
}
</style>
