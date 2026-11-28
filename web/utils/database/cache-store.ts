/**
 * 缓存 JSON 访问层
 * @description 所有缓存键按 sql/ 里已有的业务表读写（见 cache-tables.ts）：
 *   api_responses/*.json 走 hp_cache_res_* 分类表，其余业务键走对应结构化表，
 *   没有对应表的键走 hp_cache_res_other；不新建任何表。对外保持原有函数签名。
 */
import {
  deleteTableKey,
  listTableEntries,
  readTableBody,
  tableKeyExists,
  writeTableBody,
} from './cache-tables';
import { ensureCacheTables, normalizeCacheKey } from './cache-routing';
import type { CacheEntryInfo } from '@/types/cache';

export { normalizeCacheKey } from './cache-routing';

/**
 * 确保分类表存在
 * @returns {Promise<void>}
 * @description 保留旧导出名
 */
export const ensureCacheStoreTable = async (): Promise<void> => ensureCacheTables();

/**
 * 读取缓存条目原始全文
 * @param {string} key - 缓存键
 * @returns {Promise<string | null>} 原始内容，不存在时返回 null
 */
export const readCacheBody = async (key: string): Promise<string | null> => {
  normalizeCacheKey(key);
  return readTableBody(key);
};

/**
 * 读取并解析缓存 JSON
 * @param {string} key - 缓存键
 * @returns {Promise<T | null>} 解析结果，不存在或格式错误时返回 null
 */
export const readCacheJson = async <T>(key: string): Promise<T | null> => {
  const body = await readCacheBody(key);
  if (body === null || body === '') return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
};

/**
 * 写入缓存条目原始全文
 * @param {string} key - 缓存键
 * @param {string} body - 原始内容（JSON 或文本）
 * @returns {Promise<void>}
 */
export const writeCacheBody = async (key: string, body: string): Promise<void> => {
  normalizeCacheKey(key);
  await writeTableBody(key, body);
};

/**
 * 写入缓存 JSON
 * @param {string} key - 缓存键
 * @param {unknown} value - 待序列化的值
 * @returns {Promise<void>}
 */
export const writeCacheJson = async (key: string, value: unknown): Promise<void> =>
  writeCacheBody(key, JSON.stringify(value, null, 2));

/**
 * 删除缓存条目
 * @param {string} key - 缓存键
 * @returns {Promise<void>}
 */
export const deleteCacheKey = async (key: string): Promise<void> => {
  normalizeCacheKey(key);
  await deleteTableKey(key);
};

/**
 * 判断缓存条目是否存在
 * @param {string} key - 缓存键
 * @returns {Promise<boolean>} 存在返回 true
 */
export const cacheKeyExists = async (key: string): Promise<boolean> => {
  normalizeCacheKey(key);
  return tableKeyExists(key);
};

/**
 * 列出指定前缀的缓存键
 * @param {string} prefix - 键前缀（空串表示全部）
 * @returns {Promise<string[]>} 排序后的键列表
 */
export const listCacheKeys = async (prefix: string = ''): Promise<string[]> =>
  (await listTableEntries())
    .map((item) => item.key)
    .filter((key) => key.startsWith(prefix))
    .sort();

/**
 * 列出全部缓存条目信息
 * @returns {Promise<CacheEntryInfo[]>} 按更新时间倒序
 */
export const listCacheEntries = async (): Promise<CacheEntryInfo[]> =>
  (await listTableEntries() as CacheEntryInfo[]).sort((a, b) => b.updatedAt - a.updatedAt);
