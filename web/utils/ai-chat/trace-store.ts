/**
 * 贾维斯运行追踪存储
 * @description 成本 / 延迟 / 工具失败率分析的数据源，统一写入数据库 hp_ai_run_traces 表，
 *   运行时不再读写 .cache 下的 JSONL 文件。
 */

import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import {
  AI_TRACE_KEEP_MONTHS,
  type AgentRunTrace,
  type TraceQuery,
} from '@/types/ai-chat';

/** 入库语句（参数化） */
const INSERT_SQL = [
  'INSERT INTO hp_ai_run_traces',
  '(run_id, `user`, conversation_id, model, started_at, ended_at, duration_ms, iterations,',
  ' prompt_tokens, completion_tokens, total_tokens, tool_calls, tool_failures,',
  ' planning_enabled, reflections, cost_cny, error, steps)',
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
].join(' ');

/** 尚未完成的写入，供进程退出前排空 */
const pending = new Set<Promise<void>>();

/** 失败只告警一次 */
let warned = false;

/** 一天的毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 记录一次写入失败
 * @param {unknown} err - 异常对象
 * @description 用 stderr 而非 console.*，避免与 console 日志捕获互相触发
 */
const warnOnce = (err: unknown): void => {
  if (warned) return;
  warned = true;
  const reason = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[ai-trace] 入库失败：${reason}\n`);
};

/**
 * 追加一条运行追踪
 * @param {AgentRunTrace} trace - 运行追踪记录
 * @returns {void}
 * @description 异步落库、失败静默，绝不阻塞 /send 响应
 */
export const appendRunTrace = (trace: AgentRunTrace): void => {
  const params: Array<string | number> = [
    trace.run_id,
    trace.user,
    trace.conversation_id,
    trace.model,
    trace.started_at,
    trace.ended_at,
    trace.duration_ms ?? 0,
    trace.iterations ?? 0,
    trace.prompt_tokens ?? 0,
    trace.completion_tokens ?? 0,
    trace.total_tokens ?? 0,
    trace.tool_calls ?? 0,
    trace.tool_failures ?? 0,
    trace.planning_enabled ? 1 : 0,
    trace.reflections ?? 0,
    trace.cost_cny ?? 0,
    trace.error ?? '',
    JSON.stringify(trace.steps ?? []),
  ];

  let task: Promise<void>;
  try {
    task = getPool()
      .execute(INSERT_SQL, params)
      .then(() => undefined)
      .catch(warnOnce)
      .finally(() => pending.delete(task));
    pending.add(task);
  } catch (err) {
    warnOnce(err);
  }
};

/**
 * 等待所有在途 Trace 写入完成
 * @returns {Promise<void>}
 */
export const flushRunTraces = async (): Promise<void> => {
  if (pending.size === 0) return;
  await Promise.allSettled(Array.from(pending));
};

/**
 * 把数据库行还原成 AgentRunTrace
 * @param {RowDataPacket} row - 查询结果行
 * @returns {AgentRunTrace} 运行追踪记录
 */
const toTrace = (row: RowDataPacket): AgentRunTrace => {
  let steps: AgentRunTrace['steps'] = [];
  try {
    steps = JSON.parse(String(row.steps ?? '[]')) as AgentRunTrace['steps'];
  } catch {
    steps = [];
  }
  return {
    run_id: String(row.run_id),
    user: String(row.user),
    conversation_id: String(row.conversation_id),
    model: String(row.model),
    started_at: Number(row.started_at),
    ended_at: Number(row.ended_at),
    duration_ms: Number(row.duration_ms),
    iterations: Number(row.iterations),
    prompt_tokens: Number(row.prompt_tokens),
    completion_tokens: Number(row.completion_tokens),
    total_tokens: Number(row.total_tokens),
    tool_calls: Number(row.tool_calls),
    tool_failures: Number(row.tool_failures),
    planning_enabled: Boolean(row.planning_enabled),
    reflections: Number(row.reflections),
    cost_cny: Number(row.cost_cny),
    error: String(row.error ?? ''),
    steps,
  };
};

/**
 * 查询运行追踪列表
 * @param {TraceQuery} query - 时间范围 / 用户 / 条数
 * @returns {Promise<AgentRunTrace[]>} 按开始时间倒序的追踪列表
 */
export const listRunTraces = async (query: TraceQuery = {}): Promise<AgentRunTrace[]> => {
  const now = Date.now();
  const from = query.from ?? now - 30 * DAY_MS;
  const to = query.to ?? now;
  const limit = query.limit ?? 500;
  const conditions = ['started_at >= ?', 'started_at <= ?'];
  const params: Array<string | number> = [from, to];
  if (query.user) {
    conditions.push('`user` = ?');
    params.push(query.user);
  }
  params.push(limit);

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT * FROM hp_ai_run_traces WHERE ${conditions.join(' AND ')} ORDER BY started_at DESC LIMIT ?`,
    params,
  );
  return rows.map(toTrace);
};

/**
 * 清理过期运行追踪
 * @param {number} [keepMonths] - 保留月数（默认 AI_TRACE_KEEP_MONTHS）
 * @returns {Promise<number>} 删除的记录数
 * @description 按 started_at 删除数据库 hp_ai_run_traces 中的过期记录
 */
export const pruneRunTraces = async (
  keepMonths: number = AI_TRACE_KEEP_MONTHS,
): Promise<number> => {
  const boundary = Date.now() - keepMonths * 30 * DAY_MS;
  const [result] = await getPool().execute<ResultSetHeader>(
    'DELETE FROM hp_ai_run_traces WHERE started_at < ?',
    [boundary],
  );
  return result.affectedRows;
};
