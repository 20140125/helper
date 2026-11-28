/**
 * 运行日志写入
 * @description 全系统唯一的日志持久化出口：只写 hp_run_logs，不写任何文件。
 *   写入采用连接池 + fire-and-forget，失败只往 stderr 打一次告警，
 *   绝不能因为日志链路异常影响业务请求或触发 console 捕获递归。
 */

import { getPool } from '@/utils/database/connection';
import type { RunLogEntry } from '@/types/run-log';

/** 入库语句（参数化，杜绝任何拼接注入） */
const INSERT_SQL = [
  'INSERT INTO hp_run_logs',
  '(logged_at, ts_ms, level, source_type, source, message, context, caller, hostname, pid, trace_id, `user`)',
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
].join(' ');

/** 尚未完成的写入任务，供进程退出前排空 */
const pending = new Set<Promise<void>>();

/** 失败告警只打一次，避免数据库不可用时刷屏 */
let warned = false;

/** 补零 */
const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/**
 * 把时间戳转成 MySQL DATETIME(3) 字面量（服务器本地时间，与 shell 日志一致）
 * @param {number} ms - 毫秒时间戳
 * @returns {string} 形如 2026-11-28 01:30:00.123
 */
const toMysqlDatetime = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

/**
 * 记录一次入库失败
 * @param {unknown} err - 异常对象
 * @description 必须用 process.stderr.write：console.* 已被劫持，会再次回到本模块造成递归
 */
const warnOnce = (err: unknown): void => {
  if (warned) return;
  warned = true;
  const reason = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[run-log] 日志入库失败：${reason}\n`);
};

/**
 * 写入一条运行日志
 * @param {RunLogEntry} entry - 日志条目
 * @returns {void}
 * @description 同步返回，写入在后台完成；调用方无需 await，也不会阻塞请求响应
 */
export const insertRunLog = (entry: RunLogEntry): void => {
  const tsMs = entry.ts_ms ?? Date.now();
  const loggedAt = entry.logged_at ?? toMysqlDatetime(tsMs);
  const params: Array<string | number | null> = [
    loggedAt,
    tsMs,
    entry.level,
    entry.source_type,
    entry.source,
    entry.message,
    entry.context ?? '{}',
    entry.caller ?? null,
    entry.hostname ?? null,
    entry.pid ?? null,
    entry.trace_id ?? null,
    entry.user ?? null,
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
    // DB_* 未配置等同步异常同样降级
    warnOnce(err);
  }
};

/**
 * 等待所有在途写入完成
 * @returns {Promise<void>}
 * @description 崩溃兜底与进程退出前调用，避免最后几条日志随进程一起丢失
 */
export const flushRunLogs = async (): Promise<void> => {
  if (pending.size === 0) return;
  await Promise.allSettled(Array.from(pending));
};
