<template>
  <div v-if="tabs.length > 0" class="tab-bar">
    <t-tabs
      :value="activeTab"
      theme="card"
      size="medium"
      :add-able="false"
      drag-sort
      @change="(val: string) => emit('navigate', val)"
      @remove="({ value }: { value: string }) => emit('close', value)"
      @drag-sort="({ currentIndex, targetIndex }: { currentIndex: number; targetIndex: number }) => emit('reorder', currentIndex, targetIndex)"
    >
      <t-tab-panel
        v-for="tab in tabs"
        :key="tab.name"
        :value="tab.name"
        :label="tab.label"
        :removable="tabs.length > 1"
        destroy-on-hide
      >
        <template #label>
          <div class="tab-label-inner">
            <t-icon :name="tab.icon" size="13px" />
            <span>{{ tab.label }}</span>
          </div>
        </template>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script setup lang="ts">
import type { TabItem } from '@/stores/tab-bar';

defineProps<{
  /** 标签页列表（来自 useTabBarStore） */
  tabs: TabItem[];
  /** 当前激活的标签页 name */
  activeTab: string;
}>();

const emit = defineEmits<{
  /** 点击标签跳转路由，参数为路由 name */
  (e: 'navigate', name: string): void;
  /** 关闭标签页，参数为路由 name */
  (e: 'close', name: string): void;
  /** 拖拽标签页换位，参数为拖起下标与目标下标 */
  (e: 'reorder', fromIndex: number, toIndex: number): void;
}>();
</script>

<style scoped>
.tab-bar {
  width: 100%;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.tab-bar :deep(.t-tabs__nav),
.tab-bar :deep(.t-tabs__nav-container),
.tab-bar :deep(.t-tabs__nav-scroll),
.tab-bar :deep(.t-tabs__nav-wrap) {
  background: transparent;
  border-bottom: none;
}

/* 覆盖 TDesign card 主题自带的 tab 项背景色，跟随项目主题变量 */
.tab-bar :deep(.t-tabs__nav-item-wrapper) {
  background: transparent;
}

.tab-bar :deep(.t-tabs__nav-item) {
  font-size: 12px;
  background: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.tab-bar :deep(.t-tabs__nav-item.t-is-active) {
  background: var(--bg-card);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.tab-bar :deep(.t-tabs__nav-item:hover:not(.t-is-active)) {
  color: var(--text-primary);
  background: rgba(var(--accent-primary-rgb), 0.08);
}
/* 去掉 card 主题自带的内容区域间距 */
.tab-bar :deep(.t-tabs__content) {
  display: none;
}

.tab-label-inner {
  display: flex;
  align-items: center;
  gap: 5px;
  /* 让拖拽事件命中 tab 项根节点：TDesign drag-sort 用 dragstart 的 target 定位下标，
     若起点落在内部 icon/文字上会取到 -1；同时避免拖动时选中文字触发浏览器原生文本拖拽 */
  pointer-events: none;
  user-select: none;
}
</style>
