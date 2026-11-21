<template>
  <div class="msg" :class="[`msg--${m.role}`, { 'msg--turn-start': turnStart }]">
    <!-- 头像：文字 + 品牌色，比 t-icon 更具辨识度 -->
    <div class="msg__avatar" :title="avatarTitle">{{ avatarText }}</div>

    <div class="msg__body">
      <!-- 仅 AI 流式时展示「思考中」提示 + 气泡内停止按钮，方便用户上滑回看时也能就近终止 -->
      <div v-if="m.role === ChatRole.Assistant && m.streaming" class="msg__streaming">
        <t-icon name="loading" />
        <span>{{ t.aiChat.thinking }}</span>
        <t-button
          variant="text"
          size="small"
          class="msg__streaming-stop"
          :title="t.aiChat.stop"
          :aria-label="t.aiChat.stop"
          @click="onStop"
        >
          <template #icon><t-icon name="stop-circle" /></template>
          <span>{{ t.aiChat.stop }}</span>
        </t-button>
      </div>

      <!-- 过程提示（模型限流重试等，后端 notice 事件） -->
      <div v-if="m.notices && m.notices.length > 0" class="msg__notices">
        <div v-for="(notice, i) in m.notices" :key="i" class="msg__notice">
          <t-icon name="info-circle" />
          <span>{{ notice }}</span>
        </div>
      </div>

      <!-- 模型思考过程（仅模型返回 reasoning_content / thinking 等字段时有内容） -->
      <chat-reasoning-card
        v-if="m.reasoning"
        class="msg__reasoning"
        :reasoning="m.reasoning"
        :streaming="m.streaming"
        :t="t"
      />

      <!-- L3 执行计划 + 自我反思（仅 assistant 且开启规划模式时下发） -->
      <chat-plan-card
        v-if="m.plan"
        class="msg__plan"
        :plan="m.plan"
        :reflections="m.reflections"
        :t="t"
      />

      <!-- 工具调用块：多个调用默认折叠为一行，避免连续工具卡铺满屏幕 -->
      <div v-if="m.tool_calls.length > 0" class="msg__tools">
        <chat-tool-call-group
          v-if="m.tool_calls.length > 1"
          :tool-calls="m.tool_calls"
          :t="t"
        />
        <chat-tool-call-card
          v-else
          :tc="m.tool_calls[0]"
          :t="t"
        />
      </div>

      <!--
        随消息一起发送的图片：用户消息可能在正文前带若干张图，
        复用通用 ImagePreviewer 渲染缩略图并支持点击全屏预览
      -->
      <div v-if="m.images && m.images.length > 0" class="msg__images">
        <image-previewer
          v-for="(src, i) in m.images"
          :key="i"
          :src="src"
          :alt="`${t.aiChat.attachedImage} ${i + 1}`"
          :max-height="160"
          :hover-text="t.aiChat.previewImage"
          class="msg__image"
        />
      </div>

      <!-- 文本内容（Markdown 渲染） -->
      <!--
        说明：Markdown 中的 ![alt](url) 由 marked 渲染为占位 <span class="md-image-placeholder">，
        在 onMounted / 内容变化时再用 createApp 把每个占位替换成 <ImagePreviewer>，
        以便复用与技能卡片一致的弹窗预览能力。
      -->
      <!-- eslint-disable vue/no-v-html -- 内容经 renderChatMarkdown 渲染并已由 DOMPurify 净化 -->
      <div
        v-if="renderedContent"
        ref="contentRef"
        class="msg__content markdown-body"
        @click="onContentClick"
        v-html="renderedContent"
      />
      <!-- eslint-enable vue/no-v-html -->
      <div v-else-if="m.streaming && m.tool_calls.length === 0" class="msg__placeholder">
        <span class="msg__cursor">▍</span>
      </div>

      <!--
        动作按钮 + token 用量：左右布局
      -->
      <div
        v-if="footerVisible"
        class="msg__footer"
      >
        <!-- 左侧：动作按钮 -->
        <div v-if="showAssistantActions || showUserActions" class="msg__actions">
          <t-button
            variant="text"
            class="app-icon-btn"
            :title="copied ? t.aiChat.copySuccess : t.aiChat.copy"
            :aria-label="t.aiChat.copy"
            @click="onCopy"
          >
            <t-icon :name="copied ? 'check' : 'file-copy'" />
          </t-button>
          <template v-if="showAssistantActions">
            <t-button
              variant="text"
              class="app-icon-btn"
              :title="t.aiChat.regenerate"
              :aria-label="t.aiChat.regenerate"
              @click="onRegenerate"
            >
              <t-icon name="refresh" />
            </t-button>
            <!-- 从此处分支：复制本条及之前对话到新会话，用于换个问法重试 -->
            <t-button
              v-if="canFork"
              variant="text"
              class="app-icon-btn"
              :title="t.aiChat.fork"
              :aria-label="t.aiChat.fork"
              @click="onFork"
            >
              <t-icon name="fork" />
            </t-button>
          </template>
        </div>

        <!--
          右侧：token 用量紧凑显示
        -->
        <t-tooltip v-if="m.usage" :content="usageDetailText" placement="top">
          <div class="msg__usage" :aria-label="usageDetailText">
            <span class="msg__usage-arrow" aria-hidden="true">↑</span>
            <span>{{ formatSize(m.usage.prompt_tokens) }}</span>
            <span class="msg__usage-arrow" aria-hidden="true">↓</span>
            <span>{{ formatSize(m.usage.completion_tokens) }}</span>
          </div>
        </t-tooltip>
      </div>
    </div>
  </div>

  <!-- Mermaid 图表放大预览：点击气泡内图表后以原始尺寸 + 缩放方式查看 -->
  <mermaid-preview-dialog
    v-model:visible="mermaidPreviewVisible"
    :svg="mermaidPreviewSvg"
    :t="t"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount, createApp, getCurrentInstance, h } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAuthStore } from '@/stores/auth';
