import fs from 'fs';
import path from 'path';
import {
  AI_CONVERSATIONS_DIR,
  MAX_MESSAGES_PER_CONVERSATION,
  type ChatConversation,
  type ChatConversationSummary,
  type ChatMessage,
} from '@/types/ai-chat';
import { extractMessageText } from './content';

/**
 * 计算用户专属的会话目录
 * @param {string} userEmail - 用户邮箱
 * @returns {string} 目录绝对路径
 */
const userDir = (userEmail: string): string => {
  // 去除非法文件名字符
  const safe = userEmail.replace(/[^a-zA-Z0-9_.@-]/g, '_');
  return path.join(AI_CONVERSATIONS_DIR, safe);
};

/**
 * 确保目录存在
 * @param {string} dir - 目录路径
 * @returns {void}
 */
const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * 列出指定用户的全部会话摘要
 * @param {string} userEmail - 用户邮箱
 * @returns {ChatConversationSummary[]} 按更新时间倒序的摘要列表
 */
export const listConversations = (userEmail: string): ChatConversationSummary[] => {
  const dir = userDir(userEmail);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const summaries: ChatConversationSummary[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const conv: ChatConversation = JSON.parse(raw);
      summaries.push({
        id: conv.id,
        title: conv.title,
        message_count: conv.messages.length,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      });
    } catch {
      // 损坏文件忽略
    }
  }
  return summaries.sort((a, b) => b.updated_at - a.updated_at);
};

/**
 * 读取指定会话
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @returns {ChatConversation | null} 会话对象（不存在返回 null）
 */
export const readConversation = (
  userEmail: string,
  conversationId: string,
): ChatConversation | null => {
  const file = path.join(userDir(userEmail), `${conversationId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ChatConversation;
  } catch {
    return null;
  }
};

/**
 * 写入（覆盖）会话
 * @param {ChatConversation} conv - 会话对象
 * @returns {void}
 */
export const writeConversation = (conv: ChatConversation): void => {
  const dir = userDir(conv.user);
  ensureDir(dir);
  const file = path.join(dir, `${conv.id}.json`);
  // 滑动窗口：超出最大消息数时保留最近 N 条
  if (conv.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
  }
  fs.writeFileSync(file, JSON.stringify(conv, null, 2), 'utf-8');
};

/**
 * 删除会话
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @returns {boolean} 是否成功删除
 */
export const deleteConversation = (userEmail: string, conversationId: string): boolean => {
  const file = path.join(userDir(userEmail), `${conversationId}.json`);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
};

/**
 * 创建新会话
 * @param {string} userEmail - 用户邮箱
 * @param {string} [title] - 标题（可选，默认「新对话」）
 * @returns {ChatConversation} 新创建的会话
 */
export const createConversation = (
  userEmail: string,
  title?: string,
): ChatConversation => {
  const now = Date.now();
  const conv: ChatConversation = {
    id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: title?.trim() || '新对话',
    user: userEmail,
    messages: [],
    created_at: now,
    updated_at: now,
  };
  writeConversation(conv);
  return conv;
};

/**
 * 向指定会话追加消息（自动持久化）
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @param {ChatMessage} message - 要追加的消息
 * @returns {ChatConversation | null} 更新后的会话；找不到时返回 null
 */
export const appendMessage = (
  userEmail: string,
  conversationId: string,
  message: ChatMessage,
): ChatConversation | null => {
  const conv = readConversation(userEmail, conversationId);
  if (!conv) return null;
  const msg: ChatMessage = { ...message, created_at: message.created_at ?? Date.now() };
  conv.messages.push(msg);
  conv.updated_at = Date.now();
  // 第一条用户消息时，将标题设置为内容前 20 字（多模态消息只取文本片段）
  const msgText = extractMessageText(msg.content).trim();
  if (conv.title === '新对话' && msg.role === 'user' && msgText) {
    conv.title = msgText.slice(0, 20);
  }
  writeConversation(conv);
  return conv;
};

/**
 * 替换会话的全部消息（Agent Loop 完成后整体落盘）
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @param {ChatMessage[]} messages - 完整消息列表
 * @returns {ChatConversation | null} 更新后的会话；找不到时返回 null
 */
export const replaceMessages = (
  userEmail: string,
  conversationId: string,
  messages: ChatMessage[],
): ChatConversation | null => {
  const conv = readConversation(userEmail, conversationId);
  if (!conv) return null;
  conv.messages = messages;
  conv.updated_at = Date.now();
  // 自动设置标题
  if (conv.title === '新对话') {
    const firstUser = messages.find((m) => m.role === 'user' && extractMessageText(m.content).trim());
    if (firstUser) {
      conv.title = extractMessageText(firstUser.content).trim().slice(0, 20);
    }
  }
  writeConversation(conv);
  return conv;
};
