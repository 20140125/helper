<template>
  <div
    class="trigger-card update-tools-card"
    :class="{ 'update-tools-card--expanded': updateToolsExpanded }"
  >
    <div class="trigger-card-body">
      <!-- 卡片头部，点击展开/收起 -->
      <div class="flex items-start gap-3 mb-3 cursor-pointer select-none" @click="emit('toggle')">
        <div class="trigger-icon trigger-icon--annual_update">🛠️</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold" style="color: var(--text-primary);">{{ t.trigger.annualUpdate }}</p>
          <p class="text-xs font-mono" style="color: var(--text-muted); font-size: 10px;" v-if="!updateToolsExpanded">annual_update.sh</p>
        </div>
        <t-icon
          :name="updateToolsExpanded ? 'chevron-up' : 'chevron-down'"
          size="22px"
          style="color: var(--text-muted); flex-shrink: 0; margin-top: 3px;"
        />
      </div>
      <p class="trigger-desc">{{ t.trigger.annualUpdateDesc }}</p>
    </div>

    <!-- 收起时显示立即执行按钮 -->
    <div v-if="!updateToolsExpanded && showRunButton !== false" class="trigger-card-footer">
      <t-button
        theme="primary"
        variant="outline"
        size="large"
        block
        @click.stop="emit('run-annual-update')"
      >
        <template #icon><t-icon name="play-circle" /></template>
        {{ t.trigger.runBtn }}
      </t-button>
    </div>

    <!-- 年度更新执行结果 -->
    <script-result
      v-if="!updateToolsExpanded && annualUpdateResult"
      :result="annualUpdateResult"
      :t="t"
      @clear="emit('clear-annual-result')"
    />

    <!-- 展开内容 -->
    <transition name="update-tools-expand">
      <div v-if="updateToolsExpanded" class="update-tools-content">
        <!-- 工具列表 -->
        <div class="space-y-3">
          <div
            v-for="tool in updateTools"
            :key="tool.key"
            class="update-tool-item"
            :class="{ 'update-tool-item--running': runningToolKey === tool.key }"
          >
            <!-- 工具头部 -->
            <div class="update-tool-header">
              <div
                class="flex items-center gap-2 flex-1 min-w-0"
                :class="{ 'cursor-pointer select-none': tool.params.filter(p => p.name !== 'year').length > 0 }"
                @click="tool.params.filter(p => p.name !== 'year').length > 0 && emit('toggle-tool', tool.key)"
              >
                <div class="update-tool-icon">
                  {{ toolIcons[tool.key] || '🔧' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold" style="color: var(--text-primary);">{{ tool.label }}</p>
                  <p class="text-xs font-mono" style="color: var(--text-muted); font-size: 10px;">{{ tool.filename }}</p>
                </div>
                <t-icon
                  v-if="tool.params.filter(p => p.name !== 'year').length > 0"
                  class="cursor-pointer select-none"
                  :name="expandedTool === tool.key ? 'chevron-up' : 'chevron-down'"
                  size="22px"
                  style="color: var(--text-muted); flex-shrink: 0;"
                  @click.stop="emit('toggle-tool', tool.key)"
                />
              </div>
              <t-button
                v-if="(tool.params.filter(p => p.name !== 'year').length === 0 || expandedTool === tool.key) && showRunButton !== false"
                class="update-tool-run-btn"
                theme="primary"
                variant="outline"
                size="large"
                @click.stop="emit('tool-trigger-run', tool)"
              >
                <template #icon><t-icon name="play-circle" /></template>
                {{ t.trigger.runBtn }}
              </t-button>
            </div>

            <!-- 参数表单 -->
            <div v-if="expandedTool === tool.key && tool.params.filter(p => p.name !== 'year').length > 0" class="update-tool-form">
              <auto-form
                :ref="(el) => emit('set-tool-form-ref', tool.key, el as FormInstanceFunctions | null)"
                :model-value="toolArgs[tool.key]"
                :fields="getToolFields(tool)"
                class="update-tool-form-grid"
                @update:model-value="(val) => emit('update-tool-args', tool.key, val)"
              >
                <template
                  v-for="param in tool.params.filter(p => p.name !== 'year' && p.type === 'date-array')"
                  :key="param.name"
                  #[`content-${param.name}`]="{ field }"
                >
                  <t-date-picker
                    :value="getDateArrayValue(toolArgs[tool.key], field.name)"
                    mode="date"
                    format="YYYY-MM-DD"
                    :placeholder="param.placeholder"
                    size="large"
                    style="width: 100%;"
                    multiple
                    @change="(val: string[]) => emit('update-tool-args', tool.key, { ...toolArgs[tool.key], [field.name]: val })"
                  />
                </template>
              </auto-form>
            </div>

            <!-- 该工具的执行结果 -->
            <script-result
              v-if="toolResults[tool.key]"
              :result="toolResults[tool.key]"
              :t="t"
              @clear="emit('clear-tool-result', tool.key)"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import ScriptResult from '@/components/common/script-result.vue';
import AutoForm from '@/components/auto-form/index.vue';
import type { FormInstanceFunctions } from 'tdesign-vue-next';
import type { AutoFormField } from '@/types/auto-form';
import type { UpdateToolScript } from '@/types/update-tools';
import type { Locale } from '@/locales/zh';
import type { ScriptResultBase } from '@/types/trigger';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 工具列表 */
  updateTools: UpdateToolScript[];
  /** 卡片是否展开 */
  updateToolsExpanded: boolean;
  /** 当前展开的子工具 key */
  expandedTool: string | null;
  /** 正在运行的子工具 key */
  runningToolKey: string | null;
  /** 各工具的参数值（以字段名为 key） */
  toolArgs: Record<string, Record<string, unknown>>;
  /** 各工具的执行结果 */
  toolResults: Record<string, ScriptResultBase>;
  /** 年度更新整体执行结果 */
  annualUpdateResult?: ScriptResultBase;
  /** 工具图标映射 */
  toolIcons: Record<string, string>;
  /** 是否移动端（已废弃，auto-form 内部自动处理） */
  isMobile?: boolean;
  /** 是否显示执行按钮（权限控制） */
  showRunButton?: boolean;
}>();

const emit = defineEmits<{
  /** 展开/收起卡片 */
  (e: 'toggle'): void;
  /** 执行整体年度更新 */
  (e: 'run-annual-update'): void;
  /** 清除整体执行结果 */
  (e: 'clear-annual-result'): void;
  /** 展开/收起子工具 */
  (e: 'toggle-tool', key: string): void;
  /** 执行子工具 */
  (e: 'tool-trigger-run', tool: UpdateToolScript): void;
  /** 清除子工具执行结果 */
  (e: 'clear-tool-result', key: string): void;
  /** 注册子工具表单 ref */
  (e: 'set-tool-form-ref', key: string, el: FormInstanceFunctions | null): void;
  /** 更新子工具参数 */
  (e: 'update-tool-args', key: string, val: Record<string, unknown>): void;
}>();

/**
 * 将工具参数配置转换为 auto-form 字段配置
 * @param tool - 更新工具脚本对象
 * @returns AutoFormField 数组
 */
const getToolFields = (tool: UpdateToolScript): AutoFormField[] =>
  tool.params
    .filter((p) => p.name !== 'year')
    .map((p) => ({
      name: p.name,
      label: p.label,
      type: p.type === 'select' ? 'select' : 'input',
      placeholder: p.placeholder,
      options: p.type === 'select' ? p.options?.map((o) => ({ value: o.value, label: o.label })) : undefined,
      rules: p.required ? [{ required: true, message: `${p.label}${props.t.common.required}` }] : [],
    }));

/**
 * 从 toolArgs 中取多选日期值
 * @param args - 工具参数对象
 * @param name - 字段名
 * @returns 字符串数组
 */
const getDateArrayValue = (args: Record<string, unknown>, name: string): string[] => {
  const val = args[name];
  return Array.isArray(val) ? (val as string[]) : [];
};
</script>

<style scoped>
/* 年度数据更新工具卡片 */
.update-tools-card {
  min-height: 160px;
}

.update-tools-card--expanded {
  grid-column: 1 / -1;
}

.update-tools-content {
  border-top: 1px solid var(--border-color, rgba(255,255,255,0.06));
  padding-top: 14px;
  margin-top: 4px;
}

.update-tool-item {
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 14px 16px;
  transition: border-color 0.2s;
}

.update-tool-item:hover {
  border-color: rgba(99, 102, 241, 0.35);
}

.update-tool-item--running {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.04);
}

