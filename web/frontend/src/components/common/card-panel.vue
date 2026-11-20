<template>
  <div class="card card-panel" :class="{ 'card--full-height': fullHeight }">
    <div class="card-header">
      <!-- 左侧：图标 + 标题 -->
      <div class="flex items-center gap-3">
        <slot name="title-before" />
        <div v-if="icon" class="card-icon-wrap" :class="iconWrapClass">
          <t-icon :name="icon" :style="{ color: iconColor }" size="15px" />
        </div>
        <span class="card-title">{{ title }}</span>
        <!-- 标题右侧附加内容（如数量标签） -->
        <slot name="title-extra" />
      </div>

      <!-- 右侧：操作区 -->
      <div v-if="$slots.actions" class="flex items-center gap-2 flex-shrink-0">
        <slot name="actions" />
      </div>
    </div>

    <!-- 内容区 -->
    <div class="card-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

/** 图标主题色，对应 card-icon-wrap--{theme} */
type IconTheme = 'primary' | 'secondary' | 'amber' | 'green' | 'cyan';

const props = withDefaults(defineProps<{


  /** 卡片标题 */
  title: string;
  /** 图标名称（不传则不显示图标区域） */
  icon?: string;
  /** 图标主题，控制图标背景色 */
  iconTheme?: IconTheme;
  /** 图标颜色，不传则跟随主题色 */
  iconColor?: string;
  /** 是否撑满父容器高度（flex 列方向，card-body 自动 flex:1） */
  fullHeight?: boolean;
}>(), {
  /** TODO: iconTheme 描述 */
  iconTheme: 'primary',


});

const ICON_COLOR_MAP: Record<IconTheme, string> = {
  primary: 'var(--accent-primary)',
  secondary: 'var(--accent-secondary)',
  amber: 'var(--accent-amber)',
  green: 'var(--accent-green)',
  cyan: 'var(--accent-cyan)',
};

const iconWrapClass = computed(() =>
  props.iconTheme !== 'primary' ? `card-icon-wrap--${props.iconTheme}` : '',
);

const iconColor = computed(() =>
  props.iconColor ?? ICON_COLOR_MAP[props.iconTheme],
);
</script>

<style scoped>
.card.card--full-height {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.card.card--full-height :deep(.card-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 0;
}
</style>