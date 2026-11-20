<template>
  <div class="plan-card">
    <div
      class="plan-card__header"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="t.aiChat.planTitle"
      @click="expanded = !expanded"
      @keydown.enter.prevent="expanded = !expanded"
      @keydown.space.prevent="expanded = !expanded"
    >
      <div class="plan-card__header-main">
        <t-icon name="task" class="plan-card__icon" />
        <span class="plan-card__title">{{ t.aiChat.planTitle }}</span>
        <span v-if="progressText" class="plan-card__progress">{{ progressText }}</span>
      </div>
      <t-icon
        :name="expanded ? 'chevron-up' : 'chevron-down'"
        class="plan-card__toggle"
      />
    </div>

    <div v-if="expanded" class="plan-card__body">
      <div class="plan-card__goal">
        <span class="plan-card__label">{{ t.aiChat.planGoal }}</span>
        <span class="plan-card__goal-text">{{ plan.goal }}</span>
      </div>

      <ol v-if="plan.steps.length > 0" class="plan-card__steps">
        <li
          v-for="s in plan.steps"
          :key="s.id"
          class="plan-card__step"
          :class="`plan-card__step--${s.status}`"
        >
          <t-icon :name="statusIcon(s.status)" class="plan-card__step-icon" />
          <span class="plan-card__step-title">{{ s.title }}</span>
          <span v-if="s.tool" class="plan-card__step-tool">{{ s.tool }}</span>
        </li>
      </ol>

      <div v-if="reflections && reflections.length > 0" class="plan-card__reflections">
        <div
          v-for="r in reflections"
          :key="r.round"
          class="plan-card__reflection"
          :class="{ 'plan-card__reflection--retry': !r.complete }"
        >
          <t-icon :name="r.complete ? 'check-circle' : 'error-circle'" />
          <span class="plan-card__reflection-text">
            {{ r.complete ? t.aiChat.reflectionComplete : t.aiChat.reflectionRetry }}
            <template v-if="!r.complete && r.missing"> · {{ r.missing }}</template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PlanStepStatus, UiPlan, UiReflection } from '@/types/ai-chat';
import type { Locale } from '@/locales/zh';

const props = defineProps<{
  /** 执行计划 */
  plan: UiPlan;
  /** 自我反思记录（可选） */
  reflections?: UiReflection[];
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
}>();

/** 是否展开详情 */
const expanded = ref(true);

/** 各状态对应的图标 */
const STATUS_ICON: Record<PlanStepStatus, string> = {
  pending: 'time',
  running: 'loading',
  done: 'check-circle',
  failed: 'close-circle',
  skipped: 'minus-circle',
};

/**
 * 步骤状态 → 图标名
 * @param {PlanStepStatus} status - 步骤状态
 * @returns {string} TDesign 图标名
 */
const statusIcon = (status: PlanStepStatus): string => STATUS_ICON[status] ?? 'time';

/** 已完成 / 总步骤 的进度文案（无步骤时不展示） */
const progressText = computed((): string => {
  const total = props.plan.steps.length;
  if (total === 0) return '';
  const done = props.plan.steps.filter((s) => s.status === 'done').length;
  return `${done}/${total}`;
});
</script>

<style scoped>
.plan-card {
  width: auto;
  box-sizing: border-box;
  border: 1px solid var(--border-color, #e7e7e7);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-secondary, #fafafa);
  font-size: 13px;
}

.plan-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
}

.plan-card__header-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.plan-card__icon {
  color: var(--accent-primary, #0052d9);
  flex-shrink: 0;
}

.plan-card__title {
  font-weight: 600;
  color: var(--text-primary);
}

.plan-card__progress {
  font-size: 11px;
  color: var(--text-muted, #999);
  font-variant-numeric: tabular-nums;
}

.plan-card__toggle {
  color: var(--text-muted, #999);
  flex-shrink: 0;
}

.plan-card__body {
  padding: 0 10px 8px;
  border-top: 1px solid var(--border-color, #e7e7e7);
}

.plan-card__goal {
  display: flex;
  gap: 6px;
  padding-top: 6px;
  color: var(--text-secondary, #666);
}

.plan-card__label {
  flex-shrink: 0;
  color: var(--text-muted, #999);
}

.plan-card__goal-text {
  word-break: break-word;
}

.plan-card__steps {
  margin: 6px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plan-card__step {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary, #666);
  line-height: 1.5;
}

.plan-card__step--done .plan-card__step-icon {
  color: var(--accent-green, #00a870);
}

.plan-card__step--failed .plan-card__step-icon {
  color: var(--accent-red, #e34d59);
}

.plan-card__step--skipped {
  opacity: 0.55;
}

.plan-card__step-title {
  word-break: break-word;
}

.plan-card__step-tool {
  font-size: 11px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-color);
  color: var(--text-muted, #999);
  flex-shrink: 0;
}

.plan-card__reflections {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px dashed var(--border-color, #e7e7e7);
  padding-top: 6px;
}

.plan-card__reflection {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--accent-green, #00a870);
}

.plan-card__reflection--retry {
  color: var(--accent-orange, #ed7b2f);
}

.plan-card__reflection-text {
  word-break: break-word;
}
</style>
