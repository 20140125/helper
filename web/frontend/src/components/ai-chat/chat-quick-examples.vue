<template>
  <!--
    快捷示例 chips 行：常驻显示在输入框上方
    -----------------------------------------------------------------
    设计要点（v2 产品视角调整）：
    1) 去卡片化：本组件本质是「输入框的预输入提示」，而非独立功能区。
       去掉外层卡片底色 / 边框 / 阴影后，整体重量降到「标签云」级别，
       与下方输入框形成「母子关系」而非两块割裂的兄弟控件。
    2) 引导前缀：左侧常驻一个不滚动的 "✨ 试试" 小标签，
       告诉用户这些文字的含义是「建议你试试」，避免被误认为系统状态。
    3) chip 视觉降级：默认胶囊形 + 浅灰背景 + 无边框，
       hover 才用品牌色（accent-green）高亮，引导点击但不抢视觉。
    4) 滚动遮罩仅在真正溢出时显示，且颜色用抽屉底色（--bg-primary）
       而非卡片色，这样被遮内容才能与抽屉无缝融合。
    5) 点击行为不变：emit('select-example', text)，与父组件协议保持一致。
    -----------------------------------------------------------------
  -->
  <div v-if="examples.length > 0" class="ai-chat-quick-examples">
    <!--
      左侧引导前缀：固定不滚动，给整行 chips 提供语义。
      使用 t-icon 而不是 emoji 避免不同平台显示差异。
    -->
    <div class="ai-chat-quick-examples__hint" aria-hidden="true">
      <t-icon name="lightbulb" size="14px" />
      <span class="ai-chat-quick-examples__hint-text">{{ t.aiChat.quickExamplesHint }}</span>
    </div>

    <!--
      内层 .__scroll 才是真正横向滚动的容器；
      :class 上带 overflowed 用于控制右侧渐变遮罩仅在溢出时出现。
    -->
    <div
      ref="scrollEl"
      class="ai-chat-quick-examples__scroll"
      :class="{ 'is-overflowed': isOverflowed }"
      role="list"
    >
      <button
        v-for="(ex, i) in examples"
        :key="i"
        type="button"
        class="ai-chat-quick-examples__chip"
        role="listitem"
        :disabled="streaming"
        :title="ex"
        @click="emit('select-example', ex)"
      >
        {{ ex }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import type { Locale } from '@/locales/zh';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 示例问题列表（由 model.welcomeExamples 提供） */
  examples: string[];
  /** 是否正在流式响应中，用于禁止点击 */
  streaming: boolean;
}>();

const emit = defineEmits<{
  /** 选中某条示例问题，参数为问题文本；父组件接到后执行 sendExample */
  (e: 'select-example', text: string): void;
}>();

// ============================================================
// 溢出检测：仅在真的有更多内容时才显示右侧渐变遮罩，
// 避免示例较少时遮罩"凭空出现"造成视觉噪音。
// ============================================================
const scrollEl = ref<HTMLElement | null>(null);
const isOverflowed = ref(false);

/** 检测水平方向是否溢出。+1 是为了避开亚像素抖动。 */
function checkOverflow() {
  const el = scrollEl.value;
  if (!el) return;
  isOverflowed.value = el.scrollWidth > el.clientWidth + 1;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  checkOverflow();
  // 用 ResizeObserver 监听抽屉宽度变化（用户拖动 / 折叠侧栏）
  if (typeof ResizeObserver !== 'undefined' && scrollEl.value) {
    resizeObserver = new ResizeObserver(() => checkOverflow());
    resizeObserver.observe(scrollEl.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

// 示例列表变化（i18n 切换）后重新计算
watch(
  () => props.examples,
  () => nextTick(checkOverflow),
  { deep: true },
);
</script>

<style scoped>
/*
  ============================================================
  整体布局：横向 flex，三段式
    [✨ 试试]   |   [chip] [chip] [chip] ...   |   (右侧渐变遮罩)
  - 引导前缀 .__hint：flex-shrink: 0，永不被压缩
  - 滚动容器 .__scroll：flex: 1，承担横向滚动
  - 不再使用卡片外壳，背景透明，紧贴输入框上方
  ============================================================
*/
.ai-chat-quick-examples {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  /* 与输入框形成"母子"关系：间距收紧到 4px，少于卡片间间距 */
  margin-bottom: 4px;
  padding: 6px 2px;
}

/* ============================================================
   引导前缀："✨ 试试"
   - 用极小的图标 + 12px 灰字，仅作语义提示，不抢焦点
   - 与 chips 之间用 8px gap 隔开，视觉上是"标签 → 列表"
   ============================================================ */
.ai-chat-quick-examples__hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1;
  /* 让图标和文字基线对齐 */
  padding: 0 2px;
  user-select: none;
}

.ai-chat-quick-examples__hint-text {
  font-weight: 500;
}

/* ============================================================
   滚动容器
   - flex: 1 占满剩余宽度
   - 横向滚动，隐藏滚动条
   - 右侧渐变遮罩通过 ::after 实现，仅在 .is-overflowed 时显示
   ============================================================ */
.ai-chat-quick-examples__scroll {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  /* 隐藏滚动条但保留滚动能力 */
  scrollbar-width: none;
  /* 给右侧遮罩留出可视空间，避免最后一个 chip 被遮 */
  padding-right: 4px;
}

.ai-chat-quick-examples__scroll::-webkit-scrollbar {
  display: none;
}

/* 右侧渐变遮罩：用抽屉底色（--bg-primary）渐变到透明，
   提示"右边还有内容"。仅溢出时出现。 */
.ai-chat-quick-examples__scroll.is-overflowed::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 28px;
  pointer-events: none;
  background: linear-gradient(
    to left,
    var(--bg-primary) 0%,
    rgba(0, 0, 0, 0) 100%
  );
}

/* ============================================================
   chip 单元（用原生 <button>，不依赖 t-button，避免被全局 override 影响）
   - 默认态：浅底无边框，低噪点
   - hover：品牌色淡背景 + 品牌色文字，明确"可点"
   - active：轻微下沉，提供按压反馈
   ============================================================ */
.ai-chat-quick-examples__chip {
  flex-shrink: 0;
  white-space: nowrap;
  /* 胶囊形 */
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1;
  padding: 6px 12px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.05s ease;
  /* 限制单条 chip 不会无限长，避免一条超长示例把整行撑爆 */
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-quick-examples__chip:hover {
  background: rgba(var(--accent-green-rgb), 0.12);
  color: var(--accent-green);
  border-color: rgba(var(--accent-green-rgb), 0.25);
}

.ai-chat-quick-examples__chip:active {
  transform: translateY(1px);
}

.ai-chat-quick-examples__chip:focus-visible {
  outline: 2px solid var(--accent-green);
  outline-offset: 1px;
}
</style>
