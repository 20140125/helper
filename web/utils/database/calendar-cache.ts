/**
 * 日历 / 每日数据 / API 响应归档的 KV 查询薄封装
 *
 * 设计说明：
 *   - 这些文件已迁入缓存分表（已有业务表 / hp_cache_res_*），运行时通过 cache-store 读 KV，不再读磁盘文件；
 *   - 查询函数保留原有返回结构（含 api_responses/ 前缀键的剥离与排序）；
 *   - 结构化镜像表与文件 mtime 水位同步已下线，sync / diff 仅保留导出名与「无差异」兼容结构。
 */
import {
  readCacheBody,
  readCacheJson,
  listCacheKeys,
  listCacheEntries,
  normalizeCacheKey,
} from './cache-store';

/** API 响应归档在 KV 里的键前缀（相对 .cache 的路径） */
const API_PREFIX = 'api_responses/';

/** 每日数据文件的键前缀 */
const DAILY_PREFIX = 'daily_data_';

/** 文件与数据库的差异报告（保留兼容结构，恒为「无差异」） */
export interface CalendarCacheDiff {
  file: { total: number; api: number; daily: number; mtime: number };
  db: { total: number; api: number; daily: number };
  stale: boolean;
}

/** 镜像表的一行（保留兼容结构） */
export interface CalendarCacheEntry {
  body: string;
  updatedAt: number;
}

/** 零值入库条数（sync / diff 共用） */
const zeroCounts = (): { total: number; api: number; daily: number } => ({
  total: 0, api: 0, daily: 0,
});

/**
 * 从 KV 全量重建查询镜像表
 * @returns {Promise<{ total: number; api: number; daily: number }>} 入库条数
 * @description 缓存分表即真源本身，无需再重建镜像；保留导出名与签名，返回零值
 */
export const syncCalendarCacheFromFiles = async (): Promise<{ total: number; api: number; daily: number }> =>
  zeroCounts();

/**
 * 文件有更新时自动同步查询镜像
 * @returns {Promise<void>}
 * @description KV 为唯一真源，不存在文件 mtime 水位；保留导出名为 no-op，供既有调用方 await
 */
export const syncCalendarCacheIfStale = async (): Promise<void> => {
  // 真源在库，无需按文件水位触发同步
};

/**
 * 统计文件与镜像表的差异
 * @returns {Promise<CalendarCacheDiff>} 差异报告
 * @description 恒返回「无差异」结构：file 与 db 计数一致且不 stale
 */
export const collectCalendarCacheDiff = async (): Promise<CalendarCacheDiff> => ({
  file: { total: 0, api: 0, daily: 0, mtime: 0 },
  db: zeroCounts(),
  stale: false,
});

/**
 * 判断镜像是否需要同步
 * @param {CalendarCacheDiff} diff - 差异报告
 * @returns {boolean} 数量不一致或标记为 stale 时返回 true
 */
export const hasCalendarCacheDiff = (diff: CalendarCacheDiff): boolean =>
  diff.stale || diff.file.total !== diff.db.total
  || diff.file.api !== diff.db.api || diff.file.daily !== diff.db.daily;

/**
 * 读取 KV 里的原始文件条目
 * @param {string} key - 相对 .cache 的文件键
 * @returns {Promise<CalendarCacheEntry | null>} 条目，键不存在时返回 null
 */
export const readCalendarCacheEntry = async (key: string): Promise<CalendarCacheEntry | null> => {
  const body = await readCacheBody(key);
  if (body === null) return null;
  const normalized = normalizeCacheKey(key);
  const entries = await listCacheEntries();
  const updatedAt = entries.find((entry) => entry.key === normalized)?.updatedAt ?? 0;
  return { body, updatedAt };
};

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
