<template>
  <!--
    欢迎页（v2 产品视角调整）
    -----------------------------------------------------------------
    设计目标：让"打开抽屉但没历史消息"的这一屏从「装饰页」升级为「能力速览 + 快速恢复入口」。

    四段式信息架构（从上到下）：
    1) Header（极简）：图标 + 标题 + 副标题，纵向占比收紧到 ~80px，把空间让给下面
    2) 能力卡片网格：把「日志/规则/寄语库/脚本/企微」等核心能力做成 2x3 卡片，
       既是产品介绍，也是快捷入口（点击即发对应 prompt）
    3) 最近会话（仅当有历史时）：列出最近 2 条会话，给"打开抽屉就想接着上次聊"的用户
       一条最短路径——不需要再去 header 翻历史会话图标
    4) 状态提示行：底部一行 muted 灰字，告知 LLM 状态 + 工具数量，让用户对系统能力有感知

    交互协议：
    - select-example: 点击能力卡片，发送对应 prompt（与 chat-quick-examples 协议一致，复用父组件 sendExample）
    - select-conversation: 点击最近会话，恢复该会话（父组件接到后调用 selectConversation）
    -----------------------------------------------------------------
  -->
  <div class="ai-chat-welcome">
    <!-- ===== 1) Header（v3：极简 · 时段问候 · 状态前置） =====
         产品改动说明：
         - 去掉 ⭐ 大图标：抽屉顶部 header 已有"贾维斯"产品名，欢迎页不再做产品自我介绍
         - 主标题改为时段问候（早上好/下午好/晚上好…）：每次打开都有变化，避免变成噪音
         - 副标题改为「随时待命 · N 项能力 / M 个工具」事实陈述：与下方卡片网格职责互补，不再重复
         - 异常态：副标题降级为后端错误描述 + 红色高亮，吃掉原来的底部状态行
         整体 header 高度从 ~80px 收到 ~50px，把空间还给卡片网格 -->
    <header class="ai-chat-welcome__header" :class="{ 'is-error': !healthy }">
      <h3 class="ai-chat-welcome__title">{{ greetingText }}</h3>
      <p class="ai-chat-welcome__subtitle">
        <span class="ai-chat-welcome__subtitle-dot" aria-hidden="true" />
        {{ subtitleText }}
      </p>
    </header>

    <!-- ===== 2) 能力卡片网格 ===== -->
    <section class="ai-chat-welcome__section">
      <h4 class="ai-chat-welcome__section-title">{{ t.aiChat.welcomeCapabilitiesTitle }}</h4>
      <div class="ai-chat-welcome__grid">
        <button
          v-for="(cap, i) in t.aiChat.welcomeCapabilities"
          :key="i"
          type="button"
          class="ai-chat-welcome__card"
          :title="cap.prompt"
          @click="emit('select-example', cap.prompt)"
        >
          <t-icon :name="cap.icon" size="18px" class="ai-chat-welcome__card-icon" />
          <div class="ai-chat-welcome__card-text">
            <div class="ai-chat-welcome__card-title">{{ cap.title }}</div>
            <div class="ai-chat-welcome__card-desc">{{ cap.desc }}</div>
          </div>
        </button>
      </div>
    </section>

    <!-- ===== 3) 最近会话（仅当有历史） ===== -->
    <section v-if="recentConversations.length > 0" class="ai-chat-welcome__section">
      <h4 class="ai-chat-welcome__section-title">{{ t.aiChat.welcomeRecentTitle }}</h4>
      <div class="ai-chat-welcome__recent-list">
        <button
          v-for="c in recentConversations"
          :key="c.id"
          type="button"
          class="ai-chat-welcome__recent-item"
          :title="c.title"
          @click="emit('select-conversation', c.id)"
        >
          <t-icon name="chat" size="14px" class="ai-chat-welcome__recent-icon" />
          <span class="ai-chat-welcome__recent-title">{{ c.title }}</span>
          <span class="ai-chat-welcome__recent-meta">
            {{ c.message_count }}{{ t.aiChat.messagesUnit }}
            <span class="ai-chat-welcome__recent-dot">·</span>
            {{ formatRelative(c.updated_at) }}
          </span>
        </button>
      </div>
    </section>

    <!-- ===== 状态行 已合并到 header 副标题 =====
         底部不再单独保留"● 已就绪"行——避免与 header 出现两个绿色状态点。
         异常时 header 会切到 is-error 态，显示后端错误描述。 -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Locale } from '@/types/locale';
