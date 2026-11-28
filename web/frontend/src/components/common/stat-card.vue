<template>
  <div
    class="stat-card"
    :class="[`stat-card--${theme}`, clickable ? 'cursor-pointer' : '']"
    v-bind="clickable ? { onClick: handleClick } : {}"
  >
    <div class="flex items-start justify-between flex-1">
      <div class="flex-1 min-w-0">
        <!-- 标签 -->
        <p class="stat-label">{{ label }}</p>

        <!-- 主值区域 -->
        <div class="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <!-- 主值 -->
          <p
            class="stat-value stat-number-glow flex-shrink-0"
            :style="{ color: valueColorComputed }"
          >
            {{ value }}
          </p>

          <!-- PID 列表 / 自定义右侧内容 -->
          <slot name="value-extra" />
        </div>

        <!-- 描述文字 -->
        <p v-if="desc" class="stat-desc mt-1.5">{{ desc }}</p>

        <!-- 额外内容插槽（标签、路径、按钮等） -->
        <slot name="extra" />
      </div>

      <!-- 右上角图标 -->
      <div
        class="stat-icon-wrap"
        :style="iconWrapStyle"
      >
        <t-icon
          :name="icon"
          :style="iconStyleComputed"
          size="22px"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  /** 卡片主题色，对应 stat-card--{theme} */
  theme?: 'green' | 'red' | 'violet' | 'indigo';
  /** 卡片左上角标签 */
  label: string;
  /** 主值文字 */
  value: string | number;
  /** 主值颜色 */
  valueColor?: string;
  /** 描述文字 */
  desc?: string;
  /** 右上角图标名称 */
  icon: string;
  /** 右上角图标颜色 */
  iconColor?: string;
  /** 右上角图标背景色，不传则跟随主题色 */
  iconBg?: string;
  /** 右上角图标阴影，不传则跟随主题色 */
  iconShadow?: string;
  /** 是否可点击 */
  clickable?: boolean;
}>(), {
  theme: 'green',
  clickable: false,
});

const emit = defineEmits<{
  /** 卡片整体点击（仅 clickable=true 时触发） */
  (e: 'click'): void;
}>();

const iconWrapStyle = computed(() => ({
  background: props.iconBg ?? 'rgba(var(--accent-primary-rgb, 99, 102, 241), 0.12)',
  boxShadow: props.iconShadow ?? '0 0 16px rgba(var(--accent-primary-rgb, 99, 102, 241), 0.2)',
}));

const iconStyleComputed = computed(() => ({
  color: props.iconColor ?? 'var(--accent-primary)',
}));

const valueColorComputed = computed(() => props.valueColor ?? 'var(--accent-primary)');

const handleClick = () => {
  emit('click');
};
</script>