import ChatToolCallCard from './chat-tool-call-card.vue';
import ChatToolCallGroup from './chat-tool-call-group.vue';
import ChatPlanCard from './chat-plan-card.vue';
import ChatReasoningCard from './chat-reasoning-card.vue';
import ImagePreviewer from '@/components/common/image-previewer.vue';
import MermaidPreviewDialog from './mermaid-preview-dialog.vue';
import type { UiMessage } from '@/types/ai-chat';
import { ChatRole } from '@/types/ai-chat';
import type { Locale } from '@/locales/zh';
import { INTERNAL_LINK_ATTR } from '@/constants/ai-chat';
import { formatSize } from '@/utils/format/common.ts';
import {
  renderChatMarkdown,
  IMAGE_PLACEHOLDER_CLASS,
  MERMAID_PLACEHOLDER_CLASS,
} from '@/utils/ai-chat';

const props = defineProps<{
  /** UI 消息对象 */
  m: UiMessage;
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 当前消息是否处于「已复制」反馈态（由 model.isCopied(m.id) 计算得出） */
  copied: boolean;
  /** 是否为新一轮对话的开端（紧贴一条用户消息或与上一条间隔较大）*/
  turnStart?: boolean;
  /** 是否展示「从此处分支」按钮（会话已落盘时为 true） */
  canFork?: boolean;
}>();

/**
 * 组件事件：复制 / 重生 / 分支 / 停止生成
 */
