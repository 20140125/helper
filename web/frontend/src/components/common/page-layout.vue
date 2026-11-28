<template>
  <t-loading :loading="pageLoading">
    <div class="space-y-7" :data-no-anchor="disableAnchor ? '' : undefined">
      <!-- 页面标题区（整合自 page-header） -->
      <div :class="['flex items-center gap-3 flex-wrap', $slots.actions ? 'justify-between' : '']">
        <div class="min-w-0">
          <h1 class="page-title">{{ title }}</h1>
          <p class="page-subtitle">{{ subtitle }}</p>
        </div>
        <div v-if="$slots.actions" class="flex items-center gap-3 flex-wrap">
          <slot name="actions" />
        </div>
      </div>

      <!-- 页面内容区 -->
      <slot />
    </div>
  </t-loading>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** 页面级加载状态，控制全页 loading 遮罩 */
  pageLoading?: boolean;
  /** 页面标题 */
  title: string;
  /** 页面副标题 */
  subtitle?: string;
  /** 是否禁用页面锚点导航（个别页面不需要时可关闭） */
  disableAnchor?: boolean;
}>(), {
  pageLoading: false,
  subtitle: '',
  disableAnchor: false,
});
</script>
