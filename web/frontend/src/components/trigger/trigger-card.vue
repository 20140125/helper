<template>
  <div class="trigger-card" :class="{ 'trigger-card--running': running }">
    <div class="trigger-card-body">
      <div class="flex items-start gap-3 mb-3">
        <div class="trigger-icon" :class="'trigger-icon--' + script.key">{{ script.icon }}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold" style="color: var(--text-primary);">{{ scriptLabel }}</p>
          <p class="text-xs font-mono" style="color: var(--text-muted); font-size: 10px;">{{script.scriptName}}</p>
        </div>
      </div>
      <p class="trigger-desc">{{ scriptDesc }}</p>
    </div>
    <div v-if="showRunButton !== false" class="trigger-card-footer">
      <t-button
        theme="primary"
        variant="outline"
        size="large"
        block
        @click="emit('run')"
      >
        <template #icon><t-icon name="play-circle" /></template>
        {{ t.trigger.runBtn }}
      </t-button>
    </div>
    <!-- 脚本执行结果 -->
    <script-result
      v-if="result"
      :t="t"
      :result="result"
      @clear="emit('clearResult')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ScriptItem, ScriptResultBase } from '@/types/trigger';
import ScriptResult from '@/components/common/script-result.vue';
import type { Locale } from '@/locales/zh';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 脚本信息 */
  script: ScriptItem;
  /** 是否正在运行 */
  running: boolean;
  /** 执行结果，无结果时为 undefined */
  result?: ScriptResultBase;
  /** 是否显示执行按钮（权限控制） */
  showRunButton?: boolean;
}>();

/** 当前脚本的显示名称（按 key 从 locale 读取，缺失时回退到 key） */
const scriptLabel = computed(() => props.t.trigger.scripts[props.script.key]?.label ?? props.script.key);

/** 当前脚本的描述文案 */
const scriptDesc = computed(() => props.t.trigger.scripts[props.script.key]?.desc ?? '');

const emit = defineEmits<{
  /** 点击立即执行 */
  (e: 'run'): void;
  /** 清除执行结果 */
  (e: 'clearResult'): void;
}>();
</script>
<style>
/* 描述文字 */
.trigger-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}
</style>
