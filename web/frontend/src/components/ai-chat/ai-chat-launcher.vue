<template>
  <!-- 没有权限时整体不渲染 -->
  <template v-if="hasPermission">
    <!-- 触发按钮：右下角悬浮，位于 back-to-top 上方 -->
    <chat-trigger-button
      :title="t.aiChat.triggerTitle"
      :streaming="streaming"
      @click="openDrawer"
    />

    <!-- 抽屉容器（复用项目通用 form-drawer 封装：readonly + cancelBtn=null 隐藏底部按钮，showHeaderClose=false 隐藏默认右上角关闭按钮，改由自定义 header 提供） -->
    <form-drawer
      v-model="visible"
      :t="t"
      :is-mobile="isMobile"
      :header="t.aiChat.title"
      :style="skinStore.skinStyle"
      readonly
      :cancel-btn="null"
      class="ai-chat-drawer"
      @close="closeDrawer"
    >
      <!-- 自定义 header：左侧标题 + 右侧五个图标按钮（新建会话 / 历史会话 / 皮肤 / 分享 / 关闭） -->
      <template #header>
        <chat-drawer-header
          :t="t"
          :conversations="conversations"
          :current-conversation-id="currentConversationId"
          @new="createNewConversation"
          @share="share"
          @close="closeDrawer"
          @select="selectConversation"
          @remove="removeConversation"
        />
      </template>

      <!-- 抽屉主体：状态提示 + 消息流 + 输入区 -->
      <div class="ai-chat-body">
        <!-- 配置缺失警告 -->
        <t-alert
          v-if="health && !health.healthy"
          theme="warning"
          :message="t.aiChat.configMissing"
          :description="health.message"
          class="ai-chat-alert"
        />

        <!-- 消息流（外层包裹一层 position:relative，便于悬浮按钮定位） -->
        <div class="ai-chat-messages-wrap">
          <div ref="scrollContainer" class="ai-chat-messages">
            <chat-welcome-panel
              v-if="uiMessages.length === 0"
              :t="t"
              :conversations="conversations"
              :health="health"
              :tools-count="availableTools.length"
              @select-example="sendExample"
              @select-conversation="selectConversation"
            />

            <!--
              消息列表：使用模板循环 + 时间分组分隔条
              -----------------------------------------------------------------
              renderItems 把 uiMessages 加工为 [{ type:'separator', label }, { type:'msg', m, turnStart }, ...]
              结构，让长会话呈现 IM 经典视觉：
                · 跨 5 分钟 + 回合切换：在两条之间插入「居中分隔条」（"今天 14:30" / "5 月 20 日 15:42"），
                  整个会话只靠这一处时间锚点，气泡本身不再渲染任何时间戳，避免字面冗余
                · 用户消息上方拉开 18px 间距 + 渐变细线，形成"新一轮对话"的回合感
              -----------------------------------------------------------------
            -->
            <template v-for="item in renderItems" :key="item.key">
              <div v-if="item.type === 'separator'" class="ai-chat-time-separator">
                <span>{{ item.label }}</span>
              </div>
              <chat-message-bubble
                v-else
                :m="item.m"
                :t="t"
                :copied="isCopied(item.m.id)"
                :turn-start="item.turnStart"
                :can-fork="Boolean(currentConversationId)"
                @copy="copyMessageById"
                @regenerate="regenerateAnswer"
                @fork="forkConversation"
                @stop="stopStreaming"
                @navigate="closeDrawer"
              />
            </template>
          </div>

          <!-- 滚动到底部悬浮按钮：仅当用户上滚（autoFollow=false）且消息非空时显示 -->
          <transition name="ai-chat-scroll-fade">
            <t-button
              v-if="!autoFollow && uiMessages.length > 0"
              variant="text"
              class="ai-chat-scroll-bottom app-floating-btn"
              :title="t.aiChat.scrollToBottom"
              :aria-label="t.aiChat.scrollToBottom"
              @click="scrollToBottom"
            >
              <t-icon name="arrow-down" />
            </t-button>
          </transition>
        </div>

        <!--
          常驻快捷示例 chips：放在输入框上方，无论是否有历史消息都显示。
          欢迎页只保留欢迎语，避免与本行重复。
        -->
        <chat-quick-examples
          :t="t"
          :streaming="streaming"
          :examples="welcomeExamples"
          @select-example="sendExample"
        />

        <!-- 输入区：textarea + 内嵌工具栏（左下角"启用工具"开关图标 + 右下角发送按钮） -->
        <chat-input-area
          v-model:input="input"
          v-model:enable-tools="enableTools"
          v-model:enable-web-search="enableWebSearch"
          v-model:enable-planning="enablePlanning"
          v-model:current-model="currentModel"
          v-model:pinned-skill="pinnedSkill"
          v-model:pending-images="pendingImages"
          :t="t"
          :disabled="!health?.healthy"
          :streaming="streaming"
          :can-send="canSend"
          :available-models="availableModels"
          :available-skills="availableSkills"
          :available-tools="availableTools"
          @send="sendMessage"
          @stop="stopStreaming"
          @pick-images="attachImages"
          @remove-image="removePendingImage"
        />
      </div>
    </form-drawer>
  </template>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import ChatMessageBubble from '@/components/ai-chat/chat-message-bubble.vue';