const emit = defineEmits<{
  /** 点击「复制」：携带当前消息 id，由父组件调用 model.copyMessage */
  (e: 'copy', id: string): void;
  /** 点击「重新回答」：携带当前 assistant 消息 id，由父组件调用 model.regenerateAnswer */
  (e: 'regenerate', id: string): void;
  /** 点击「从此处分支」：携带当前 assistant 消息 id，由父组件调用 model.forkConversation */
  (e: 'fork', id: string): void;
  /** 点击气泡内「停止生成」：仅在 AI 流式中显示，等同于输入区的停止按钮 */
  (e: 'stop'): void;
  /** 点击正文里的站内路由链接：携带目标路径，由父组件收起抽屉等 */
  (e: 'navigate', path: string): void;
}>();

const authStore = useAuthStore();

/**
 * 路由实例（站内链接跳转用）
 * @description 走 router.push 而不是浏览器默认跳转，避免整页刷新丢掉会话上下文
 */
const router = useRouter();

/**
 * 前端路由表里可直达的站内路径
 * @type {import('vue').ComputedRef<string[]>}
 * @description 来源唯一（vue-router 自身），不另维护一份页面清单；
 *   传给 renderChatMarkdown 用于把回答里的裸路由（"去 /approvals 页"）补成可点击链接
 */
const internalPaths = computed<string[]>(() =>
  router.getRoutes()
    .map((r) => r.path)
    .filter((p) => p.startsWith('/') && p.length > 1 && !p.includes(':')));

/**
 * 渲染后的 HTML 内容（用于 v-html）
 * @description 仅在文本内容非空时才渲染，避免空消息占位
 */
const renderedContent = computed(() => {
  const text = props.m.content;
  if (!text || typeof text !== 'string') return '';
  return renderChatMarkdown(text, internalPaths.value);
});

/** 气泡内渲染完成的 mermaid 块 class（用于事件委托识别点击目标） */
const MERMAID_BLOCK_CLASS = 'msg__mermaid';

/** 放大预览对话框显示状态 */
const mermaidPreviewVisible = ref(false);

/** 当前要预览的 mermaid svg HTML（点击时从气泡节点提取） */
const mermaidPreviewSvg = ref('');

/**
 * 正文点击：mermaid 图表放大预览 / 站内路由链接改走 vue-router，外链维持浏览器默认（新标签打开）
 * @param {MouseEvent} e - 点击事件
 * @returns {void}
 * @description 点击 mermaid 图时提取其 SVG 交给预览对话框；链接目标不在路由表里时拦下并提示，避免跳到空白页
 */
const onContentClick = (e: MouseEvent): void => {
  const target = e.target as HTMLElement | null;

  // 点击 mermaid 图表：提取 svg 交给预览对话框放大展示
  const mermaidBlock = target?.closest?.(`.${MERMAID_BLOCK_CLASS}`) as HTMLElement | null;
  if (mermaidBlock) {
    const svg = mermaidBlock.querySelector('svg')?.outerHTML;
    if (svg) {
      mermaidPreviewSvg.value = svg;
      mermaidPreviewVisible.value = true;
    }
    return;
  }

  const link = target?.closest?.(`a[${INTERNAL_LINK_ATTR}]`) as HTMLAnchorElement | null;
  if (!link) return;
  const to = link.getAttribute('href') ?? '';
  if (!to.startsWith('/')) return;
  e.preventDefault();
  if (router.resolve(to).matched.length === 0) {
    MessagePlugin.warning(props.t.aiChat.pageLinkInvalid);
    return;
  }
  void router.push(to);
  emit('navigate', to);
};

// ============== 图片预览：把 markdown 占位 <span> 替换成 <ImagePreviewer> ==============

/** 气泡正文容器引用，用于查找占位节点 */
const contentRef = ref<HTMLDivElement | null>(null);
/**
 * 已挂载的 ImagePreviewer 子应用列表（卸载时统一销毁，避免内存泄漏）
 * @description 用普通数组而非 ref，因不需要在模板中响应式追踪
 */
const mountedApps: ReturnType<typeof createApp>[] = [];

/**
 * 当前组件实例，用于把主应用的 appContext（含全局组件 t-image-viewer / t-icon 等）
 * 复用到 createApp 出来的子应用，避免子应用因找不到全局组件而渲染为空。
 */
