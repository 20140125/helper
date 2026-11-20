/**
 * Access Log 类型定义
 * @description HTTP 访问日志与 console 运行日志的落盘结构与目录常量。
 *   console 日志以 JSONL 落盘（每行一个 JSON），便于后续按时间 / 级别 / 关键字检索；
 *   与 web_access 共用一套「按天归档 + 超期清理」策略。
 */

import path from 'path';
import { RUNTIME_DIR } from '@/utils/paths';

/**
 * console 日志当前写入文件（JSONL：每行一条 JSON）
 * @description 与 types/web-service.ts 的 WEB_LOG_FILE 指向同一个文件，是 Web 服务日志的
 *   **唯一真源**：日志查看器页面直接读它并渲染成文本，不再另存一份纯文本副本。
 */
export const CONSOLE_LOG_FILE = path.join(RUNTIME_DIR, 'web_server.jsonl');

/** console 日志按天归档目录 */
export const CONSOLE_LOG_DIR = path.join(RUNTIME_DIR, 'logs');

/** console 归档文件名前缀 */
export const CONSOLE_LOG_PREFIX = 'web_server-';

/** console 归档文件名后缀 */
export const CONSOLE_LOG_SUFFIX = '.jsonl';

/** console 归档保留天数（与 web_access 对齐，超过则删除） */
export const CONSOLE_LOG_RETENTION_DAYS = 5;

/** console 日志级别 */
export type ConsoleLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** 一条 console 日志条目（落盘结构） */
export interface ConsoleLogEntry {
  /** 时间戳（ms） */
  ts: number;
  /** 可读时间（YYYY-MM-DD HH:MM:SS） */
  time: string;
  /** 级别 */
  level: ConsoleLogLevel;
  /** 文本消息（多个字符串参数已用空格拼接） */
  message: string;
  /** 非字符串参数（对象 / Error 等，已做深度裁剪） */
  args: unknown[];
}

/** console 日志查询条件 */
export interface ConsoleLogQuery {
  /** 起始时间戳（ms），默认最近 24 小时 */
  from?: number;
  /** 结束时间戳（ms），默认当前 */
  to?: number;
  /** 级别过滤，不传则不过滤 */
  level?: ConsoleLogLevel;
  /** 消息关键字（大小写不敏感） */
  keyword?: string;
  /** 返回条数上限，默认 500 */
  limit?: number;
}
