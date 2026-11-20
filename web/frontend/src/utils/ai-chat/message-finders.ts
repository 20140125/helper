// ============================================================
// AI 聊天消息查找 / 工厂工具
// ============================================================

import type { UiMessage } from '@/types/ai-chat';
import { ChatRole } from '@/types/ai-chat';

/**
 * 在消息列表中向前查找指定 assistant 消息之前最近的一条 user 消息索引
 * @param {UiMessage[]} messages - UI 消息列表
 * @param {string} assistantMsgId - assistant 消息 id
 * @returns {number} user 消息索引；找不到（或目标 id 不存在）返回 -1
 * @description regenerateAnswer 需要定位上一条 user 消息以便裁剪。
 */
export const findPrevUserIndex = (
  messages: UiMessage[],
  assistantMsgId: string,
): number => {
  const assistantIdx = messages.findIndex((m) => m.id === assistantMsgId);
  if (assistantIdx < 0) return -1;
  for (let i = assistantIdx - 1; i >= 0; i -= 1) {
    if (messages[i].role === ChatRole.User) return i;
  }
  return -1;
};

/**
 * 在消息列表中查找指定 assistant 消息之前最近一条 user 消息的文本
 * @param {UiMessage[]} messages - UI 消息列表
 * @param {string} assistantMsgId - assistant 消息 id
 * @returns {string} 用户消息文本（已 trim）；找不到返回空串
 */
export const findPrevUserText = (
  messages: UiMessage[],
  assistantMsgId: string,
): string => {
  const idx = findPrevUserIndex(messages, assistantMsgId);
  if (idx < 0) return '';
  return messages[idx].content?.trim() ?? '';
};

/**
 * 构造一条空白的 user / assistant 占位消息
 * @param {object} params - 入参
 * @param {ChatRole.User | ChatRole.Assistant} params.role - 角色
 * @param {string} params.content - 内容（assistant 占位为空字符串）
 * @param {boolean} params.streaming - 是否处于流式中
 * @param {() => string} params.idGen - 生成消息 id 的函数
 * @returns {UiMessage} 占位消息
 * @description idGen 由调用方注入（通常是 utils/ai-chat/genId），保持纯函数。
 */
export const makePlaceholderMessage = (params: {
  role: ChatRole.User | ChatRole.Assistant;
  content: string;
  streaming: boolean;
  idGen: () => string;
  /** 随消息一起发送的图片 Data URL 列表（可选，仅 user 消息使用） */
  images?: string[];
}): UiMessage => {
  const ui: UiMessage = {
    id: params.idGen(),
    role: params.role,
    content: params.content,
    tool_calls: [],
    streaming: params.streaming,
    created_at: Date.now(),
  };
  if (params.images && params.images.length > 0) {
    ui.images = [...params.images];
  }
  return ui;
};

/**
 * 在 assistant 消息中查找指定 id 的 tool_call
 * @param {UiMessage} assistantMsg - 当前 assistant 消息
 * @param {string} toolCallId - tool_call_id
 * @returns {UiMessage['tool_calls'][number] | undefined} 匹配的工具调用
 */
export const findToolCallById = (
  assistantMsg: UiMessage,
  toolCallId: string,
): UiMessage['tool_calls'][number] | undefined => {
  return assistantMsg.tool_calls.find((t) => t.id === toolCallId);
};