const currentInstance = getCurrentInstance();

/**
 * 销毁所有已挂载的 ImagePreviewer 子应用
 * @returns {void}
 * @description 每次内容更新或组件卸载时调用，防止累计挂载导致泄漏
 */
const unmountAllPreviewers = (): void => {
  for (const app of mountedApps) {
    try { app.unmount(); } catch { /* ignore */ }
  }
  mountedApps.length = 0;
};

/**
 * 把气泡内所有图片占位 <span> 替换成真实的 <ImagePreviewer> Vue 实例
 * @returns {void}
 * @description 占位由 chat-markdown.ts 的 image renderer 产出；
 *   每个占位独立 createApp + mount，并把主应用 appContext 中的全局组件/插件
 *   （如 TDesign 的 t-image-viewer、t-icon）复制过去，确保正常渲染
 */
const mountImagePreviewers = (): void => {
  const container = contentRef.value;
  if (!container) return;
  unmountAllPreviewers();
  const parentCtx = currentInstance?.appContext;
  const placeholders = container.querySelectorAll<HTMLElement>(`.${IMAGE_PLACEHOLDER_CLASS}`);
  placeholders.forEach((node) => {
    const src = node.dataset.src ?? '';
    if (!src) return;
    const alt = node.dataset.alt ?? '';
    // 给挂载节点准备一个独立 div 容器，避免 <span> 限制内部块级布局
    const slot = document.createElement('div');
    slot.className = 'msg__image-slot';
    node.replaceWith(slot);
    const app = createApp({
      render: () => h(ImagePreviewer, { src, alt, maxHeight: 240 }),
    });
    // 复用主应用上下文：全局组件 / 指令 / 插件 / provide 等
    if (parentCtx) {
      Object.assign(app._context.components, parentCtx.components);
      Object.assign(app._context.directives, parentCtx.directives);
      Object.assign(app._context.provides, parentCtx.provides);
    }
    app.mount(slot);
    mountedApps.push(app);
  });
};

/** mermaid 渲染失败提示条的 CSS 类名（组件逻辑与下方样式共用） */
const MERMAID_ERROR_CLASS = 'msg__mermaid-error';

/**
 * mermaid 渲染失败时降级：保留源码、显示提示条，并在控制台留下原因
 * @param {HTMLElement[]} nodes - 未成功渲染的占位节点
 * @param {string} reason - 失败原因（只写控制台，不展示给用户）
 * @param {unknown} [error] - 原始异常
 * @returns {void}
 * @description 失败节点移除占位 class 并打标记，避免同一节点被反复渲染或反复插入提示条；
 *   提示文案用 textContent 写入，不拼 innerHTML，防止把 AI 输出当 HTML 注入
 */
const markMermaidFailure = (nodes: HTMLElement[], reason: string, error?: unknown): void => {
  console.warn(`[mermaid] ${reason}`, error ?? '');
  nodes.forEach((node) => {
    if (node.dataset.mermaidFailed === '1') return;
    node.dataset.mermaidFailed = '1';
    node.classList.remove(MERMAID_PLACEHOLDER_CLASS);
    const notice = document.createElement('div');
    notice.className = MERMAID_ERROR_CLASS;
    notice.textContent = props.t.aiChat.mermaidRenderFailed;
    node.prepend(notice);
  });
};

/**
 * 把气泡内的 mermaid 代码块渲染成真实图形（SVG）
 * @returns {Promise<void>}
 * @description 仅在回答结束后执行一次：流式期间 markdown 随 delta 反复重渲染，
 *   中途调 mermaid.render 会产生大量无用计算并闪烁，故流式阶段保持源码展示。
 *   mermaid 走动态 import，没有 mermaid 块的对话完全不加载这块体积；
 *   图源码取自占位块内的 <code> 文本（data-* 属性会被 DOMPurify 剥离）；
 *   加载 / 初始化 / 渲染任一步失败都走 markMermaidFailure，不再静默只剩源码。
 */
