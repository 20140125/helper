import type { ApiResponse } from './api';
import { useLocaleStore } from '@/stores/locale';

/** 日志来源统计（GET /api/logs 的单个条目，数据来自 hp_run_logs 按 source 聚合） */
export interface LogSourceInfo {
  /** 库里的 source 标识，同时作为读取与清空的参数 */
  source: string;
  /** 该来源的记录条数 */
  rows: number;
  /** 正文总字节数 */
  bytes: number;
  /** 最近一条日志时间，无记录时为空串 */
  latest: string;
}

/**
 * 获取当前语言的来源标签字典
 * @description 直接取 hp_i18n_messages 中的 logs.labels.*；未配置翻译的来源显示库里的 source 原值，
 *   随语言切换自动变化，在 Model/Component 中通过 `computed(() => getLogLabels())` 使用
 * @returns {Record<string, string>} source → 显示名
 */
export function getLogLabels(): Record<string, string> {
  const localeStore = useLocaleStore();
  return localeStore.t?.logs?.labels ?? {};
}

/** 获取日志来源列表响应 */
export type LogsResponse = ApiResponse<{ logs: LogSourceInfo[] }>;

/** 获取日志内容响应 */
export type LogContentResponse = ApiResponse<{ content: string }>;

/** 日志操作结果（无数据返回） */
export type LogResult = ApiResponse;

/** 一条运行日志记录 */
export interface LogRow {
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

/** 日志详情（在列表字段基础上补充链路与用户信息） */
export interface LogDetail extends LogRow {
  /** 链路 ID */
  trace_id: string | null;
  /** 关联用户 */
  user: string | null;
}

/** 日志列表查询参数 */
export interface LogRowsParams {
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 来源标识 */
  source?: string;
  /** 来源类型 */
  sourceType?: string;
  /** 级别 */
  level?: string;
  /** 正文关键词 */
  keyword?: string;
}

/** 分页日志列表响应 */
export type LogRowsResponse = ApiResponse<{
  items: LogRow[];
  total: number;
  page: number;
  pageSize: number;
}>;

/** 日志详情响应 */
export type LogDetailResponse = ApiResponse<{ row: LogDetail | null }>;