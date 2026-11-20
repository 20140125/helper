// ============================================================
// AI 聊天消息列表：渲染项推导
// ============================================================

import type { UiMessage } from '@/types/ai-chat';
import { ChatRole } from '@/types/ai-chat';

/** 时间戳分组阈值（毫秒）：超过此值视为「新一段对话」需要分隔条 */
export const AI_CHAT_TIME_GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * AI 助手消息列表的渲染列表项类型
 * @description renderItems 计算属性派生出的列表，由视图层模板 v-for 直接消费：
 *   - separator：跨 5 分钟 + 回合切换时插入的居中时间分隔条；
 *   - msg：消息气泡，turnStart 控制是否拉开"新一轮对话"间距 + 渐变细线。
 */
export type AiChatRenderItem =
  | { type: 'separator'; key: string; label: string }
  | { type: 'msg'; key: string; m: UiMessage; turnStart: boolean };

/**
 * 计算单条消息相对前一条的回合边界标记
 * @param {UiMessage | null} prev - 上一条消息（首条时为 null）
 * @param {UiMessage} m - 当前消息
 * @param {(ts: number) => string} formatTime - 时间戳格式化函数
 * @returns {{ separator: AiChatRenderItem | null, turnStart: boolean }}
 * @description
 *   - separator：仅在「上一条 assistant + 当前 user + 跨 5 min」时插入；
 *   - turnStart：用户消息 + 跨 5 min 时为 true，避免连续追问也叠加分隔线。
 */
export const computeTurnBoundary = (
  prev: UiMessage | null,
  m: UiMessage,
  formatTime: (ts: number) => string,
): { separator: AiChatRenderItem | null; turnStart: boolean } => {
  const ts = m.created_at ?? 0;
  const prevTs = prev?.created_at ?? 0;
  const crossesGap = !!(prev && ts && prevTs && ts - prevTs >= AI_CHAT_TIME_GROUP_GAP_MS);

  // 回合切换：上一条 assistant、当前 user。
  const isTurnSwitch = !!(prev && prev.role === ChatRole.Assistant && m.role === ChatRole.User);
  const separator: AiChatRenderItem | null = isTurnSwitch && crossesGap
    ? { type: 'separator', key: `sep-${m.id}`, label: formatTime(ts) }
    : null;

  // 新一轮对话开端：用户消息 + 跨 5min（避免连续追问也叠加分隔线）
  const turnStart = m.role === ChatRole.User && crossesGap;

  return { separator, turnStart };
};

/**
 * 把 UiMessage[] 转为带时间分隔条与回合标记的渲染项列表
 * @param {UiMessage[]} messages - 当前会话的 UI 消息列表
 * @param {(ts: number) => string} formatTime - 时间戳格式化函数
 * @returns {AiChatRenderItem[]} 渲染项列表（separator + msg 混合）
 */
export const buildAiChatRenderItems = (
  messages: UiMessage[],
  formatTime: (ts: number) => string,
): AiChatRenderItem[] => {
  const out: AiChatRenderItem[] = [];
  let prev: UiMessage | null = null;
  for (const m of messages) {
    const { separator, turnStart } = computeTurnBoundary(prev, m, formatTime);
    if (separator) out.push(separator);
    out.push({ type: 'msg', key: m.id, m, turnStart });
    prev = m;
  }
  return out;
};
