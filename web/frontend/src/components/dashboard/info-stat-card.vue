<template>
  <stat-card
    :label="label"
    :theme="theme"
    :value="value"
    :desc="desc"
    :icon="icon"
    clickable
    @click="$router.push({ name: routeName })"
  >
    <template #extra>
      <!-- 路径展示模式 -->
      <p
        v-if="extraPath"
        class="text-xs mt-3 font-mono truncate px-2 py-1.5 rounded-lg max-w-full"
        :style="`color: var(--text-muted); background: ${tagBg}; border: 1px solid ${tagBorder}; word-break: break-all;`"
        :title="extraPath"
      >
        {{ extraPath }}
      </p>

      <!-- 标签列表模式 -->
      <template v-else-if="tags && tags.length > 0">
        <div class="flex flex-wrap gap-1.5 mt-3">
          <span
            v-for="item in tags"
            :key="item.label"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            :style="`background: ${tagBg}; color: var(--accent-primary); border: 1px solid ${tagBorder};`"
          >
            {{ item.label }} {{ item.count }}
          </span>
        </div>
      </template>
      <p v-else-if="tags" class="stat-desc mt-3" style="font-style: italic;">{{ emptyText }}</p>
    </template>
  </stat-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatCard from '@/components/common/stat-card.vue';
import type { TagItem } from '@/types/common';

defineProps<{
  /** 卡片标签 */
  label: string;
  /** 主题色 */
  theme: 'violet' | 'indigo';
  /** 主值 */
  value: number | string;
  /** 描述文字 */
  desc: string;
  /** 右上角图标 */
  icon: string;
  /** 点击跳转的路由名 */
  routeName: string;
  /** 路径展示（缓存文件模式） */
  extraPath?: string;
  /** 标签列表（规则模式），传入空数组显示空状态 */
  tags?: TagItem[];
  /** 空状态文案 */
  emptyText?: string;
}>();

const tagBg = computed(() => 'rgba(var(--accent-primary-rgb, 99, 102, 241), 0.08)');
const tagBorder = computed(() => 'rgba(var(--accent-primary-rgb, 99, 102, 241), 0.15)');
</script>
