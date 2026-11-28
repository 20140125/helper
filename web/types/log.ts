/**
 * 运行日志来源类型
 * @description 唯一真源是 hp_run_logs；来源按 source 字段聚合，不存在日志文件、静态注册表或 key 别名。
 */

/** 日志表格默认每页条数 */
export const DEFAULT_LOG_PAGE_SIZE = 15;

/** 日志来源统计（GET /api/logs 的单个条目） */
export interface LogSourceInfo {
  /** 库里的 source 标识，同时作为读取与清空的参数 */
  source: string;
  /** 该来源的记录条数 */
  rows: number;
  /** 正文总字节数 */
  bytes: number;
  /** 最近一条日志时间（YYYY-MM-DD HH:mm:ss），无记录时为空串 */
  latest: string;
}
