<template>
  <div
    v-if="anchors.length >= minCount && !disabled"
    class="page-anchor"
    :class="{ 'page-anchor--expanded': expanded }"
    @mouseenter="onHover(true)"
    @mouseleave="onHover(false)"
  >
    <!-- 锚点列表（展开后显示） -->
    <transition name="page-anchor-list-fade">
      <ul v-show="expanded" class="page-anchor-list">
        <li
          v-for="(item, idx) in anchors"
          :key="item.id"
          class="page-anchor-list__item"
          :class="{ 'page-anchor-list__item--active': activeIndex === idx }"
          :title="item.label"
          @click="scrollTo(item)"
        >
          <span class="page-anchor-list__dot" />
          <span class="page-anchor-list__label">{{ item.label }}</span>
        </li>
      </ul>
    </transition>

    <!-- 触发按钮 -->
    <t-button
      variant="text"
      class="app-floating-btn"
      shape="circle"
      :title="t.common.pageAnchor"
      :aria-label="t.common.pageAnchor"
      @click="toggle"
    >
      <template #icon><t-icon :name="expanded ? 'close' : 'view-list'" /></template>
    </t-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import type { Locale } from '@/types/locale';

interface AnchorItem {
  /** 锚点目标 DOM 节点 */
  el: HTMLElement;
  /** 锚点 id（按顺序生成） */
  id: string;
  /** 锚点显示文案（来自 .card-title 文本） */
  label: string;
}

const props = withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 滚动容器选择器，默认应用主滚动区 .page-content */
  containerSelector?: string;
  /** 锚点目标选择器（在当前 page-layout 范围内查询） */
  itemSelector?: string;
  /** 锚点标题选择器（在锚点目标内查询，取 textContent 作为 label） */
  labelSelector?: string;
  /** 至少多少个锚点才显示组件，少于此数自动隐藏 */
  minCount?: number;
  /** 触发显示按钮的滚动距离阈值（px），低于此值收起按钮列表 */
  threshold?: number;
  /** 滚动定位时的顶部偏移（px），避免被吸顶元素挡住 */
  offsetTop?: number;
  /** 是否禁用（例如某个页面不需要） */
  disabled?: boolean;
}>(), {
  containerSelector: '.page-content',
  itemSelector: '.card-panel',
  labelSelector: '.card-title',
  minCount: 2,
  threshold: 0,
  offsetTop: 16,
  disabled: false,
});

const expanded = ref(false);
const anchors = ref<AnchorItem[]>([]);
const activeIndex = ref(0);
const isMobile = ref(false);

let scrollContainer: HTMLElement | null = null;
let rootEl: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let scrollRaf = 0;

/** 把任意文本转成稳定的 anchor id 片段 */
const slugify = (raw: string, fallback: number): string => {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '');
  return cleaned !== '' ? cleaned : `section-${fallback}`;
};

/** 重新扫描页面中的锚点目标 */
const collectAnchors = (): void => {
  if (!rootEl) {
    return;
  }
  // 当前可见 page-layout 若标记了 data-no-anchor，则视为本页禁用，直接清空
  if (rootEl.querySelector('[data-no-anchor]') !== null) {
    anchors.value = [];
    return;
  }
  const nodes = Array.from(rootEl.querySelectorAll<HTMLElement>(props.itemSelector));
  const list: AnchorItem[] = [];
  nodes.forEach((node, idx) => {
    const labelEl = node.querySelector<HTMLElement>(props.labelSelector);
    const label = labelEl?.textContent?.trim() ?? '';
    if (label === '') {
      return;
    }
    const id = `anchor-${slugify(label, idx)}`;
    // 给目标节点写入 id（如已有则保留），便于浏览器哈希定位与无障碍
    if (node.id === '') {
      node.id = id;
    }
    list.push({ el: node, id: node.id, label });
  });
  anchors.value = list;
  // 集合刷新后立即同步一次高亮
  updateActive();
};

/** 计算当前激活锚点：取最靠近容器顶部、且仍在容器顶部上方/齐平的元素 */
const updateActive = (): void => {
  if (!scrollContainer || anchors.value.length === 0) {
    return;
  }
  const containerTop = scrollContainer.getBoundingClientRect().top + props.offsetTop;
  let nextIdx = 0;
  for (let i = 0; i < anchors.value.length; i += 1) {
    const rect = anchors.value[i].el.getBoundingClientRect();
    if (rect.top - containerTop <= 1) {
      nextIdx = i;
    } else {
      break;
    }
  }
  activeIndex.value = nextIdx;
};

/** 平滑滚动到指定锚点 */
const scrollTo = (item: AnchorItem): void => {
  if (!scrollContainer) {
    return;
  }
  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = item.el.getBoundingClientRect();
  const top = scrollContainer.scrollTop + (targetRect.top - containerRect.top) - props.offsetTop;
  scrollContainer.scrollTo({ top, behavior: 'smooth' });
  // 移动端点击后自动收起，避免遮挡内容
  if (isMobile.value) {
    expanded.value = false;
  }
};

const toggle = (): void => {
  expanded.value = !expanded.value;
};

const onHover = (hover: boolean): void => {
  // 移动端不响应 hover，避免触摸时误展开
  if (isMobile.value) {
    return;
  }
  expanded.value = hover;
};

const handleScroll = (): void => {
  if (scrollRaf !== 0) {
    return;
  }
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = 0;
    updateActive();
  });
};

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= 768;
};

onMounted(async () => {
  rootEl = document.querySelector<HTMLElement>(props.containerSelector);
  scrollContainer = rootEl;
  handleResize();
  window.addEventListener('resize', handleResize);

  if (!scrollContainer || !rootEl) {
    return;
  }
  scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

  // 等待初次渲染稳定后再扫描，避免拿不到 .card-panel
  await nextTick();
  collectAnchors();

  // 监听内容变化（路由切换、卡片动态增减）
  observer = new MutationObserver(() => {
    collectAnchors();
  });
  observer.observe(rootEl, { childList: true, subtree: true });
});

onBeforeUnmount(() => {
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll);
  }
  window.removeEventListener('resize', handleResize);
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (scrollRaf !== 0) {
    window.cancelAnimationFrame(scrollRaf);
  }
  scrollContainer = null;
  rootEl = null;
});
</script>
