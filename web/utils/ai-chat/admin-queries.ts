/**
 * AI 回话管理页查询
 * @description 只读查询 hp_ai_run_traces / hp_ai_messages / hp_ai_conversations；
 *   列表不返回 steps（逐轮明细只在详情接口读取），避免分页请求传输大 JSON。
 */

import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { parseTraceRow } from './trace-store';
import type {
  AiChatAdminMessage,
  AiChatAdminRunDetail,
  AiChatAdminRunPage,
  AiChatAdminRunQuery,
  AiChatAdminRunRow,
} from '@/types/ai-chat-admin';

/** 列表返回的列（与 toRunRow 的字段顺序对应） */
const RUN_COLUMNS = [
  'run_id', '`user`', 'conversation_id', 'model', 'started_at', 'duration_ms',
  'iterations', 'prompt_tokens', 'completion_tokens', 'total_tokens',
  'tool_calls', 'tool_failures', 'cost_cny', 'error',
].join(', ');

/** 详情最多返回的消息条数 */
const MESSAGE_LIMIT = 200;

/**
 * 把数据库行转换成列表条目
 * @param {RowDataPacket} row - hp_ai_run_traces 查询结果行
 * @returns {AiChatAdminRunRow} 列表条目
 */
const toRunRow = (row: RowDataPacket): AiChatAdminRunRow => ({
  run_id: String(row.run_id),
  user: String(row.user ?? ''),
  conversation_id: String(row.conversation_id ?? ''),
  model: String(row.model ?? ''),
  started_at: Number(row.started_at ?? 0),
  duration_ms: Number(row.duration_ms ?? 0),
  iterations: Number(row.iterations ?? 0),
  prompt_tokens: Number(row.prompt_tokens ?? 0),
  completion_tokens: Number(row.completion_tokens ?? 0),
  total_tokens: Number(row.total_tokens ?? 0),
  tool_calls: Number(row.tool_calls ?? 0),
  tool_failures: Number(row.tool_failures ?? 0),
  cost_cny: Number(row.cost_cny ?? 0),
  error: String(row.error ?? ''),
});

/**
 * 构造运行列表的公共 WHERE 条件
 * @param {AiChatAdminRunQuery} query - 查询条件
 * @returns {{ where: string; params: Array<string | number> }} SQL 条件与绑定参数
 * @description user 为空表示管理员看全量；keyword 对运行 ID、会话 ID、用户、模型与错误做模糊匹配
 */
const buildRunConditions = (
  query: AiChatAdminRunQuery,
): { where: string; params: Array<string | number> } => {
  const conditions = ['started_at >= ?', 'started_at <= ?'];
  const params: Array<string | number> = [query.from, query.to];
  if (query.user) {
    conditions.push('`user` = ?');
    params.push(query.user);
  }
  if (query.keyword) {
    conditions.push('(run_id LIKE ? OR conversation_id LIKE ? OR `user` LIKE ? OR model LIKE ? OR error LIKE ?)');
    const pattern = `%${query.keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
  return { where: conditions.join(' AND '), params };
};

/**
 * 分页查询 AI 运行记录
 * @param {AiChatAdminRunQuery} query - 时间范围、用户、关键词与分页参数
 * @returns {Promise<AiChatAdminRunPage>} 当前页记录与总条数
 * @description 按开始时间倒序；总条数用同一 WHERE 条件 COUNT，保证分页准确
 */
export const listAiChatAdminRuns = async (query: AiChatAdminRunQuery): Promise<AiChatAdminRunPage> => {
  const { where, params } = buildRunConditions(query);
  const offset = (query.page - 1) * query.pageSize;
  const [countRows] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM hp_ai_run_traces WHERE ${where}`,
    params,
  );
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT ${RUN_COLUMNS} FROM hp_ai_run_traces WHERE ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    [...params, query.pageSize, offset],
  );
  return {
    items: rows.map(toRunRow),
    total: Number(countRows[0]?.total ?? 0),
    page: query.page,
    pageSize: query.pageSize,
  };
};

/**
 * 查询单次运行的完整详情
 * @param {string} runId - 运行 ID
 * @param {string} [user] - 限定用户邮箱；传入后非本人记录直接返回 null
 * @returns {Promise<AiChatAdminRunDetail | null>} 追踪、会话信息与消息流水
 * @description 逐轮 steps 含每轮 token 用量与工具调用明细；消息流水用于对照「AI 到底回了什么」
 */
export const getAiChatAdminRunDetail = async (
  runId: string,
  user?: string,
): Promise<AiChatAdminRunDetail | null> => {
  const conditions = ['run_id = ?'];
  const params: Array<string | number> = [runId];
  if (user) {
    conditions.push('`user` = ?');
    params.push(user);
  }
  const [traceRows] = await getPool().query<RowDataPacket[]>(
    `SELECT * FROM hp_ai_run_traces WHERE ${conditions.join(' AND ')}`,
    params,
  );
  if (traceRows.length === 0) return null;
  const trace = parseTraceRow(traceRows[0]);

  const [convRows] = await getPool().query<RowDataPacket[]>(
    'SELECT id, title, `user` FROM hp_ai_conversations WHERE id = ?',
    [trace.conversation_id],
  );
  const [messageRows] = await getPool().query<RowDataPacket[]>(
    `SELECT seq, role, content, tool_calls, tool_call_id, name,
            prompt_tokens, completion_tokens, total_tokens, created_at
     FROM hp_ai_messages WHERE conversation_id = ? ORDER BY seq LIMIT ?`,
    [trace.conversation_id, MESSAGE_LIMIT],
  );
  const messages: AiChatAdminMessage[] = messageRows.map((row) => ({
    seq: Number(row.seq ?? 0),
    role: String(row.role ?? ''),
    content: String(row.content ?? ''),
    tool_calls: row.tool_calls === null ? null : String(row.tool_calls),
    tool_call_id: row.tool_call_id === null ? null : String(row.tool_call_id),
    name: row.name === null ? null : String(row.name),
    prompt_tokens: Number(row.prompt_tokens ?? 0),
    completion_tokens: Number(row.completion_tokens ?? 0),
    total_tokens: Number(row.total_tokens ?? 0),
    created_at: Number(row.created_at ?? 0),
  }));
  return {
    trace,
    conversation: {
      id: String(convRows[0]?.id ?? trace.conversation_id),
      title: String(convRows[0]?.title ?? ''),
      user: String(convRows[0]?.user ?? trace.user),
    },
    messages,
  };
};
