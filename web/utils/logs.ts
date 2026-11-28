/**
 * 日志来源查询与清理
 * @description 全部基于 hp_run_logs.source，按库里实际存在的来源读取与清空；
 *   不再有日志文件、静态注册表、key 别名或历史归档偏移。
 */

import type { LogSourceInfo } from '@/types/log';
import {
  listRunLogSources,
  readRunLogRows,
  renderRunLogRows,
  clearRunLogs,
} from '@/utils/run-log';

/** 合法来源名形态（与库里 source 字段一致，仅用于拦截异常入参） */
const SAFE_SOURCE = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * 判断来源名是否可查询
 * @param {string} source - hp_run_logs.source 原值
 * @returns {boolean} 形态合法时返回 true
 * @description 来源名最终走参数化 SQL；不再依赖静态白名单，库里出现的新模块可直接查询
 */
export const isLogSourceValid = (source: string): boolean => SAFE_SOURCE.test(source);

/**
 * 列出库里实际存在的日志来源
 * @returns {Promise<LogSourceInfo[]>} 按最近写入时间倒序的来源统计
 * @description 直接来自 SELECT ... GROUP BY source，来源不在库里就不会出现在列表中
 */
export const listLogSources = async (): Promise<LogSourceInfo[]> => {
  const stats = await listRunLogSources();
  return stats
    .map(({ source, rows, bytes, latest }) => ({ source, rows, bytes, latest }))
    .sort((a, b) => b.latest.localeCompare(a.latest));
};

/**
 * 读取指定来源末尾 N 条日志
 * @param {string} source - hp_run_logs.source 原值
 * @param {number} lines - 读取条数
 * @returns {Promise<{ content: string } | { missing: true } | { error: string }>} 渲染后的日志文本
 * @description 统一渲染成 [时间] [级别] 正文；访问日志保留原有文本区块格式
 */
export const readSourceLogRows = async (
  source: string,
  lines: number,
): Promise<{ content: string } | { missing: true } | { error: string }> => {
  try {
    const rows = await readRunLogRows(source, lines);
    if (rows.length === 0) return { missing: true };
    return { content: renderRunLogRows(rows) };
  } catch (err) {
    return { error: (err as Error).message };
  }
};

/**
 * 清空指定来源的库记录
 * @param {string} source - hp_run_logs.source 原值
 * @returns {Promise<number>} 删除的记录数
 */
export const clearLogSource = async (source: string): Promise<number> => clearRunLogs(source);