import ChatTriggerButton from '@/components/ai-chat/chat-trigger-button.vue';
import ChatDrawerHeader from '@/components/ai-chat/chat-drawer-header.vue';
import ChatWelcomePanel from '@/components/ai-chat/chat-welcome-panel.vue';
import ChatQuickExamples from '@/components/ai-chat/chat-quick-examples.vue';
import ChatInputArea from '@/components/ai-chat/chat-input-area.vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import { useAiChatModel } from '@/models/ai-chat-model';
import { useAiChatSkinStore } from '@/stores/ai-chat-skin';

/** 皮肤全局状态：抽屉根节点绑定局部 CSS 变量，面板与主体共享同一份配置 */
const skinStore = useAiChatSkinStore();

const {
  t,
  isMobile,
  hasPermission,
  visible,
  health,
  conversations,
  currentConversationId,
  uiMessages,
  input,
  enableTools,
  enableWebSearch,
  enablePlanning,
  streaming,
  canSend,
  availableModels,
  currentModel,
  availableSkills,
  pinnedSkill,
  pendingImages,
  attachImages,
  removePendingImage,
  availableTools,
  welcomeExamples,
  renderItems,
  selectConversation,
  removeConversation,
  createNewConversation,
  sendMessage,
  sendExample,
  stopStreaming,
  regenerateAnswer,
  forkConversation,
  copyMessageById,
  isCopied,
  autoFollow,
  scrollToBottom,
  openDrawer,
  closeDrawer,
  share,
  onDrawerVisibleChange,
} = useAiChatModel();

/**
 * 消息滚动容器模板 ref
 * @description 必须在视图层声明：t-drawer 首次未打开时内部 DOM 未渲染、模板 ref 此时为 null，
 *   只能在 watch(visible=true) 后再 nextTick 一次拿到真正的 div，再交给 model。
 *   model 内部维护的 scrollContainer 是另一个 ref（绑定后才有值），不能直接当模板 ref 用。
 */
const scrollContainer = ref<HTMLDivElement | null>(null);

/**
 * 抽屉显隐切换：拿到当前帧的容器 DOM 后委托给 model 处理
 * @description 视图层只负责 DOM 取值时机，所有副作用（attach/detach、body.dataset、autoFollow 重置）
 *   都集中在 model.onDrawerVisibleChange 里，便于复用与单测。
 */
/** 已写入 body 的皮肤变量，便于皮肤切换 / 抽屉关闭时清理 */
const appliedBodySkinVars = new Set<string>();

/**
 * 把专用皮肤变量同步到 body
 * @param {Record<string, string>} style - 当前皮肤变量
 * @param {boolean} open - 抽屉是否展开
 * @returns {void}
 * @description t-popup / t-dialog 会 teleport 到 body，继承不到抽屉根节点变量；
 *   只同步 --ai-chat-* 前缀，不覆盖站点通用变量，避免影响抽屉外的页面
 */
