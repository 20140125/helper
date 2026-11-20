<template>
  <div class="log-output">
    <!-- 加载中 -->
    <loading-spinner :t="t" v-if="loading" padding-y="8px" text-size="12px" />

    <template v-else>
      <!-- 无内容时 -->
      <p
        v-if="!cleanStdout && !cleanStderr"
        class="text-sm"
        style="color: var(--text-muted); padding: 8px 0;"
      >
        {{ emptyText }}
      </p>

      <!-- stdout -->
      <template v-if="cleanStdout">
        <!-- 访问日志格式：使用卡片化 viewer 展示特殊记录 -->
        <access-log-viewer
          v-if="isAccessLog"
          :t="t"
          class="log-access-viewer rounded-lg"
          :style="{ maxHeight: maxHeight }"
          :content="cleanStdout"
          :empty-text="emptyText"
        />
        <!-- 普通日志：原有 pre 文本渲染 -->
        <div
          v-else
          ref="stdoutRef"
          class="log-code-area rounded-lg"
          :style="{ maxHeight: maxHeight, overflowY: 'auto' }"
        >
          <pre :style="{ fontSize: fontSize }">{{ cleanStdout }}</pre>
        </div>
      </template>

      <!-- stderr -->
      <div
        v-if="cleanStderr"
        class="log-code-area rounded-lg"
        :class="cleanStdout ? 'mt-2' : ''"
        :style="{
          maxHeight: stderrMaxHeight,
          overflowY: 'auto',
          background: 'rgba(var(--accent-red-rgb), 0.06)',
          border: '1px solid rgba(var(--accent-red-rgb), 0.15)',
        }"
      >
        <pre :style="{ color: 'var(--accent-red)', fontSize: fontSize }">{{ cleanStderr }}</pre>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import LoadingSpinner from '@/components/common/loading-spinner.vue';
import AccessLogViewer from '@/components/common/access-log-viewer.vue';
import {
  ACCESS_LOG_USER_MARKER,
  ACCESS_LOG_STATUS_MARKER,
  ACCESS_LOG_DURATION_MARKER,
} from '@/constants/access-log';
import type { Locale } from '@/locales/zh';

const stdoutRef = ref<HTMLElement | null>(null);

/** 去除 ANSI 转义码（兜底处理，防止后端遗漏） */
const stripAnsi = (str: string): string =>
  str
    ? str.replace(
        // eslint-disable-next-line no-control-regex -- ANSI 转义码本身就是控制字符，只能按码点匹配
        /[\x1b\x9b][[\]()#;?]*(?:(?:(?:;[-\w/#&.:=?%@~])*|[a-zA-Z\d]*(?:;[-\w/#&.:=?%@~]*)*)?\x07|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g,
        '',
      )
    : '';

const props = withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 标准输出内容 */
  stdout?: string;
  /** 错误输出内容 */
  stderr?: string;
  /** 加载状态 */
  loading?: boolean;
  /** stdout 最大高度（CSS 长度值，含单位） */
  maxHeight?: string;
  /** stderr 最大高度（CSS 长度值，含单位） */
  stderrMaxHeight?: string;
  /** 字体大小（CSS 长度值，含单位） */
  fontSize?: string;
  /** 无内容时的提示文字 */
  emptyText?: string;
}>(), {
  /** TODO: stdout 描述 */
  stdout: '',
  /** TODO: stderr 描述 */
  stderr: '',
  /** TODO: loading 描述 */
  loading: false,
  /** TODO: maxHeight 描述 */
  maxHeight: '280px',
  /** TODO: stderrMaxHeight 描述 */
  stderrMaxHeight: '140px',
  /** TODO: fontSize 描述 */
  fontSize: '12px',
  /** TODO: emptyText 描述 */
  emptyText: '',


});

/** 清理后的 stdout / stderr（兜底去除 ANSI 码） */
const cleanStdout = computed(() => stripAnsi(props.stdout));
const cleanStderr = computed(() => stripAnsi(props.stderr));

/**
 * 判断 stdout 是否为后端 access-log 格式。
 * 特征：同时包含条目起始标记 ▸ 以及 用户: / 状态: / 耗时: 元信息 marker。
 * 满足则切换到 access-log-viewer 渲染，以获得卡片化展示效果。
 */
const isAccessLog = computed(() => {
  const text = cleanStdout.value;
  if (!text) return false;
  return (
    text.includes('▸')
    && text.includes(ACCESS_LOG_USER_MARKER)
    && text.includes(ACCESS_LOG_STATUS_MARKER)
    && text.includes(ACCESS_LOG_DURATION_MARKER)
  );
});

// 内容变化后自动滚到底部
const scrollToBottom = async () => {
  await nextTick();
  if (stdoutRef.value) {
    stdoutRef.value.scrollTop = stdoutRef.value.scrollHeight;
  }
};

watch(() => props.stdout, scrollToBottom);
watch(() => props.loading, (loading) => {
  if (!loading) scrollToBottom();
});
</script>

<style scoped>
/* access-log-viewer 内部为 flex:1，需要外层确立 flex column 容器以使 maxHeight 与滚动生效 */
.log-access-viewer {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>


