<template>
  <!--
    Mermaid 图表放大预览对话框
    - 以 SVG viewBox 的自然像素尺寸 1:1 渲染（文字为原始字号，不被气泡宽度压缩）
    - 缩放按钮直接改变画布像素宽高，SVG 作为 DOM 保留 foreignObject 文字
  -->
  <t-dialog
    v-model:visible="visibleModel"
    :header="t.aiChat.mermaidPreviewTitle"
    :footer="false"
    top="10vh"
    width="min(1280px, 96vw)"
    attach="body"
    class="mermaid-preview-dialog"
  >
    <div class="mermaid-preview">
      <!-- 缩放工具条：文字按钮，避免图标名差异导致按钮不可见 -->
      <div class="mermaid-preview__toolbar">
        <t-button size="small" variant="outline" :disabled="scale <= 0.5" @click="zoomOut">
          −
        </t-button>
        <span class="mermaid-preview__scale">{{ scalePercent }}</span>
        <t-button size="small" variant="outline" :disabled="scale >= 4" @click="zoomIn">
          +
        </t-button>
        <t-button size="small" variant="text" @click="resetZoom">
          {{ t.aiChat.mermaidZoomReset }}
        </t-button>
        <t-button size="small" variant="text" @click="fitToStage">
          {{ t.aiChat.mermaidZoomFit }}
        </t-button>
      </div>

      <!-- 画布尺寸 = 自然尺寸 × 缩放比例；溢出部分用滚动条查看 -->
      <div ref="stageRef" class="mermaid-preview__stage">
        <div class="mermaid-preview__canvas" :style="canvasStyle">
          <!-- eslint-disable vue/no-v-html -- 内容由 mermaid strict 模式渲染，非用户输入 -->
          <div class="mermaid-preview__svg" v-html="svg" />
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Locale } from '@/locales/zh';

/** Vue 3.4+ defineModel 语法糖：对话框显示状态 */
const visibleModel = defineModel<boolean>('visible', { required: true });

const props = defineProps<{
  /** mermaid 渲染出的 svg HTML 字符串（取气泡内节点的 outerHTML） */
  svg: string;
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
}>();

/** 滚动容器引用，用于「适应窗口」计算可用宽度 */
const stageRef = ref<HTMLDivElement | null>(null);

/** 当前缩放比例（0.5 ~ 4，1 = 原始像素尺寸） */
const scale = ref(1);

/**
 * 从 svg 字符串解析 viewBox 的自然宽高
 * @param {string} svgHtml - svg 的 outerHTML
 * @returns {{ w: number, h: number }} 自然尺寸，解析失败回退到 800×600
 * @description 用正则而非 DOMParser，避免 foreignObject 里的 HTML 不满足 XML 规范时解析失败
 */
const parseViewBox = (svgHtml: string): { w: number; h: number } => {
  const match = svgHtml.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (match) {
    const parts = match[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] };
    }
  }
  return { w: 800, h: 600 };
};

/** svg 的自然像素尺寸 */
const natural = computed(() => parseViewBox(props.svg));

/** 画布显式像素尺寸：跟随 scale 变化，按钮点击立即生效 */
const canvasStyle = computed(() => ({
  width: `${Math.round(natural.value.w * scale.value)}px`,
  height: `${Math.round(natural.value.h * scale.value)}px`,
}));

/** 缩放百分比显示文本 */
const scalePercent = computed((): string => `${Math.round(scale.value * 100)}%`);

/**
 * 限制缩放边界并保留两位小数
 * @param {number} v - 目标缩放比例
 * @returns {void}
 */
const setScale = (v: number): void => {
  scale.value = Math.min(4, Math.max(0.5, Math.round(v * 100) / 100));
};

/** 放大一档 */
const zoomIn = (): void => setScale(scale.value + 0.25);

/** 缩小一档 */
const zoomOut = (): void => setScale(scale.value - 0.25);

/** 重置为 1:1 原始像素尺寸 */
const resetZoom = (): void => setScale(1);

/**
 * 适应窗口：让整张图刚好放进滚动容器（可能放大也可能缩小）
 * @returns {void}
 */
const fitToStage = (): void => {
  const el = stageRef.value;
  if (!el) return;
  const available = Math.max(200, el.clientWidth - 24);
  setScale(available / natural.value.w);
};

/** 每次打开时回到 1:1，避免沿用上次的缩放比例 */
watch(visibleModel, (v) => {
  if (v) scale.value = 1;
});
</script>

<style scoped>
.mermaid-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mermaid-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.mermaid-preview__scale {
  min-width: 48px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.mermaid-preview__stage {
  overflow: auto;
  max-height: 70vh;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
}

.mermaid-preview__canvas {
  margin: 0 auto;
}

/* svg 填满显式尺寸的画布；viewBox 保证矢量内容按比例缩放，不失真 */
.mermaid-preview__svg :deep(svg) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
}
</style>