const syncBodySkinVars = (style: Record<string, string>, open: boolean): void => {
  for (const key of appliedBodySkinVars) {
    document.body.style.removeProperty(key);
  }
  appliedBodySkinVars.clear();
  if (!open || Object.keys(style).length === 0) {
    delete document.body.dataset.aiChatSkin;
    return;
  }
  document.body.dataset.aiChatSkin = '1';
  for (const [key, value] of Object.entries(style)) {
    // 背景图本体可能数 MB，只供抽屉自身使用，没必要写进 body 的浮层变量
    if (!key.startsWith('--ai-chat-') || key === '--ai-chat-bg-image') continue;
    document.body.style.setProperty(key, value);
    appliedBodySkinVars.add(key);
  }
};

watch(visible, async (open) => {
  if (open) {
    void skinStore.load();
  }
  syncBodySkinVars(skinStore.skinStyle, open);
  await nextTick();
  await onDrawerVisibleChange(open, scrollContainer.value);
}, { immediate: false });

/** 切换预设 / 上传背景图后刷新浮层配色 */
watch(() => skinStore.skinStyle, (style) => {
  syncBodySkinVars(style, visible.value);
});

/** 组件卸载时清掉 body 上的皮肤变量，避免污染登录页 */
onBeforeUnmount(() => {
  syncBodySkinVars({}, false);
});
</script>

<style scoped>
/* ===== 抽屉主体 ===== */
.ai-chat-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  /* 背景图铺在 .t-drawer__content-wrapper（见 styles/ai-chat-skin.css），
     让 header 与消息区共享同一张皮肤，避免两层背景错位 */
}

.ai-chat-alert {
  margin: 0 0 8px;
  flex-shrink: 0;
  /* TDesign 警告条默认浅色底，与深色/自定义皮肤的亮色文字冲突；改用主题琥珀色半透明底 */
  --td-warning-color-focus: rgba(var(--accent-amber-rgb), 0.16);
  --td-warning-color: var(--accent-amber);
  background-color: rgba(var(--accent-amber-rgb), 0.16);
  border: 1px solid rgba(var(--accent-amber-rgb), 0.34);
  color: var(--ai-chat-text, var(--text-primary));
}

.ai-chat-alert :deep(.t-alert__message),
.ai-chat-alert :deep(.t-alert__description) {
  color: var(--ai-chat-text, var(--text-primary));
}

.ai-chat-alert :deep(.t-alert__description) {
  opacity: 0.82;
}

.ai-chat-messages-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ai-chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 关闭浏览器滚动锡定，避免流式追加内容时滚动条被往上推，导致「滚动条不跟随」的假象 */
  overflow-anchor: none;
  padding: 4px 0 12px;
}

/*
  时间分组分隔条：居中显示「今天 14:30」/「昨天 09:15」/「5 月 20 日 15:42」
  - 居中 + 极小字号 + 灰色，借助上下细线增强"时间轴"感
  - 不点击，不参与无障碍焦点
*/
.ai-chat-time-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0 8px;
  user-select: none;
}

.ai-chat-time-separator > span {
  position: relative;
  font-size: 11px;
  color: var(--text-muted, #999);
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.03));
  letter-spacing: 0.02em;
}

/* ===== 滚动到底部悬浮按钮 ===== */
.ai-chat-scroll-bottom {
  position: absolute;
  right: 16px;
  bottom: 12px;
  z-index: 2;
}
</style>

<style>
/*
  全局样式（非 scoped）：
  当 ai-chat 抽屉打开时（body[data-ai-chat-open="1"]），隐藏全局水印。
  -----------------------------------------------------------------
  背景：watermark.vue 用 position:fixed; z-index:9999; pointer-events:none
  铺满整个视口，导致打开 t-drawer 后水印纹理直接糊在聊天内容（包括星座卡片
  的图）之上，严重影响可读性。最低成本修复：聊天抽屉打开期间临时隐藏水印；
  关闭抽屉立即恢复——不影响其他页面与原本的安全审计能力。
  -----------------------------------------------------------------
*/
body[data-ai-chat-open="1"] .watermark-container {
  display: none !important;
}
</style>