.update-tool-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.update-tool-run-btn {
  flex-shrink: 0;
}

.update-tool-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .update-tool-header {
    flex-wrap: wrap;
  }

  .update-tool-run-btn {
    width: 100%;
    margin-top: 4px;
  }
}

.update-tool-form {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color, rgba(255,255,255,0.06));
}

.update-tool-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 12px;
}

@media (max-width: 768px) {
  .update-tool-form-grid {
    grid-template-columns: 1fr;
  }

  .update-tools-card--expanded {
    grid-column: 1;
  }
}

.update-tool-form-item {
  width: 100% !important;
  margin-bottom: 0 !important;
}

:deep(.update-tool-form-item) {
  padding-bottom: 24px;
}

:deep(.update-tool-form-item .t-form__status) {
  position: absolute;
  margin-top: 4px;
}

:deep(.update-tool-form-item .t-form__item-wrap) {
  position: relative;
}

:deep(.t-date-picker .t-input__wrap) {
  display: flex;
  align-items: center;
  min-height: 40px;
}

:deep(.t-date-picker .t-input) {
  display: flex;
  align-items: center;
  min-height: 40px;
  height: auto;
}

:deep(.t-date-picker .t-input__inner) {
  display: flex;
  align-items: center;
  height: auto;
  min-height: 40px;
}

:deep(.t-date-picker .t-tag) {
  margin: 3px 4px 3px 0;
  background: var(--bg-secondary, rgba(255,255,255,0.08));
  border-color: var(--border-color, rgba(255,255,255,0.12));
  color: var(--text-primary, inherit);
  vertical-align: middle;
}

:deep(.t-date-picker .t-tag .t-tag__icon-close) {
  color: var(--text-muted, rgba(255,255,255,0.45));
}

:deep(.t-date-picker .t-input__prefix) {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  align-items: center;
  align-self: center;
  padding: 4px 0;
  height: auto;
}

/* 年度数据更新展开/收起过渡动画 */
.update-tools-expand-enter-active,
.update-tools-expand-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease, max-height 0.3s ease;
  overflow: hidden;
  max-height: 2000px;
}

.update-tools-expand-enter-from,
.update-tools-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
}
</style>
