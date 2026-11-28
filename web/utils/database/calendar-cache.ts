/**
 * 日历 / 每日数据 / API 响应归档的 KV 查询薄封装
 *
 * 设计说明：
 *   - 这些文件已迁入缓存分表（已有业务表 / hp_cache_res_*），运行时通过 cache-store 读 KV，不再读磁盘文件；
 *   - 查询函数保留原有返回结构（含 api_responses/ 前缀键的剥离与排序）。
 */
import {
  readCacheBody,
  readCacheJson,
  listCacheKeys,
  listCacheEntries,
} from './cache-store';

/** API 响应归档在 KV 里的键前缀（相对 .cache 的路径） */
const API_PREFIX = 'api_responses/';

/** 每日数据文件的键前缀 */
const DAILY_PREFIX = 'daily_data_';

/**
 * 读取 KV 里的 JSON 文件
 * @param {string} key - 相对 .cache 的文件键（如 api_responses/almanac_2026-11.json）
 * @returns {Promise<unknown | null>} 解析结果，键不存在或解析失败时返回 null
 */
export const readCalendarCacheJson = async (key: string): Promise<unknown | null> =>
  readCacheJson<unknown>(key);

/**
 * 列出 KV 里指定前缀的文件键
 * @param {string} prefix - 键前缀
 * @returns {Promise<string[]>} 排序后的键列表
 */
export const listCalendarCacheKeys = async (prefix: string): Promise<string[]> =>
  listCacheKeys(prefix);

/**
 * 列出 API 响应归档文件名（不含目录）
 * @returns {Promise<string[]>} 排序后的文件名列表
 */
export const listApiResponseFilesFromDb = async (): Promise<string[]> =>
  (await listCacheKeys(API_PREFIX))
    .filter((key) => key.endsWith('.json'))
    .map((key) => key.slice(API_PREFIX.length))
    .sort();

/**
 * 列出每日数据文件名
 * @returns {Promise<string[]>} 排序后的文件名列表
 */
export const listDailyDataFilesFromDb = async (): Promise<string[]> =>
  listCacheKeys(DAILY_PREFIX);

/**
 * 一次读出全部 API 响应归档条目（供清单模式计算大小与时间）
 * @returns {Promise<Array<{ filename: string; body: string; updatedAt: number }>>} 条目列表
 * @description 按 api_responses/ 前缀批量取 KV 全文，并从条目清单读取各自更新时间
 */
export const readApiResponseEntriesFromDb = async (): Promise<
  Array<{ filename: string; body: string; updatedAt: number }>
> => {
  const keys = (await listCacheKeys(API_PREFIX))
    .filter((key) => key.endsWith('.json'))
    .sort();
  const entries = await listCacheEntries();
  const updatedMap = new Map(entries.map((entry) => [entry.key, entry.updatedAt]));
  const result: Array<{ filename: string; body: string; updatedAt: number }> = [];
  for (const key of keys) {
    const body = await readCacheBody(key);
    result.push({
      filename: key.slice(API_PREFIX.length),
      body: body ?? '',
      updatedAt: updatedMap.get(key) ?? 0,
    });
  }
  return result;
};
