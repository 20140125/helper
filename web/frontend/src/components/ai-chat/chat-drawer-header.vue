<template>
  <div class="ai-chat-header">
    <span class="ai-chat-header__title">{{ t.aiChat.title }}</span>
    <div class="ai-chat-header__actions">
      <!-- 新建会话 -->
      <t-tooltip :content="t.aiChat.newConversation" placement="bottom">
        <t-button
          variant="text"
          class="app-icon-btn"
          :aria-label="t.aiChat.newConversation"
          @click="emit('new')"
        >
          <template #icon><t-icon name="add" /></template>
        </t-button>
      </t-tooltip>
      <!-- 历史会话弹窗：trigger 按钮 + 列表内容 -->
      <t-popup
        v-model:visible="historyOpen"
        trigger="click"
        placement="bottom-right"
        :overlay-style="{ width: '280px', maxHeight: '360px', overflow: 'auto' }"
      >
        <t-tooltip :content="t.aiChat.history" placement="bottom">
          <t-button
            variant="text"
            class="app-icon-btn"
            :aria-label="t.aiChat.history"
          >
            <template #icon><t-icon name="history" /></template>
          </t-button>
        </t-tooltip>
        <template #content>
          <div v-if="conversations.length === 0" class="ai-chat-history-empty">
            {{ t.aiChat.noConversations }}
          </div>
          <div v-else class="ai-chat-history-list">
            <div
              v-for="conv in conversations"
              :key="conv.id"
              class="ai-chat-history-item"
              :class="{ 'ai-chat-history-item--active': conv.id === currentConversationId }"
              @click="onSelect(conv.id)"
            >
              <div class="ai-chat-history-item__main">
                <div class="ai-chat-history-item__title">{{ conv.title }}</div>
                <div class="ai-chat-history-item__meta">
                  {{ conv.message_count }} {{ t.aiChat.messagesUnit }}
                </div>
              </div>
              <t-popconfirm
                :content="t.aiChat.deleteConfirm"
                theme="danger"
                @confirm="onRemove(conv.id, $event)"
              >
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  @click.stop
                >
                  <template #icon><t-icon name="delete" /></template>
                </t-button>
              </t-popconfirm>
            </div>
          </div>
        </template>
      </t-popup>
      <!-- 皮肤设置弹窗：内置预设 + 上传自定义背景图 -->
      <t-popup
        v-model:visible="skinOpen"
        trigger="click"
        placement="bottom-right"
        :overlay-style="{ width: '300px', maxHeight: '440px', overflow: 'auto' }"
      >
        <t-tooltip :content="t.aiChat.skinTitle" placement="bottom">
          <t-button
            variant="text"
            class="app-icon-btn"
            :aria-label="t.aiChat.skinTitle"
          >
            <template #icon><t-icon name="palette" /></template>
          </t-button>
        </t-tooltip>
        <template #content>
          <chat-skin-panel :t="t" />
        </template>
      </t-popup>
      <!-- 分享 -->
      <t-tooltip :content="t.aiChat.share" placement="bottom">
        <t-button
          variant="text"
          class="app-icon-btn"
          :aria-label="t.aiChat.share"
          @click="emit('share')"
        >
          <template #icon><t-icon name="share" /></template>
        </t-button>
      </t-tooltip>
      <!-- 关闭 -->
      <t-tooltip :content="t.common.close" placement="bottom">
        <t-button
          variant="text"
          class="app-icon-btn"
          :aria-label="t.common.close"
          @click="emit('close')"
        >
          <template #icon><t-icon name="close" /></template>
        </t-button>
      </t-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ChatSkinPanel from '@/components/ai-chat/chat-skin-panel.vue';
import type { ChatConversationSummary } from '@/types/ai-chat';
import type { Locale } from '@/types/locale';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 历史会话列表 */
  conversations: ChatConversationSummary[];
  /** 当前选中的会话 ID（用于高亮） */
  currentConversationId: string;
}>();

const emit = defineEmits<{
  /** 点击「新建会话」 */
  (e: 'new'): void;
  /** 点击「分享」 */
  (e: 'share'): void;
  /** 点击「关闭」 */
  (e: 'close'): void;
  /** 选择历史会话，参数为会话 ID */
  (e: 'select', id: string): void;
  /** 删除历史会话，参数为会话 ID */
  (e: 'remove', id: string): void;
}>();

/** 历史会话弹窗显示状态（局部 UI 状态） */
const historyOpen = ref(false);

/** 皮肤设置弹窗显示状态（局部 UI 状态） */
const skinOpen = ref(false);

/**
 * 选择历史会话：先关弹窗，再向上抛事件
 * @param {string} id - 会话 ID
 * @returns {void}
 */
const onSelect = (id: string): void => {
  historyOpen.value = false;
  emit('select', id);
};

/**
 * 删除历史会话：阻止冒泡到父层 history-item，再向上抛事件
 * @param {string} id - 会话 ID
 * @param {{ e?: MouseEvent }} [ctx] - TDesign popconfirm 事件上下文
 * @returns {void}
 */
const onRemove = (id: string, ctx?: { e?: MouseEvent }): void => {
  ctx?.e?.stopPropagation();
  emit('remove', id);
};
</script>

<style scoped>
/* ===== 抽屉自定义 header（左标题 + 右图标按钮组） ===== */
.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.ai-chat-header__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-header__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* ===== chat-drawer-header 的图标按钮局部覆盖 =====
 * app-icon-btn 默认 base 用 var(--text-muted)（最暗灰），但抽屉头部图标
 * 需要更显眼并有主题色 hover 反馈（与 topbar 的体感一致）。
 * 这里只覆盖本组件作用域内的 app-icon-btn，保持其它地方的轻量风格不变。
 *
 * 注：app-icon-btn 在 t-button-overrides.css 中给 background/color 加了 !important
 * （用于压制 .t-button--variant-text !important），所以本处覆盖也必须带 !important，
 * 否则会失效。详见 t-button-overrides.css 文件头部"!important 强制策略"说明。
 */
.ai-chat-header__actions :deep(.app-icon-btn.t-button) {
  color: var(--text-secondary) !important;
}

.ai-chat-header__actions :deep(.app-icon-btn.t-button:hover:not(:disabled):not(.t-is-disabled)) {
  color: var(--accent-primary) !important;
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1) !important;
}

/* ===== 历史会话弹窗 ===== */
.ai-chat-history-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.ai-chat-history-list {
  display: flex;
  flex-direction: column;
  padding: 4px;
}

.ai-chat-history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.ai-chat-history-item:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
}

.ai-chat-history-item--active {
  background: var(--accent-primary-bg, rgba(0, 82, 217, 0.08));
}

.ai-chat-history-item__main {
  flex: 1;
  min-width: 0;
}

.ai-chat-history-item__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-history-item__meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
