<template>
  <!--
    通用图片预览组件
    - 默认展示为固定尺寸缩略图，鼠标悬浮时显示半透明遮罩 + 预览提示
    - 点击任意位置（图片或遮罩）调用 t-image-viewer 打开全屏大图预览
    - 可通过 alwaysShowMask 让遮罩常亮显示（不依赖 hover）
    - 样式与交互细节均内聚于此，业务方只需传 src/alt/hoverText 等基础属性
  -->
  <t-image-viewer
    :images="[src]"
    class="image-previewer"
  >
    <template #trigger="{ open }">
      <div
        class="image-previewer__thumb"
        :class="{ 'image-previewer__thumb--always-mask': alwaysShowMask }"
        :style="containerStyle"
        @click="open"
      >
        <img
          :src="src"
          :alt="alt"
          class="image-previewer__img"
          :style="imageStyle"
        />
        <div class="image-previewer__hover">
          <span class="image-previewer__hover-inner">
            <t-icon name="browse" size="18px" />
            {{ hoverText }}
          </span>
        </div>
      </div>
    </template>
  </t-image-viewer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{


  /** 图片 URL */
  src: string;
  /** 图片 alt 文本，便于无障碍与加载失败降级 */
  alt?: string;
  /** 容器/图片最大高度（纯数字视为 px，也支持任意合法 CSS 长度） */
  maxHeight?: string | number;
  /** 悬浮遮罩上的提示文字（支持业务侧国际化） */
  hoverText?: string;
  /** 图片缩放模式，对应 object-fit */
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** 容器圆角 */
  radius?: string;
  /** 是否常亮显示遮罩（默认仅 hover 时显示） */
  alwaysShowMask?: boolean;
}>(), {
  /** TODO: alt 描述 */
  alt: '',
  /** TODO: maxHeight 描述 */
  maxHeight: '100%',
  /** TODO: hoverText 描述 */
  hoverText: '预览',
  /** TODO: fit 描述 */
  fit: 'contain',
  /** TODO: radius 描述 */
  radius: '16px',
  /** TODO: alwaysShowMask 描述 */
  alwaysShowMask: false,


});
/** 将 number 统一转为 px，string 原样透传 */
const toCssLength = (v: string | number): string => {
  return typeof v === 'number' ? `${v}px` : v;
};

const containerStyle = computed(() => ({
  maxHeight: toCssLength(props.maxHeight),
  borderRadius: props.radius,
}));

const imageStyle = computed(() => ({
  maxHeight: toCssLength(props.maxHeight),
  objectFit: props.fit,
}));
</script>

<style scoped>
.image-previewer {
  display: block;
  width: 100%;
}

.image-previewer__thumb {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  background: var(--input-bg, rgba(0, 0, 0, 0.03));
  cursor: zoom-in;
}

.image-previewer__img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

/* 悬浮遮罩：默认透明，hover 时淡入 */
.image-previewer__hover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.image-previewer__thumb:hover .image-previewer__hover {
  opacity: 1;
}

/* 常亮模式：遮罩默认就显示，不依赖 hover */
.image-previewer__thumb--always-mask .image-previewer__hover {
  opacity: 1;
}

.image-previewer__hover-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
</style>
