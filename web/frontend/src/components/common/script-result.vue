<template>
  <div class="script-result" :class="{ 'script-result--expanded': result }" v-if="result">
    <div class="flex items-center gap-2 mb-2">
      <t-icon
        :name="result.code === 0 ? 'check-circle' : 'close-circle'"
        :style="{ color: result.code === 0 ? 'var(--accent-green)' : 'var(--accent-red)' }"
        size="13px"
      />
      <span class="text-xs font-medium" :style="{ color: result.code === 0 ? 'var(--accent-green)' : 'var(--accent-red)' }">
        {{ label ? `${label} — ` : '' }}{{ result.code === 0 ? t.components.execSuccess : t.components.execFailed }}
      </span>
      <span class="text-xs" style="color: var(--text-muted);">{{ result.time }}</span>
      <t-button
        variant="text"
        size="small"
        style="margin-left: auto;"
        @click="emit('clear')"
      >
        <template #icon><t-icon name="close" size="12px" /></template>
      </t-button>
    </div>
    <log-output
      :t="t"
      :stdout="stdout"
      :stderr="result.stderr"
      max-height="200px"
      stderr-max-height="100px"
      font-size="11px"
    />
  </div>
</template>

<script setup lang="ts">
import LogOutput from '@/components/common/log-output.vue';
import type { Locale } from '@/types/locale';
import type { ScriptResultBase } from '@/types/trigger';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 脚本执行结果数据 */
  result: ScriptResultBase;
  /** 可选标签，显示在状态前（如规则名称） */
  label?: string;
  /** 标准输出内容，默认为空 */
  stdout?: string;
}>();

const emit = defineEmits<{
  /** 清除执行结果 */
  (e: 'clear'): void;
}>();
</script>

<style scoped>
.script-result {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}

.script-result--expanded {
  max-height: 400px;
  opacity: 1;
}
</style>
