/**
 * 运行日志入库类型
 * @description hp_run_logs 是全系统日志的唯一持久化落点：脚本、Web console、
 *   HTTP 访问日志、AI 运行追踪统一写入该表，不再产生任何日志文件。
 */

/** 一条待入库的运行日志 */
export interface RunLogEntry {
  /** 发生时间（YYYY-MM-DD HH:mm:ss[.SSS]），省略时按 ts_ms / 当前时间推导 */
  logged_at?: string;
  /** 原始毫秒时间戳 */
  ts_ms?: number;
  /** 级别：DEBUG/INFO/WARNING/ERROR 等 */
  level: string;
  /** 来源类型：script/web/access/daemon/ai/system */
  source_type: string;
  /** 来源标识，如 reminder_daemon / web_server / web_access */
  source: string;
  /** 日志正文；访问日志等无法结构化的内容按原文整块入库 */
  message: string;
  /** 结构化上下文 JSON */
  context?: string;
  /** 调用位置（脚本:行号） */
  caller?: string;
  /** 主机名 */
  hostname?: string;
  /** 进程 ID */
  pid?: number;
  /** 链路 ID */
  trace_id?: string;
  /** 关联用户 */
  user?: string;
}

/** 从库里读出的一行日志 */
export interface RunLogRow {
  /** 自增主键 */
  id: number;
  /** 发生时间 */
  logged_at: string;
  /** 原始毫秒时间戳 */
  ts_ms: number | null;
  /** 级别 */
  level: string;
  /** 来源类型 */
  source_type: string;
  /** 来源标识 */
  source: string;
  /** 日志正文 */
  message: string;
  /** 结构化上下文 JSON */
  context: string | null;
  /** 调用位置 */
  caller: string | null;
  /** 主机名 */
  hostname: string | null;
  /** 进程 ID */
  pid: number | null;
}

/** 按来源聚合出的统计信息 */
export interface RunLogSourceStat {
  /** 来源标识 */
  source: string;
  /** 记录条数 */
  rows: number;
  /** 正文总字节数（供页面展示体积） */
  bytes: number;
  /** 最近一条日志的时间（YYYY-MM-DD HH:mm:ss） */
  latest: string;
}

/** 日志默认保留天数（可由 .env 的 LOG_RETENTION_DAYS 覆盖） */
export const DEFAULT_LOG_RETENTION_DAYS = 15;
