/** AI Chat 模块常量 */
import type { Locale } from '@/types/locale';

/** 默认会话标题（后端创建时也用同样的） */
export const DEFAULT_CONVERSATION_TITLE = '新对话';

/** 工具调用状态 → 颜色映射（用于 UI 标签 theme） */
export const TOOL_CALL_STATUS_THEME: Record<string, string> = {
  pending: 'default',
  executing: 'primary',
  success: 'success',
  failed: 'danger',
};

/**
 * 工具调用状态 → i18n key 后缀
 * 值类型收窄为 `keyof Locale['aiChat']`，便于消费方直接 `t.aiChat[key]` 索引而无需断言；
 * 同时拼错 key 时编译期即可发现。
 */
export const TOOL_CALL_STATUS_LABEL_KEY: Record<string, keyof Locale['aiChat']> = {
  pending: 'toolStatusPending',
  executing: 'toolStatusExecuting',
  success: 'toolStatusSuccess',
  failed: 'toolStatusFailed',
};

/** 工具名 → 显示图标（TDesign 图标名） */
export const TOOL_NAME_ICON: Record<string, string> = {
  query_logs: 'file-paste',
  query_rules: 'filter',
  query_reminder_quotes: 'chat',
  trigger_script: 'play-circle',
  list_apis: 'api',
  send_wecom_message: 'send',
  card_skill: 'image',
  annual_update: 'setting',
  web_search: 'search',
  query_cache: 'file-search',
};

/** 输入框最大字符数（避免一次性发送超长内容耗尽 token） */
export const MAX_INPUT_LENGTH = 2000;

/** 站内路由链接的 CSS 类名（Markdown 渲染时打在 <a> 上，供点击委托与样式识别） */
export const INTERNAL_LINK_CLASS = 'md-link-internal';

/** 站内路由链接的 DOM 标记属性（点击委托据此走 vue-router 跳转，不整页刷新） */
export const INTERNAL_LINK_ATTR = 'data-internal';
