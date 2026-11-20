<template>
  <card-panel :title="title" :icon="icon" :icon-color="iconColor">
    <template #title-before>
      <span v-if="draggable" class="config-card__drag-handle" :title="dragHint">
        <t-icon name="drag-move" size="14px" />
      </span>
      <span class="config-section-bar" :style="{ background: barColor }" />
    </template>
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <slot />
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';

defineProps<{
  /** 标题 */
  title: string;
  /** 图标 */
  icon: string;
  /** 图标颜色 */
  iconColor: string;
  /** 条形颜色 */
  barColor: string;
  /** 是否显示拖拽排序把手 */
  draggable?: boolean;
  /** 拖拽把手提示文案 */
  dragHint?: string;
}>();
</script>

<style scoped>
.config-section-bar {
  display: inline-block;
  width: 4px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.config-card__drag-handle {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  cursor: grab;
  color: var(--text-muted);
  opacity: 0.55;
  transition: opacity 0.2s ease;
}

.config-card__drag-handle:hover {
  opacity: 1;
}

.config-card__drag-handle:active {
  cursor: grabbing;
}
</style>
