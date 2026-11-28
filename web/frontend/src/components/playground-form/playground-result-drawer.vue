<template>
  <t-drawer
    v-model:visible="visible"
    :header="t.playground.submitHeader"
    :footer="false"
    size="520px"
    attach="body"
  >
    <pre class="result-output">{{ formattedResult }}</pre>
  </t-drawer>
</template>

<script setup lang="ts">
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 格式化后的提交结果（JSON 字符串等，按 pre 渲染） */
  formattedResult: string;
}>();

/** 抽屉显示状态（v-model:visible，Vue 3.4+ defineModel 语法糖） */
const visible = defineModel<boolean>('visible', { required: true });
</script>

<style scoped>
.result-output {
  margin: 0;
  padding: 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}
</style>