const renderMermaidBlocks = async (): Promise<void> => {
  const container = contentRef.value;
  if (!container) return;
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(`.${MERMAID_PLACEHOLDER_CLASS}`),
  );
  if (nodes.length === 0) return;

  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'strict',
      fontFamily: 'Noto Sans CJK SC, sans-serif',
    });

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      // 从已渲染的 <code> 文本读取：DOMPurify 会剥离含 "-->" 的 data-* 属性，
      // 文本节点不受影响，也避免把 AI 输出重复塞进属性
      const code = node.querySelector('code')?.textContent ?? '';
      if (!code.trim()) {
        markMermaidFailure([node], '占位块内没有图源码', node.outerHTML.slice(0, 200));
        continue;
      }
      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}-${i}`, code);
        const wrap = document.createElement('div');
        wrap.className = MERMAID_BLOCK_CLASS;
        wrap.title = props.t.aiChat.mermaidZoomHint;
        wrap.innerHTML = svg;
        node.replaceWith(wrap);
      } catch (error) {
        markMermaidFailure([node], `第 ${i + 1} 个图表渲染失败，已保留源码`, error);
      }
    }
  } catch (error) {
    // 动态 chunk 404 / 缓存了旧入口 / mermaid 初始化异常：整组降级
    markMermaidFailure(nodes, 'mermaid 模块加载或初始化失败，已保留源码', error);
  }
};

// 内容变化后下一帧重新挂载（v-html 更新是同步的，但 DOM 写入需要 nextTick）
watch([renderedContent, () => props.m.streaming], () => {
  nextTick(() => {
    mountImagePreviewers();
    // 流式结束后才渲染 mermaid，避免中途反复重算
    if (!props.m.streaming) void renderMermaidBlocks();
  });
}, { immediate: true, flush: 'post' });

onBeforeUnmount(unmountAllPreviewers);

/**
 * AI 消息是否展示「复制 / 重新回答」动作条
 * @description 仅 assistant、非流式中且存在文本内容时才展示
 */
const showAssistantActions = computed(() => {
  if (props.m.role !== ChatRole.Assistant) return false;
  if (props.m.streaming) return false;
  return Boolean(props.m.content && props.m.content.trim().length > 0);
});

/**
 * 用户消息是否展示「复制」按钮
 * @description 用户消息有非空文本时即可显示，配合 hover 揭示样式避免视觉抢戏
 */
const showUserActions = computed(() => {
  if (props.m.role !== ChatRole.User) return false;
  return Boolean(props.m.content && props.m.content.trim().length > 0);
});

/**
 * 决定 footer 容器是否渲染
 * @description 任意一组动作 / token 用量存在即渲染（用户消息没有 usage，仅按 actions 触发）
 */
const footerVisible = computed(() => {
  return showAssistantActions.value
    || showUserActions.value
    || (props.m.role === ChatRole.Assistant && Boolean(props.m.usage));
});

/**
 * 头像文本：AI 固定为 "J"（贾维斯品牌）；用户取邮箱首字符（大写），无邮箱则 "U"
 * @description 比 t-icon 更具辨识度；与卡片自带星星等装饰图标也不再视觉冲突
 */
const avatarText = computed((): string => {
  if (props.m.role === ChatRole.Assistant) return 'J';
  const email = authStore.email ?? '';
  const first = email.trim().charAt(0).toUpperCase();
  return first || 'U';
});

/**
 * 头像 hover 提示：AI 显示助手称谓，用户显示邮箱（如有）
 */
const avatarTitle = computed((): string => {
  if (props.m.role === ChatRole.Assistant) return props.t.aiChat.roleAssistant;
  return authStore.email || props.t.aiChat.roleUser;
});

/**
 * Tooltip 中显示的完整 token 用量明细
 * @description 沿用 i18n 文案，多语言无碍
 */
const usageDetailText = computed((): string => {
  const u = props.m.usage;
  if (!u) return '';
  const tt = props.t.aiChat;
  const fmt = (n?: number): string => Number(n ?? 0).toLocaleString();
  return `${tt.tokensLabel} · ${tt.tokensPrompt} ${fmt(u.prompt_tokens)} / ${tt.tokensCompletion} ${fmt(u.completion_tokens)} / ${tt.tokensTotal} ${fmt(u.total_tokens)}`;
});

/**
 * 点击「复制」：仅向上传递事件，复制与反馈逻辑由 model 统一处理
 * @returns {void}
 */
const onCopy = (): void => {
  emit('copy', props.m.id);
};

/**
 * 点击「重新回答」：仅向上传递事件，重发逻辑由 model 统一处理
 * @returns {void}
 */
const onRegenerate = (): void => {
  emit('regenerate', props.m.id);
};

/**
 * 点击「从此处分支」：仅向上传递事件，分支与切换逻辑由 model 统一处理
 * @returns {void}
 */
const onFork = (): void => {
  emit('fork', props.m.id);
};

/**
 * 点击气泡内「停止生成」：向父组件抛事件，由父组件转交给 model.stopStreaming
 * @returns {void}
 */
const onStop = (): void => {
  emit('stop');
};
</script>

<style scoped>
@import "@/styles/common.css";

/* ===== 随消息发送的图片缩略图 ===== */
.msg__images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.msg__image {
  border-radius: 8px;
  overflow: hidden;
}

/* ===== 容器：默认左侧布局（AI），用户消息整体翻转到右侧 ===== */
.msg {
  display: flex;
  gap: 10px;
  padding: 4px 4px;
  align-items: flex-start;
}

/* 用户消息整体右对齐：头像放到右边，气泡靠右 */
.msg--user {
  flex-direction: row-reverse;
}

/* 轮次开头：添加分隔线 */
.msg--turn-start {
  margin-top: 18px;
  position: relative;
}

/* 轮次开头：添加分隔线 */
.msg--turn-start::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent 0%,
    var(--border-color) 50%,
    transparent 100%
  );
  opacity: 0.5;
  pointer-events: none;
}

/* ===== 头像：文字头像，比 t-icon 更具产品辨识度 ===== */
.msg__avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  user-select: none;
}

.msg--user .msg__avatar {
  background: var(--accent-primary, #0052d9);
  color: #fff;
}

.msg--assistant .msg__avatar {
  background: var(--accent-green, #00a870);
  color: #fff;
}

/* ===== 消息主体：限制最大宽度避免一行铺满，气泡侧贴近头像 ===== */
.msg__body {
  display: flex;
  flex-direction: column;
  max-width: 78%;
  min-width: 0;
}

/* 用户消息体：内部内容右对齐 */
.msg--user .msg__body {
  align-items: flex-end;
}


.msg--assistant .msg__body {
  align-items: flex-start;
  width: fit-content;
  max-width: 100%;
}

/*
  AI 文本气泡：自然宽度，最长不超过气泡侧 max-width
  关键：去掉旧的 width: 100%（在 .msg--assistant .msg__content 里），改成 auto
*/
.msg--assistant .msg__content,
.msg--assistant .msg__placeholder {
  width: auto;
  max-width: 100%;
}

/* ===== 流式"思考中"提示 + 气泡内停止按钮 ===== */
.msg__streaming {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  margin-bottom: 4px;
}

.msg__streaming-stop {
  margin-left: 4px;
  --td-comp-paddingLR-s: 6px;
  --td-comp-paddingTB-s: 0;
}

/* ===== 过程提示（限流重试等，位于计划卡片之上） ===== */
.msg__notices {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
}

.msg__notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

/* ===== 模型思考过程卡片（宽度策略与计划卡片一致） ===== */
.msg__reasoning {
  width: auto;
  margin-bottom: 6px;
}

/* ===== L3 执行计划卡片（位于工具卡片之上，宽度策略一致） ===== */
.msg__plan {
  width: auto;
  margin-bottom: 6px;
}

/* ===== 工具调用块（保持垂直排列，宽度跟随气泡侧） ===== */
.msg__tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}

/* ===== 文本气泡 ===== */
.msg__content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
  word-wrap: break-word;
  word-break: break-word;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-color);
}

/* 用户气泡：主题色背景，圆角凸出右上方向 */
.msg--user .msg__content {
  background: var(--accent-primary, #0052d9);
  color: #fff;
  border-color: transparent;
  border-top-right-radius: 4px;
}

/* AI 气泡：左上方向凸出 */
.msg--assistant .msg__content {
  border-top-left-radius: 4px;
}

/* 用户气泡内代码/链接的颜色反转（提高在主题色背景下可读性） */
.msg--user .msg__content :deep(code) {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  border-color: transparent;
}

.msg--user .msg__content :deep(pre) {
  background: rgba(0, 0, 0, 0.25);
  border-color: transparent;
}

.msg--user .msg__content :deep(a) {
  color: #fff;
  text-decoration: underline;
}

/* ===== 视频播放器 ===== */
.msg__content :deep(.msg__video) {
  width: 100%;
  max-width: 360px;
  border-radius: 8px;
  margin: 8px 0;
  background: #000;
  display: block;
}

/* 聊天气泡内图片预览容器：限制最大宽度并与正文留出间距 */
.msg__content :deep(.msg__image-slot) {
  display: block;
  max-width: 320px;
  margin: 6px 0;
}

/* 兼容：若历史消息仍有原生 <img>（如 v-html 中其它来源），保留基础约束 */
.msg__content :deep(img) {
  max-width: 320px;
  border-radius: 8px;
}

/* ===== 流式光标占位 ===== */
.msg__placeholder {
  font-size: 14px;
  color: var(--text-muted);
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-color);
  border-top-left-radius: 4px;
}


.msg__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  flex-wrap: wrap;
  width: 100%;
}

.msg--user .msg__footer {
  justify-content: flex-end;
}

.msg__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}


.msg__usage {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted, #999);
  font-variant-numeric: tabular-nums;
  cursor: default;
  user-select: none;
}

.msg__usage-arrow {
  color: var(--text-muted);
  font-weight: 600;
  /* 让 ↑↓ 两个箭头不会因字体差异跳动 */
  display: inline-block;
  width: 10px;
  text-align: center;
}

.msg__cursor {
  display: inline-block;
  animation: blink 1s infinite;
  color: var(--accent-primary);
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* ===== 移动端：放宽气泡最大宽度，让长内容可读 ===== */
@media (max-width: 768px) {
  .msg__body {
    max-width: 86%;
  }
}

/* ===== mermaid 图形（由 chat-markdown 的占位块渲染而来）===== */
.msg__content :deep(.msg__mermaid) {
  margin: 8px 0;
  padding: 10px 6px;
  overflow-x: auto;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: zoom-in;
  transition: border-color 0.2s ease;
}

.msg__content :deep(.msg__mermaid:hover) {
  border-color: var(--accent-primary, #0052d9);
}

.msg__content :deep(.msg__mermaid svg) {
  max-width: 100%;
  height: auto;
}

/* ===== mermaid 渲染失败提示（源码仍保留在下方代码块）===== */
.msg__content :deep(.msg__mermaid-error) {
  margin: 0 0 6px;
  padding: 6px 10px;
  color: #e0a458;
  font-size: 12px;
  text-align: left;
  background: rgba(224, 164, 88, 0.1);
  border: 1px solid rgba(224, 164, 88, 0.3);
  border-radius: 6px;
}
</style>
