import {
  AI_CONVERSATIONS_PREFIX,
  type ChatConversation,
  type ChatConversationSummary,
  type ChatMessage,
} from '@/types/ai-chat';
import {
  cacheKeyExists,
  deleteCacheKey,
  listCacheKeys,
  readCacheJson,
  writeCacheJson,
} from '@/utils/database/cache-store';
import { extractMessageText } from './content';

/**
 * 清洗用户邮箱，生成安全的缓存键片段
 * @param {string} userEmail - 用户邮箱
 * @returns {string} 不含路径分隔符与连续点的键片段
 * @description 缓存键统一经 normalizeCacheKey 校验，这里先剔除 /、\、.. 等危险字符
 */
const safeUser = (userEmail: string): string =>
  userEmail.replace(/[^a-zA-Z0-9_.@-]/g, '_').replace(/\.{2,}/g, '.');

/**
 * 计算用户专属的会话键前缀
 * @param {string} userEmail - 用户邮箱
 * @returns {string} 形如 ai-conversations/<email>/ 的前缀
 */
const userPrefix = (userEmail: string): string =>
  `${AI_CONVERSATIONS_PREFIX}${safeUser(userEmail)}/`;

/**
 * 会话 ID 是否可作为缓存键片段
 * @param {string} conversationId - 会话 ID
 * @returns {boolean} 合法返回 true
 * @description 会话 ID 可能来自请求参数，拒绝路径穿越字符后再拼键
 */
export const isSafeConversationId = (conversationId: string): boolean =>
  Boolean(conversationId)
  && !conversationId.includes('..')
  && !conversationId.includes('/')
  && !conversationId.includes('\\');

/**
 * 拼出单个会话的缓存键
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @returns {string} 完整缓存键
 */
const conversationKey = (userEmail: string, conversationId: string): string =>
  `${userPrefix(userEmail)}${conversationId}.json`;

/**
 * 列出指定用户的全部会话摘要
 * @param {string} userEmail - 用户邮箱
 * @returns {Promise<ChatConversationSummary[]>} 按更新时间倒序的摘要列表
 * @description 目录列表改为按 ai-conversations/<email>/ 前缀列缓存键，损坏记录自动忽略
 */
export const listConversations = async (userEmail: string): Promise<ChatConversationSummary[]> => {
  const keys = (await listCacheKeys(userPrefix(userEmail))).filter((key) => key.endsWith('.json'));
  const summaries: ChatConversationSummary[] = [];
  for (const key of keys) {
    const conv = await readCacheJson<ChatConversation>(key);
    // 内容损坏或字段缺失时跳过，保持原「损坏文件忽略」语义
    if (!conv || !Array.isArray(conv.messages)) continue;
    summaries.push({
      id: conv.id,
      title: conv.title,
      message_count: conv.messages.length,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    });
  }
  return summaries.sort((a, b) => b.updated_at - a.updated_at);
};

/**
 * 读取指定会话
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @returns {Promise<ChatConversation | null>} 会话对象（不存在返回 null）
 */
export const readConversation = async (
  userEmail: string,
  conversationId: string,
): Promise<ChatConversation | null> => {
  if (!isSafeConversationId(conversationId)) return null;
  return readCacheJson<ChatConversation>(conversationKey(userEmail, conversationId));
};

/**
 * 写入（覆盖）会话
 * @param {ChatConversation} conv - 会话对象
 * @returns {Promise<void>}
 * @description 保留全部历史消息，不再做 50 条滑动窗口裁剪，否则更早的回话会被物理删除、
 *   无法向上翻到第一条；发给 LLM 的上下文窗口由 /send 单独裁剪。
 */
export const writeConversation = async (conv: ChatConversation): Promise<void> => {
  await writeCacheJson(conversationKey(conv.user, conv.id), conv);
};

/**
 * 删除会话
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
export const deleteConversation = async (
  userEmail: string,
  conversationId: string,
): Promise<boolean> => {
  if (!isSafeConversationId(conversationId)) return false;
  const key = conversationKey(userEmail, conversationId);
  if (!(await cacheKeyExists(key))) return false;
  await deleteCacheKey(key);
  return true;
};

/**
 * 创建新会话
 * @param {string} userEmail - 用户邮箱
 * @param {string} [title] - 标题（可选，默认「新对话」）
 * @returns {Promise<ChatConversation>} 新创建的会话
 */
export const createConversation = async (
  userEmail: string,
  title?: string,
): Promise<ChatConversation> => {
  const now = Date.now();
  const conv: ChatConversation = {
    id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: title?.trim() || '新对话',
    user: userEmail,
    messages: [],
    created_at: now,
    updated_at: now,
  };
  await writeConversation(conv);
  return conv;
};

/**
 * 向指定会话追加消息（自动持久化）
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @param {ChatMessage} message - 要追加的消息
 * @returns {Promise<ChatConversation | null>} 更新后的会话；找不到时返回 null
 */
export const appendMessage = async (
  userEmail: string,
  conversationId: string,
  message: ChatMessage,
): Promise<ChatConversation | null> => {
  const conv = await readConversation(userEmail, conversationId);
  if (!conv) return null;
  const msg: ChatMessage = { ...message, created_at: message.created_at ?? Date.now() };
  conv.messages.push(msg);
  conv.updated_at = Date.now();
  // 第一条用户消息时，将标题设置为内容前 20 字（多模态消息只取文本片段）
  const msgText = extractMessageText(msg.content).trim();
  if (conv.title === '新对话' && msg.role === 'user' && msgText) {
    conv.title = msgText.slice(0, 20);
  }
  await writeConversation(conv);
  return conv;
};

/**
 * 替换会话的全部消息（Agent Loop 完成后整体落库）
 * @param {string} userEmail - 用户邮箱
 * @param {string} conversationId - 会话 ID
 * @param {ChatMessage[]} messages - 完整消息列表
 * @returns {Promise<ChatConversation | null>} 更新后的会话；找不到时返回 null
 */
export const replaceMessages = async (
  userEmail: string,
  conversationId: string,
  messages: ChatMessage[],
): Promise<ChatConversation | null> => {
  const conv = await readConversation(userEmail, conversationId);
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
  await writeConversation(conv);
  return conv;
};
