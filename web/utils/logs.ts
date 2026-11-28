/**
 * 日志查询工具
 * @description 运行日志页、贾维斯 query_logs / manage_logs 的统一入口。
 *   所有读取与清空都落在 hp_run_logs，不再 stat/tail/清空任何日志文件。
 */

import { LOG_SOURCES, LOG_SOURCE_OFFSETS, type LogFileInfo } from '@/types/log';
import {
  listRunLogSources,
  readRunLogRows,
  renderRunLogRows,
  clearRunLogs,
} from '@/utils/run-log';

/** 动态来源的合法 key 形态（库里出现的新模块也要能被查看） */
const SAFE_SOURCE_KEY = /^[a-z0-9_-]+$/;

/**
 * 把日志 key 解析成库里的 source
 * @param key - 日志标识
 * @returns 来源标识
 */
const sourceOf = (key: string): string => LOG_SOURCES[key] ?? key;

/**
 * 判断日志 key 是否可查询
 * @param key - 日志标识
 * @returns 已注册或为合法来源名时返回 true
 * @description 来源名最终走参数化 SQL，不参与拼接，允许库里新出现的模块直接按字面 key 查询
 */
export const isLogKeyValid = (key: string): boolean =>
  Boolean(LOG_SOURCES[key]) || SAFE_SOURCE_KEY.test(key);

/**
 * 列出所有日志来源
 * @returns {Promise<LogFileInfo[]>} 已注册来源 + 库里新出现的来源，按最近写入时间倒序
 */
export const listLogFiles = async (): Promise<LogFileInfo[]> => {
  const stats = await listRunLogSources();
  const statMap = new Map(stats.map((item) => [item.source, item]));
  const keys = Object.keys(LOG_SOURCES);
  // 库里出现但注册表里没有的 source 也列出来，保证「所有日志」都能在页面上看到
  stats.forEach((item) => {
    if (!LOG_SOURCES[item.source] && !keys.includes(item.source)) keys.push(item.source);
  });

  const list = keys.map((key) => {
    const source = sourceOf(key);
    const stat = statMap.get(source);
    const mtime = stat?.latest || null;
    return {
      key,
      filename: `hp_run_logs:${source}`,
      exists: (stat?.rows ?? 0) > 0,
      size: stat?.bytes ?? 0,
      mtime,
      mtimeMs: mtime ? Date.parse(mtime.replace(' ', 'T')) || 0 : 0,
    };
  });

  return list
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map(({ mtimeMs: _mtimeMs, ...rest }) => rest as LogFileInfo);
};

/**
 * 读取指定来源末尾 N 条日志
 * @param key - 日志标识
 * @param lines - 读取条数
 * @returns 文本内容 / 尚无记录 / 读取失败
 * @description 统一渲染成 [时间] [级别] 正文；访问日志保留原有文本区块格式
 */
export const readLogTail = async (
  key: string,
  lines: number,
): Promise<{ content: string } | { missing: true } | { error: string }> => {
  try {
    const rows = await readRunLogRows(sourceOf(key), lines, LOG_SOURCE_OFFSETS[key] ?? 0);
    if (rows.length === 0) return { missing: true };
    return { content: renderRunLogRows(rows) };
  } catch (err) {
    return { error: (err as Error).message };
  }
};

/**
 * 清空指定来源的日志记录
 * @param key - 日志标识
 * @returns {Promise<number>} 删除的记录数
 */
export const clearLogFile = async (key: string): Promise<number> =>
  clearRunLogs(sourceOf(key));