import type { ChatConversationSummary } from '@/types/ai-chat';
import { formatWelcomeRelativeTime } from '@/utils/ai-chat';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 会话摘要列表，用于渲染"最近会话"区块 */
  conversations: ChatConversationSummary[];
  /** LLM 健康状态：用于渲染底部状态行 */
  health: { healthy: boolean; message: string } | null;
  /** 可用工具数量：用于状态行展示 */
  toolsCount: number;
}>();

const emit = defineEmits<{
  /** 点击能力卡片：发送对应 prompt（父组件复用 sendExample 处理） */
  (e: 'select-example', text: string): void;
  /** 点击最近会话：恢复对话（父组件调用 selectConversation） */
  (e: 'select-conversation', id: string): void;
}>();

/**
 * 最近会话裁剪到 2 条
 * @description 卡片栅格已经占用主要空间，这里只露最近 2 条作为"快速接续"入口；
 *              想看全部走 header 历史会话按钮，避免欢迎页变成第二个会话列表
 */
const recentConversations = computed<ChatConversationSummary[]>(() => {
  return props.conversations.slice(0, 2);
});

/** LLM 是否就绪（health 未拉到时给"乐观"默认值，避免闪一下红） */
const healthy = computed<boolean>(() => props.health?.healthy !== false);

/**
 * 主标题：时段问候
 * @description 根据当前时间返回不同的问候语
 */
const greetingText = computed<string>(() => {
  const aiChat = props.t.aiChat;
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return aiChat.welcomeGreetingMorning;
  if (h >= 11 && h < 14) return aiChat.welcomeGreetingNoon;
  if (h >= 14 && h < 18) return aiChat.welcomeGreetingAfternoon;
  if (h >= 18 && h < 23) return aiChat.welcomeGreetingEvening;
  return aiChat.welcomeGreetingLateNight;
});

/**
 * 副标题：状态描述
 * @description 异常时显示后端错误描述，否则显示"就绪" + 工具数量
 */
const subtitleText = computed<string>(() => {
  const aiChat = props.t.aiChat;
  if (!healthy.value) {
    return props.health?.message || aiChat.welcomeStatusError;
  }
  const capN = String(aiChat.welcomeCapabilities.length);
  if (props.toolsCount > 0) {
    return aiChat.welcomeSubtitleReady
      .replace('{capabilities}', capN)
      .replace('{tools}', String(props.toolsCount));
  }
  return aiChat.welcomeSubtitleReadyNoTools.replace('{capabilities}', capN);
});

/**
 * 渲染最近会话条目所需的相对时间
 * @param {number} ts - 后端返回的时间戳（秒或毫秒）
 * @returns {string} 相对时间字符串；纯函数实现见 utils/ai-chat/formatWelcomeRelativeTime
 */
const formatRelative = (ts: number): string => {
  const aiChat = props.t.aiChat;
  return formatWelcomeRelativeTime(ts, {
    welcomeRelativeJustNow: aiChat.welcomeRelativeJustNow,
    welcomeRelativeMinutes: aiChat.welcomeRelativeMinutes,
    welcomeRelativeHours: aiChat.welcomeRelativeHours,
    welcomeRelativeDays: aiChat.welcomeRelativeDays,
  });
};
</script>

<style scoped>
/*
  ============================================================
  整体容器
  - 不再 align-items: center 全屏居中（原版那种"居中显示一句欢迎"的浪费布局）
  - 改为顶部对齐 + 限定最大宽度，让卡片网格自然左对齐到内容区
  ============================================================
*/
.ai-chat-welcome {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 16px 12px;
  max-width: 720px;
  margin: 0 auto;
}

