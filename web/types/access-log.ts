/**
 * Access Log 类型定义
 * @description HTTP 访问日志与 console 运行日志的条目结构。
 *   两者都不再落盘：由 utils/access-log/rotation.ts 转成 hp_run_logs 记录后入库。
 */

/** console 日志级别 */
export type ConsoleLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** 一条 console 日志条目（入库前的中间结构） */
export interface ConsoleLogEntry {
  /** 时间戳（ms） */
  ts: number;
  /** 可读时间（YYYY-MM-DD HH:MM:SS），直接作为 logged_at 入库 */
  time: string;
  /** 级别 */
  level: ConsoleLogLevel;
  /** 文本消息（多个字符串参数已用空格拼接） */
  message: string;
  /** 非字符串参数（对象 / Error 等，已做深度裁剪） */
  args: unknown[];
}
