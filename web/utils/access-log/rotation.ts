/**
 * 日志流落地适配
 * @description 把两条日志流（console / access）转成结构化条目后交给 run-log 入库。
 *   原先的「按天归档 + 超期清理 + 单文件超限切分」整套文件轮转已移除：
 *   日志唯一落点是 hp_run_logs，保留期由数据库清理任务统一控制。
 */

import os from 'os';
import { insertRunLog } from '@/utils/run-log';
import type { ConsoleLogEntry } from '@/types/access-log';

/** 日志流标识 */
export type LogStream = 'access' | 'console';

/** console 原始级别 → 统一级别 */
const LEVEL_MAP: Record<string, string> = {
  log: 'INFO',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  debug: 'DEBUG',
};

/**
 * 从访问日志区块里提取可检索的元信息
 * @param {string} block - 中间件格式化出的文本区块
 * @returns {Record<string, string | number>} 请求方法、路径、状态等
 */
const parseAccessMeta = (block: string): Record<string, string | number> => {
  const lines = block.split('\n');
  const header = lines.find((line) => line.includes('▸')) ?? '';
  const meta = lines.find((line) => line.includes('用户:')) ?? '';
  const match = (text: string, pattern: RegExp): string => pattern.exec(text)?.[1] ?? '';
  const method = match(header, /▸\s+\S+\s+\S+\s+(\S+)\s+/);
  const url = match(header, /▸\s+\S+\s+\S+\s+\S+\s+(\S+)/);
  const user = match(meta, /用户:\s*(\S+)/);
  const status = Number(match(meta, /状态:\s*(\d+)/)) || 0;
  const durationMs = Number(match(meta, /耗时:\s*(\d+)ms/)) || 0;
  return { method, url, user, status, duration_ms: durationMs };
};

/**
 * 写入一条日志
 * @param {string} block - console 为单行 JSON；access 为文本区块
 * @param {LogStream} stream - 日志流标识，默认 access
 * @returns {void}
 * @description 保持同步 void 签名，console 劫持与 res.json 包装无需改成异步；
 *   异常一律吞掉并写 stderr，绝不因日志失败影响业务。
 */
export const appendLog = (block: string, stream: LogStream = 'access'): void => {
  try {
    const common = { hostname: os.hostname(), pid: process.pid };
    if (stream === 'console') {
      const entry = JSON.parse(block) as ConsoleLogEntry;
      insertRunLog({
        ...common,
        logged_at: entry.time,
        ts_ms: entry.ts,
        level: LEVEL_MAP[entry.level] ?? entry.level.toUpperCase(),
        source_type: 'web',
        // 启动器是独立进程，用自己的来源名，避免和主服务日志混在一起
        source: process.env.LOG_CONSOLE_SOURCE || 'web_server',
        message: entry.message,
        context: JSON.stringify(entry.args ?? []),
      });
      return;
    }
    insertRunLog({
      ...common,
      level: 'INFO',
      source_type: 'access',
      source: 'web_access',
      message: block,
      context: JSON.stringify(parseAccessMeta(block)),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[access-log] 日志入库失败：${reason}\n`);
  }
};
