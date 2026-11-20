import fs from 'fs';
import path from 'path';
import {
  AI_TRACES_DIR,
  AI_TRACE_KEEP_MONTHS,
  type AgentRunTrace,
  type TraceQuery,
} from '@/types/ai-chat';

/**
 * 取时间戳对应的月份文件绝对路径
 * @param {number} ts - 时间戳（ms）
 * @returns {string} 形如 .cache/ai-traces/2026-10.jsonl 的路径
 */
const monthFile = (ts: number): string => {
  const d = new Date(ts);
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return path.join(AI_TRACES_DIR, `${month}.jsonl`);
};

/**
 * 确保 Trace 目录存在
 * @returns {void}
 */
const ensureDir = (): void => {
  if (!fs.existsSync(AI_TRACES_DIR)) {
    fs.mkdirSync(AI_TRACES_DIR, { recursive: true });
  }
};

/**
 * 列出查询时间范围内涉及的全部月份文件（按时间倒序）
 * @param {TraceQuery} query - 查询条件
 * @returns {string[]} 已存在的月份文件路径
 */
const resolveMonthFiles = (query: TraceQuery): string[] => {
  if (!fs.existsSync(AI_TRACES_DIR)) return [];
  const now = Date.now();
  const from = query.from ?? now - 30 * 24 * 3600 * 1000;
  const to = query.to ?? now;
  const files: string[] = [];
  const cursor = new Date(from);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= to) {
    const file = monthFile(cursor.getTime());
    if (fs.existsSync(file) && !files.includes(file)) files.push(file);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return files.reverse();
};

/**
 * 追加一条运行 Trace（append-only，每行一个 JSON）
 * @param {AgentRunTrace} trace - 运行追踪记录
 * @returns {void}
 */
export const appendRunTrace = (trace: AgentRunTrace): void => {
  try {
    ensureDir();
    fs.appendFileSync(monthFile(trace.started_at), `${JSON.stringify(trace)}\n`, 'utf-8');
  } catch (err) {
    // Trace 落盘失败不能影响主链路，只记录日志
    console.warn(`[ai-trace] 写入失败：${(err as Error).message}`);
  }
};

/**
 * 查询运行 Trace 列表
 * @param {TraceQuery} query - 查询条件（时间倒序返回）
 * @returns {AgentRunTrace[]} 命中的 Trace 列表
 */
export const listRunTraces = (query: TraceQuery = {}): AgentRunTrace[] => {
  const now = Date.now();
  const from = query.from ?? now - 30 * 24 * 3600 * 1000;
  const to = query.to ?? now;
  const limit = query.limit ?? 500;
  const traces: AgentRunTrace[] = [];

  for (const file of resolveMonthFiles({ ...query, from, to })) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const trace = JSON.parse(line) as AgentRunTrace;
        if (query.user && trace.user !== query.user) continue;
        if (trace.started_at < from || trace.started_at > to) continue;
        traces.push(trace);
      } catch {
        // 损坏行忽略
      }
    }
  }

  traces.sort((a, b) => b.started_at - a.started_at);
  return traces.slice(0, limit);
};

/**
 * 清理过期的月份 Trace 文件
 * @param {number} [keepMonths] - 保留月数（默认 AI_TRACE_KEEP_MONTHS）
 * @returns {string[]} 被删除的文件名列表
 * @description 与 api_responses 归档同策略：历史数据对排障无意义，只留近期窗口；
 *   删除前先按文件名排序，保证只删最老的几个月。
 */
export const pruneTraceFiles = (keepMonths: number = AI_TRACE_KEEP_MONTHS): string[] => {
  if (!fs.existsSync(AI_TRACES_DIR)) return [];
  const files = fs.readdirSync(AI_TRACES_DIR).filter((f) => f.endsWith('.jsonl')).sort();
  if (files.length <= keepMonths) return [];
  const removed: string[] = [];
  for (const file of files.slice(0, files.length - keepMonths)) {
    try {
      fs.unlinkSync(path.join(AI_TRACES_DIR, file));
      removed.push(file);
    } catch {
      // 删除失败忽略
    }
  }
  return removed;
};
