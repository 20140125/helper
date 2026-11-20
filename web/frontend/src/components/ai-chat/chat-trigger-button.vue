<template>
  <t-button
    variant="text"
    class="ai-chat-trigger app-floating-btn"
    shape="circle"
    :title="title"
    :aria-label="title"
    @click="emit('click')"
  >
    <template #icon><t-icon name="ai-1-filled" /></template>
    <span v-if="streaming" class="ai-chat-trigger__dot" />
  </t-button>
</template>

<script setup lang="ts">
defineProps<{
  /** 按钮悬浮提示文本（同时作为 aria-label） */
  title: string;
  /** 是否处于流式响应中，true 时右上角展示脉动小红点 */
  streaming: boolean;
}>();

const emit = defineEmits<{
  /** 点击触发按钮（打开抽屉） */
  (e: 'click'): void;
}>();
</script>

<style scoped>
/* 仅保留差异化属性：fixed 定位（位于 back-to-top 上方 86px = 32 + 44 + 10gap）。
   外观由全局 .app-floating-btn 提供。 */
.ai-chat-trigger {
  position: fixed;
  right: 28px;
  bottom: 88px;
  z-index: 1500;
}

/* 流式响应中的状态指示点（右上角小红点） */
.ai-chat-trigger__dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--td-warning-color, #ed7b2f);
  animation: ai-chat-pulse 1.2s infinite;
  pointer-events: none;
}

@keyframes ai-chat-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 移动端：贴近边缘（尺寸由全局 .app-floating-btn 媒体查询处理） */
@media (max-width: 768px) {
  .ai-chat-trigger {
    right: 16px;
    bottom: 70px;
  }
}
</style>
