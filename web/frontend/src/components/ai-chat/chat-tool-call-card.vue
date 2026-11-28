<template>
  <div class="tool-call" :class="`tool-call--${tc.status}`">
    <div class="tool-call__header" @click="expanded = !expanded">
      <div class="tool-call__header-main">
        <t-icon :name="iconName" class="tool-call__icon" />
        <span class="tool-call__name">{{ tc.name }}</span>
        <t-tag size="small" :theme="statusTheme">
          <t-icon v-if="tc.status === 'executing'" name="loading" />
          <span>{{ statusLabel }}</span>
        </t-tag>
        <span v-if="tc.summary" class="tool-call__summary" :title="tc.summary">{{ tc.summary }}</span>
      </div>
      <t-icon
        :name="expanded ? 'chevron-up' : 'chevron-down'"
        class="tool-call__toggle"
      />
    </div>

    <!-- 图片预览（折叠/展开均常驻展示，便于第一眼就看到卡片图） -->
    <div v-if="imageUrl" class="tool-call__image" @click.stop>
      <image-previewer
        :src="imageUrl"
        :alt="tc.name"
        :hover-text="t.aiChat.toolViewCard"
        :always-show-mask="false"
        max-height="320px"
        radius="8px"
      />
    </div>

    <div v-if="expanded" class="tool-call__body">
      <div v-if="tc.arguments" class="tool-call__section">
        <div class="tool-call__section-title">{{ t.aiChat.toolArguments }}</div>
        <pre class="tool-call__code">{{ formatToolArgs(tc.arguments) }}</pre>
      </div>
      <div v-if="tc.result !== undefined" class="tool-call__section">
        <div class="tool-call__section-title">{{ t.aiChat.toolResult }}</div>
        <pre class="tool-call__code">{{ formatToolResult(tc.result) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ImagePreviewer from '@/components/common/image-previewer.vue';
import { TOOL_CALL_STATUS_LABEL_KEY, TOOL_CALL_STATUS_THEME, TOOL_NAME_ICON } from '@/constants/ai-chat';
import type { UiToolCall } from '@/types/ai-chat';
import type { Locale } from '@/types/locale';
import { extractToolImageUrl, formatToolArgs, formatToolResult } from '@/utils/ai-chat';

const props = defineProps<{
  /** 工具调用对象 */
  tc: UiToolCall;
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
}>();

/** 是否展开详情 */
const expanded = ref(false);

/** 状态标签的 theme */
const statusTheme = computed(() =>
  TOOL_CALL_STATUS_THEME[props.tc.status] ?? 'default',
);

/** 状态文案 */
const statusLabel = computed(() => {
  const key = TOOL_CALL_STATUS_LABEL_KEY[props.tc.status];
  return key ? props.t.aiChat[key] : props.tc.status;
});

/** 工具图标 */
const iconName = computed(() => TOOL_NAME_ICON[props.tc.name] ?? 'tools');

/**
 * 从 tc.result 安全地解析出 image_url（仅 card_skill 等工具会带）
 * @description 仅做组件层 props 解包，纯解析逻辑见 utils/ai-chat/extractToolImageUrl
 */
const imageUrl = computed((): string => extractToolImageUrl(props.tc.result));
</script>

<style scoped>
.tool-call {
  /*
    宽度策略（v3.4 修订）：
    width: auto 而不是 100%——让卡片由 header 的自然内容宽度（图标 + 工具名 +
    状态标签 + summary 摘要）决定大小，并且不会单方面把父级
    .msg__body（fit-content）撑满到 78% 上限。

    这样同一气泡里的工具卡片会自然贴齐下方正文气泡的宽度（取两者最宽者
    作为 body 的 fit-content 宽度），避免"卡片硬撑 78%、文本只占 50%"
    的台阶感。
    -----------------------------------------------------------------
    历史方案是 width: 100% + 父级 width: 100%，目的是"让多条相邻消息的
    工具卡片左右边对齐"——但实测视觉上会和下方正文气泡形成明显落差，
    且强行铺满版面给人"每张工具卡都很重要"的错觉，反而抢戏；
    现改为内容自适应。
  */
  width: auto;
  box-sizing: border-box;
  border: 1px solid var(--border-color, #e7e7e7);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-secondary, #fafafa);
  font-size: 13px;
}

.tool-call--executing {
  border-color: var(--accent-primary, #0052d9);
}

.tool-call--success {
  border-color: var(--accent-green, #00a870);
}

.tool-call--failed {
  border-color: var(--accent-danger, #d54941);
}

.tool-call__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.tool-call__header:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.03));
}

/* header 主体区域占据剩余宽度，让 summary 能被截断不撑宽卡片 */
.tool-call__header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.tool-call__icon {
  flex-shrink: 0;
  color: var(--accent-primary, #0052d9);
}

.tool-call__name {
  font-family: 'JetBrains Mono', 'Source Code Pro', monospace;
  font-weight: 500;
  color: var(--text-primary);
  flex-shrink: 0;
}

/*
  summary 文本：从单行截断改为最多 2 行，避免关键摘要（"找到 3 条规则"/"已推送至张三"
  /"已生成卡片 /skill-images/xxx.png"等）被截掉一半逼用户展开整张 JSON 才看得全。
  - line-clamp 是 webkit 私有，但所有现代浏览器（含 Firefox 90+）都已实现
  - 模板已带 :title="tc.summary"，两行截断后仍可 hover 看全文
*/
.tool-call__summary {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.tool-call__toggle {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--text-muted);
}

.tool-call__body {
  border-top: 1px solid var(--border-color, #e7e7e7);
  padding: 8px 12px;
}

.tool-call__section + .tool-call__section {
  margin-top: 8px;
}

.tool-call__section-title {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.tool-call__code {
  font-family: 'JetBrains Mono', 'Source Code Pro', monospace;
  font-size: 12px;
  /*
   * 注：不要使用 --bg-tertiary！项目主题（dark/light/forest-dark/forest-light/自定义）
   * 中均未定义 --bg-tertiary，会 fallback 到硬编码 #f0f0f0，导致暗色主题下
   * 代码块出现亮白底（与容器 --bg-secondary 暗底极不协调）。
   * 改用各主题都正确定义的 --bg-card，相对容器底色（--bg-secondary）刚好高出一档，
   * 在 dark / light / forest-* 下都有合适的层次对比。
   */
  background: var(--bg-card, #f8f9fa);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 320px;
  overflow: auto;
}

/* 卡片图片预览区：folded/expanded 都展示，给图灵活的内边距与圆角 */
.tool-call__image {
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border-color, #e7e7e7);
}
</style>