/* ============================================================
   1) Header（v3）：极简问候 + 状态前置
   - 去图标：抽屉顶部 header 已有产品名，欢迎页不再自我介绍
   - 标题字号略放大（16→18）：作为"对话开场白"承担更多视觉重量
   - 副标题用 inline-flex + 内嵌小绿点：把原底部状态行的"已就绪"语义合并进来
   ============================================================ */
.ai-chat-welcome__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  /* 与图标版相比 gap 收紧；header 总高从 ~80px 收到 ~50px */
  gap: 4px;
  padding: 4px 0 0;
}

.ai-chat-welcome__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  /* 时段问候大概率是中文短句，不需要换行；超长时优雅截断 */
  max-width: 100%;
  line-height: 1.4;
}

.ai-chat-welcome__subtitle {
  /* 用 inline-flex 让小绿点与文案严格基线对齐 */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
  user-select: none;
}

/* 副标题前的小状态点（健康态：品牌绿带光晕） */
.ai-chat-welcome__subtitle-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-green);
  /* 微微的呼吸光晕，强化"就绪/活的"语义 */
  box-shadow: 0 0 0 2px rgba(var(--accent-green-rgb), 0.15);
  flex-shrink: 0;
}

/* 异常态：副标题切红 + 状态点切红，吃掉了原来底部状态行的角色 */
.ai-chat-welcome__header.is-error .ai-chat-welcome__subtitle {
  color: #ef4444;
}

.ai-chat-welcome__header.is-error .ai-chat-welcome__subtitle-dot {
  background: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
}

/* ============================================================
   节标题（"我可以帮你" / "继续上次对话"）
   - 12px 灰字 + 字间距，极轻量；与卡片之间 8px gap
   ============================================================ */
.ai-chat-welcome__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-chat-welcome__section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  margin: 0;
  letter-spacing: 0.2px;
  text-transform: none;
}

/* ============================================================
   2) 能力卡片网格
   - 默认 2 列，抽屉够宽时（≥520px）变 3 列
   - 每张卡：图标 + 标题 + 一行描述
   - 默认无边框，仅在 hover 时显出品牌色边
   ============================================================ */
.ai-chat-welcome__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

@media (min-width: 520px) {
  .ai-chat-welcome__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ai-chat-welcome__card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.05s ease;
  /* 让卡片之间高度对齐，描述较长的卡片不会撑高网格 */
  min-height: 56px;
}

.ai-chat-welcome__card:hover {
  background: rgba(var(--accent-green-rgb), 0.08);
  border-color: rgba(var(--accent-green-rgb), 0.3);
}

.ai-chat-welcome__card:hover .ai-chat-welcome__card-icon,
.ai-chat-welcome__card:hover .ai-chat-welcome__card-title {
  color: var(--accent-green);
}

.ai-chat-welcome__card:active {
  transform: translateY(1px);
}

.ai-chat-welcome__card:focus-visible {
  outline: 2px solid var(--accent-green);
  outline-offset: 1px;
}

.ai-chat-welcome__card-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  margin-top: 1px;
  transition: color 0.15s ease;
}

.ai-chat-welcome__card-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ai-chat-welcome__card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  transition: color 0.15s ease;
}

.ai-chat-welcome__card-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.3;
  /* 描述允许单行截断，避免不同长度文案破坏栅格 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   3) 最近会话列表
   - 左对齐，单行：[图标] [标题（截断）] [元信息]
   - hover 高亮，给"接着上次聊"一条最短路径
   ============================================================ */
.ai-chat-welcome__recent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-chat-welcome__recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
  text-align: left;
  width: 100%;
}

.ai-chat-welcome__recent-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.ai-chat-welcome__recent-item:focus-visible {
  outline: 2px solid var(--accent-green);
  outline-offset: 1px;
}

.ai-chat-welcome__recent-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.ai-chat-welcome__recent-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-welcome__recent-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ai-chat-welcome__recent-dot {
  opacity: 0.6;
}
</style>
