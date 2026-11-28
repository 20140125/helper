/**
 * AI 回话管理页查询
 * @description 只读查询 hp_ai_run_traces / hp_ai_messages / hp_ai_conversations；
 *   列表不返回 steps（逐轮明细只在详情接口读取），避免分页请求传输大 JSON。
 */

import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import type { AgentRunTrace } from '@/types/ai-chat';
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

/** 详情「完整会话」最多返回的消息条数（防护性上限，正常应能覆盖全部历史） */
const MESSAGE_LIMIT = 5000;

/** 运行窗口前后容差（ms） */
const RUN_WINDOW_TOLERANCE_MS = 5000;

/** 用户提问早于运行开始的最大回溯间隔（ms） */
const RUN_USER_GAP_MS = 60 * 1000;

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
 * @description user 为空表示管理员看全量；keyword 对运行 ID、会话 ID、用户、模型与错误做模糊匹配；
 *   默认只保留有落盘回话的运行，避免中断/未写回的空跑占满列表。
 */
const buildRunConditions = (
  query: AiChatAdminRunQuery,
): { where: string; params: Array<string | number> } => {
  const conditions = ['t.started_at >= ?', 't.started_at <= ?'];
  const params: Array<string | number> = [query.from, query.to];
  if (query.user) {
    conditions.push('t.`user` = ?');
    params.push(query.user);
  }
  if (query.keyword) {
    conditions.push('(t.run_id LIKE ? OR t.conversation_id LIKE ? OR t.`user` LIKE ? OR t.model LIKE ? OR t.error LIKE ?)');
    const pattern = `%${query.keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (query.onlyWithMessages !== false) {
    conditions.push(`EXISTS (
      SELECT 1 FROM hp_ai_messages m
      WHERE m.conversation_id = t.conversation_id
        AND m.created_at > 0
        AND m.created_at >= t.started_at - ?
        AND m.created_at <= t.ended_at + ?
    )`);
    params.push(RUN_WINDOW_TOLERANCE_MS, RUN_WINDOW_TOLERANCE_MS);
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
    `SELECT COUNT(*) AS total FROM hp_ai_run_traces t WHERE ${where}`,
    params,
  );
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT ${RUN_COLUMNS} FROM hp_ai_run_traces t WHERE ${where} ORDER BY t.started_at DESC LIMIT ? OFFSET ?`,
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
 * 截取本次运行产生的消息
 * @param {AiChatAdminMessage[]} messages - 会话全量消息（按 seq 升序）
 * @param {AgentRunTrace} trace - 运行追踪
 * @returns {AiChatAdminMessage[]} 本次提问到本轮回复之间的消息；没有落盘消息时返回空数组
 * @description 同一会话累积多次运行，返回全量消息会让每次详情都看到同一批历史。
 *   先取运行时间窗内的消息作为「本次确实落盘」的证据，再往前补一条提问消息；
 *   窗口内无消息的运行（中断 / 未写回）直接返回空，绝不回退到上一轮造成重复。
 */
const sliceRunMessages = (messages: AiChatAdminMessage[], trace: AgentRunTrace): AiChatAdminMessage[] => {
  const lower = trace.started_at - RUN_WINDOW_TOLERANCE_MS;
  const upper = trace.ended_at + RUN_WINDOW_TOLERANCE_MS;
  const core = messages.filter((message) => message.created_at > 0
    && message.created_at >= lower
    && message.created_at <= upper);
  if (core.length === 0) return [];

  const firstCore = core[0];
  const lastCore = core[core.length - 1];
  let startIndex = messages.findIndex((message) => message.seq === firstCore.seq);
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.created_at > 0 && candidate.created_at < trace.started_at - RUN_USER_GAP_MS) break;
    if (candidate.role === 'user') {
      startIndex = index;
      break;
    }
  }
  const endIndex = messages.findIndex((message) => message.seq === lastCore.seq);
  return messages.slice(startIndex, endIndex + 1);
};

/**
 * 查询单次运行的完整详情
 * @param {string} runId - 运行 ID
 * @param {string} [user] - 限定用户邮箱；传入后非本人记录直接返回 null
 * @param {string} [messageScope] - run=仅本次运行消息，conversation=完整会话消息
 * @returns {Promise<AiChatAdminRunDetail | null>} 追踪、会话信息与消息流水
 * @description 逐轮 steps 含每轮 token 用量与工具调用明细；默认只回传本次运行消息，避免重复历史
 */
export const getAiChatAdminRunDetail = async (
  runId: string,
  user?: string,
  messageScope: string = 'run',
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
    messages: messageScope === 'conversation' ? messages : sliceRunMessages(messages, trace),
  };
};
