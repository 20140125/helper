<template>
  <div class="watermark-container" :style="containerStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import { formatServerTime } from '@/utils/format';

const props = withDefaults(defineProps<{
  /** 水印文本（一般为用户邮箱或姓名） */
  text: string;
  /** 透明度（0–1），默认 0.08 */
  opacity?: number;
  /** 字号（px），默认 16 */
  fontSize?: number;
  /** 旋转角度（度），默认 -22 */
  rotate?: number;
  /** 平铺间距（px），默认 120 */
  gap?: number;
}>(), {
  /** TODO: opacity 描述 */
  opacity: 0.08,
  /** TODO: fontSize 描述 */
  fontSize: 14,
  /** TODO: rotate 描述 */
  rotate: -25,
  /** TODO: gap 描述 */
  gap: 20,
});

const themeStore = useThemeStore();

// 判断当前是否为亮色主题
const isLightTheme = computed(() => {
  const id = themeStore.currentTheme;
  if (id === 'light' || id === 'eye-care-light') return true;
  if (id === 'custom') return themeStore.customColor.isLight;
  return false;
});

const containerStyle = computed(() => {
  const canvas = document.createElement('canvas');
  const size = props.gap * 2 + props.fontSize * props.text.length * 0.6;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return {};

  // 亮色主题用黑色水印，暗色主题用白色水印
  const color = isLightTheme.value ? '0, 0, 0' : '255, 255, 255';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((props.rotate * Math.PI) / 180);
  ctx.font = `italic ${props.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = `rgba(${color}, ${props.opacity})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(props.text, 0, 0);
  ctx.fillText(formatServerTime(Number(new Date().getTime())), 15, 40);
  ctx.restore();

  return {
    position: 'fixed' as const,
    inset: '0',
    pointerEvents: 'none' as const,
    zIndex: '9999',
    backgroundImage: `url(${canvas.toDataURL()})`,
    backgroundRepeat: 'repeat',
    backgroundSize: `${size}px ${size}px`,
  };
});
</script>
