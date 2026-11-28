/**
 * 会话历史分页读取
 * @description 直接查 hp_ai_messages，按 seq 游标向上翻页；页边界对齐到 user 消息，
 *   避免把同一轮的 assistant + tool 结果拆到两页导致前端工具卡片丢失。
 */

import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import {
  CHAT_HISTORY_PAGE_SIZE,
  type ChatContentPart,
  type ChatConversationPage,
  type ChatMessage,
  type ChatRole,
  type ChatToolCall,
} from '@/types/ai-chat';
import { isSafeConversationId } from './conversation-store';

/** 消息查询列 */
const MESSAGE_COLUMNS = `seq, role, content, tool_calls, tool_call_id, name,
  prompt_tokens, completion_tokens, total_tokens, created_at`;

/** 页边界对齐 user 消息时最多向前扩展的条数 */
const BOUNDARY_SCAN_LIMIT = 60;

/**
 * 把数据库行还原成聊天消息
 * @param {RowDataPacket} row - hp_ai_messages 查询结果行
 * @returns {ChatMessage} 聊天消息
 * @description 与 cache-tables 的会话读取保持一致：多模态内容为 JSON 数组文本，
 *   tool_calls 为 JSON 文本，只有确实记录过 token 时才补 usage。
 */
const rowToMessage = (row: RowDataPacket): ChatMessage => {
  const raw = String(row.content ?? '');
  let content: string | ChatContentPart[] = raw;
  if (raw.startsWith('[')) {
    try {
      content = JSON.parse(raw) as ChatContentPart[];
    } catch {
      content = raw;
    }
  }
  const message: ChatMessage = { role: String(row.role ?? 'user') as ChatRole, content };
  if (row.tool_calls) {
    try {
      message.tool_calls = JSON.parse(String(row.tool_calls)) as ChatToolCall[];
    } catch {
      // 脏数据按「没有工具调用」处理，不影响整页展示
    }
  }
  if (row.tool_call_id) message.tool_call_id = String(row.tool_call_id);
  if (row.name) message.name = String(row.name);
  const createdAt = Number(row.created_at ?? 0);
  if (createdAt > 0) message.created_at = createdAt;
  const total = Number(row.total_tokens ?? 0);
  if (total > 0) {
    message.usage = {
      prompt_tokens: Number(row.prompt_tokens ?? 0),
      completion_tokens: Number(row.completion_tokens ?? 0),
      total_tokens: total,
    };
  }
  return message;
};

/**
 * 分页读取会话消息
 * @param {string} userEmail - 当前用户邮箱（用于校验会话归属）
 * @param {string} conversationId - 会话 ID
 * @param {number | null} [before] - 游标：只取 seq 小于该值的更早消息；不传则取最近一页
 * @param {number} [limit=CHAT_HISTORY_PAGE_SIZE] - 每页条数（1~100）
 * @returns {Promise<ChatConversationPage | null>} 当前页消息与下一页游标
 * @description 按 seq 倒序取 limit 条后反转成升序；若页首不是 user 消息，
 *   继续向前扩展到最近的 user 消息，保证同一轮 assistant/tool 不被拆开。
 */
export const readConversationPage = async (
  userEmail: string,
  conversationId: string,
  before?: number | null,
  limit: number = CHAT_HISTORY_PAGE_SIZE,
): Promise<ChatConversationPage | null> => {
  if (!isSafeConversationId(conversationId)) return null;
  const pool = getPool();
  const [convRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, title, `user`, created_at, updated_at FROM hp_ai_conversations WHERE id = ? AND `user` = ?',
    [conversationId, userEmail],
  );
  if (convRows.length === 0) return null;
  const conv = convRows[0];

  const params: Array<string | number> = [conversationId];
  let where = 'conversation_id = ?';
  if (before !== null && before !== undefined && Number.isFinite(before) && before >= 0) {
    where += ' AND seq < ?';
    params.push(Math.floor(before));
  }
  const pageSize = Math.min(100, Math.max(1, Math.floor(limit)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${MESSAGE_COLUMNS} FROM hp_ai_messages WHERE ${where} ORDER BY seq DESC LIMIT ?`,
    [...params, pageSize],
  );
  const messages: ChatMessage[] = rows.map(rowToMessage).reverse();
  let oldestSeq: number | null = rows.length > 0 ? Number(rows[rows.length - 1].seq) : null;

  if (messages.length > 0 && messages[0].role !== 'user' && oldestSeq !== null) {
    const [older] = await pool.query<RowDataPacket[]>(
      `SELECT ${MESSAGE_COLUMNS} FROM hp_ai_messages
       WHERE conversation_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?`,
      [conversationId, oldestSeq, BOUNDARY_SCAN_LIMIT],
    );
    for (const row of older) {
      messages.unshift(rowToMessage(row));
      oldestSeq = Number(row.seq);
      if (String(row.role) === 'user') break;
    }
  }

  let hasMore = false;
  if (oldestSeq !== null) {
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM hp_ai_messages WHERE conversation_id = ? AND seq < ?',
      [conversationId, oldestSeq],
    );
    hasMore = Number(countRows[0]?.n ?? 0) > 0;
  }

  return {
    conversation: {
      id: String(conv.id),
      title: String(conv.title ?? ''),
      user: String(conv.user ?? ''),
      messages,
      created_at: Number(conv.created_at ?? 0),
      updated_at: Number(conv.updated_at ?? 0),
    },
    has_more: hasMore,
    next_before: hasMore && oldestSeq !== null ? oldestSeq : null,
  };
};
