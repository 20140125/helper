import { listConversations, readConversation } from '@/routes/utils';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';

/** 清单模式默认返回条数 */
const DEFAULT_LIMIT = 20;

/** 清单模式返回条数上限 */
const MAX_LIMIT = 50;

/** 单条消息返回的最大字符数，防止上下文爆炸 */
const MESSAGE_MAX_LEN = 500;

/** 单个会话最多返回的消息条数（取最近 N 条） */
const MAX_MESSAGES = 20;

/**
 * 截断单条消息内容
 * @param {string} text - 消息原文
 * @returns {string} 截断后的文本
 */
const truncate = (text: string): string =>
  (text.length > MESSAGE_MAX_LEN ? `${text.slice(0, MESSAGE_MAX_LEN)}…（已截断）` : text);

/**
 * 本地时间格式化（YYYY-MM-DD HH:mm:ss）
 * @param {number} ts - 毫秒时间戳
 * @returns {string} 本地时间文本
 */
const toTime = (ts: number): string =>
  new Date(ts).toLocaleString('zh-CN', { hour12: false });

/**
 * query_conversations 工具实现
 * @description 查询【当前用户自己】的 AI 历史会话（对应左侧「历史会话」面板的数据）。
 *              默认列清单（标题、消息数、创建/更新时间）；传 conversation_id 读取该会话最近的消息（内容截断）。
 *              数据隔离：只能看到登录用户本人的会话，无法读取他人会话。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "我之前都问过什么？"                           → {}
 *   - "有没有聊过天气相关的"                          → { keyword: '天气' }
 *   - "打开刚才那个会话看看"                          → { conversation_id: 'xxx' }
 */
export const queryConversationsTool: ToolImpl = {
  name: 'query_conversations',
  description:
    '查询当前用户自己的 AI 历史会话记录（即左侧「历史会话」的数据）。'
    + '不传 conversation_id 时列出会话清单（标题、消息数、创建/更新时间），可用 keyword 按标题过滤；'
    + '传 conversation_id 返回该会话最近的消息（内容会截断）。'
    + '只能查询当前登录用户本人的会话，无法读取他人会话；只读，不能新建/删除会话。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '按会话标题模糊过滤',
      },
      conversation_id: {
        type: 'string',
        description: '会话 ID；传入则读取该会话的消息，不传则列清单',
      },
      limit: {
        type: 'number',
        description: '清单模式返回条数，默认 20，最大 50',
      },
    },
  },
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const email = ctx.userEmail;
    if (!email) {
      return { ok: false, data: '无法识别当前用户，不能查询会话' };
    }

    // ── 读取单个会话 ──
    const convId = typeof args.conversation_id === 'string' ? args.conversation_id.trim() : '';
    if (convId) {
      const conv = await readConversation(email, convId);
      if (!conv) {
        const own = await listConversations(email);
        return {
          ok: false,
          data: `会话不存在或无权限：${convId}。你的会话共 ${own.length} 个，不传 conversation_id 可列清单`,
        };
      }
      const messages = conv.messages.slice(-MAX_MESSAGES).map((m) => ({
        role: m.role,
        content: truncate(typeof m.content === 'string' ? m.content : ''),
        created_at: m.created_at ? toTime(m.created_at) : '',
      }));
      return {
        ok: true,
        data: {
          id: conv.id,
          title: conv.title,
          total_messages: conv.messages.length,
          returned: messages.length,
          messages,
        },
        summary: `会话「${conv.title}」共 ${conv.messages.length} 条消息，返回最近 ${messages.length} 条`,
      };
    }

    // ── 清单模式 ──
    const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';
    const limit = Math.min(Math.max(Number(args.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const all = await listConversations(email);
    const matched = all.filter((c) => (kw ? (c.title ?? '').toLowerCase().includes(kw) : true));
    const list = matched.slice(0, limit).map((c) => ({
      id: c.id,
      title: c.title,
      message_count: c.message_count,
      created_at: toTime(c.created_at),
      updated_at: toTime(c.updated_at),
    }));

    return {
      ok: true,
      data: {
        conversations: list,
        total: matched.length,
        returned: list.length,
      },
      summary: matched.length === 0
        ? '没有匹配的历史会话'
        : `历史会话共 ${matched.length} 个，返回 ${list.length} 个`,
    };
  },
};
