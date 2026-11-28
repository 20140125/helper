<template>
  <div
    class="side-list-item"
    :class="{ active: active }"
    @click="$emit('click')"
  >
    <!-- 左侧图标 -->
    <div class="side-list-item__icon">
      <slot name="icon">
        <t-icon :name="icon" size="15px" class="side-list-item__icon-inner" />
      </slot>
    </div>

    <!-- 中间内容 -->
    <div class="side-list-item__body">
      <p class="side-list-item__title">{{ title }}</p>
      <p v-if="size !== undefined || mtime || meta || $slots.meta" class="side-list-item__meta">
        <slot name="meta">
          <span v-if="size !== undefined">{{ formatSize(size) }}</span>
          <span v-if="size !== undefined && mtime"> · </span>
          <span v-if="mtime">{{ mtime }}</span>
          <span v-if="size === undefined && !mtime && meta">{{ meta }}</span>
        </slot>
      </p>
    </div>

    <!-- 右侧箭头 -->
    <t-icon name="chevron-right" size="14px" class="side-list-item__arrow" />
  </div>
</template>

<script setup lang="ts">
import { formatSize } from '@/utils/format';

withDefaults(defineProps<{
  /** 是否选中 */
  active?: boolean;
  /** 图标名称（TDesign icon） */
  icon?: string;
  /** 图标颜色，默认 accent-secondary */
  iconColor?: string;
  /** 主标题 */
  title: string;
  /** 文件大小（字节），传入后自动格式化 */
  size?: number;
  /** 修改时间 */
  mtime?: string | null;
  /** 自定义副标题文本（size/mtime 均未传时显示） */
  meta?: string;
}>(), {
  /** TODO: active 描述 */
  active: false,
  /** TODO: icon 描述 */
  icon: 'file',
  /** TODO: iconColor 描述 */
  iconColor: '',
});

defineEmits<{
  /** 点击条目 */
  (e: 'click'): void;
}>();

</script>

<style scoped>
.side-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  height: auto;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.side-list-item:last-child {
  border-bottom: none;
}

.side-list-item:hover {
  background: var(--bg-hover);
}

.side-list-item.active {
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1);
  border-left: 3px solid var(--accent-secondary);
}

.side-list-item__icon {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1);
}

.side-list-item__icon-inner {
  color: var(--accent-secondary);
}

.side-list-item__body {
  flex: 1;
  min-width: 0;
}

.side-list-item__title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side-list-item__meta {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side-list-item__arrow {
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
