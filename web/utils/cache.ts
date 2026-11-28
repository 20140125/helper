/**
 * 缓存 JSON 读写工具（数据库真源）
 * @description .cache 下的全部 JSON 已迁入缓存分表，本模块只做数据库读写；
 *   保留原有函数名与参数便于调用方渐进迁移，返回值统一为 Promise，调用处需 await。
 */
import {
  cacheKeyExists,
  listCacheEntries,
  listCacheKeys,
  readCacheBody,
  writeCacheBody,
} from '@/utils/database/cache-store';
import type { CacheFileInfo } from '@/types/cache';
import { formatDate } from './script';

/** 由专用模块维护、禁止通过缓存管理页直接覆盖的键 */
export const RESERVED_CACHE_FILES = ['webhooks.json'];

/**
 * 校验缓存键是否合法
 * @param filename - 缓存键（可包含子目录路径）
 * @returns 合法返回 true，否则返回 false
 */
export const isValidFilename = (filename: string): boolean => {
  if (!filename || !filename.endsWith('.json')) return false;
  // 拒绝路径穿越、绝对路径以及反斜杠
  if (filename.includes('..') || filename.startsWith('/') || filename.includes('\\')) return false;
  return true;
};

/**
 * 列出全部对用户可见的缓存条目
 * @description 按更新时间倒序，过滤系统保留键与保留条目
 * @param _cacheDir - 兼容旧签名，忽略
 * @returns 缓存条目信息列表
 */
export const listCacheFiles = async (_cacheDir: string): Promise<CacheFileInfo[]> => {
  const entries = await listCacheEntries();
  return entries
    .filter((item) => item.key.endsWith('.json') && !RESERVED_CACHE_FILES.includes(item.key))
    .map((item) => ({
      name: item.key,
      size: item.size,
      mtime: formatDate(new Date(item.updatedAt)),
    }));
};

/**
 * 统计缓存条目总数
 * @param _cacheDir - 兼容旧签名，忽略
 * @returns 条目总数
 */
export const countCacheFiles = async (_cacheDir: string): Promise<number> => {
  const files = await listCacheFiles(_cacheDir);
  return files.length;
};

/**
 * 读取指定缓存条目内容
 * @param _cacheDir - 兼容旧签名，忽略
 * @param filename - 缓存键（已通过 isValidFilename 校验）
 * @returns 存在返回 { content }；不存在返回 { notFound: true }；失败返回 { error }
 */
export const readCacheFile = async (
  _cacheDir: string,
  filename: string,
): Promise<{ content: string } | { notFound: true } | { error: string }> => {
  try {
    const content = await readCacheBody(filename);
    if (content === null) return { notFound: true };
    return { content };
  } catch (err) {
    return { error: (err as Error).message };
  }
};

/**
 * 校验缓存写入参数
 * @param filename - 缓存键
 * @param content - 写入内容
 * @returns 校验失败时返回错误信息，通过时返回 null
 */
export const validateCacheWriteParams = (filename: string, content: unknown): string | null => {
  if (!isValidFilename(filename)) return '非法文件名';
  if (typeof content !== 'string') return '参数错误：需要 content 字符串';
  try {
    JSON.parse(content);
  } catch {
    return 'JSON 格式错误，请检查内容';
  }
  return null;
};

/**
 * 将内容写入指定缓存条目
 * @param _cacheDir - 兼容旧签名，忽略
 * @param filename - 缓存键
 * @param content - 合法的 JSON 字符串
 * @returns 条目不存在时返回错误信息，成功时返回 null
 */
export const writeCacheFile = async (
  _cacheDir: string,
  filename: string,
  content: string,
): Promise<string | null> => {
  if (!(await cacheKeyExists(filename))) return '缓存条目不存在';
  await writeCacheBody(filename, content);
  return null;
};

/**
 * 通用：读取并解析指定缓存 JSON
 * @param _cacheDir - 兼容旧签名，忽略
 * @param filename - 缓存键
 * @returns 解析结果，不存在或格式错误返回 null
 */
export const readCacheJsonFile = async (_cacheDir: string, filename: string): Promise<unknown> => {
  const content = await readCacheBody(filename);
  if (content === null || content === '') return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

/**
 * 列出 api_responses/ 下所有缓存条目
 * @param _cacheDir - 兼容旧签名，忽略
 * @returns 文件名列表
 */
export const listApiResponses = async (_cacheDir: string): Promise<string[]> => {
  const keys = await listCacheKeys('api_responses/');
  return keys
    .filter((key) => key.endsWith('.json'))
    .map((key) => key.slice('api_responses/'.length))
    .sort();
};

/**
 * 读取 api_responses/ 下的指定缓存条目
 * @param _cacheDir - 兼容旧签名，忽略
 * @param filename - 文件名（如 'weather_深圳_2026-05.json'）
 * @returns 解析后的 JSON，失败返回 null
 */
export const readApiResponse = async (_cacheDir: string, filename: string): Promise<unknown> => {
  // 防止路径穿越
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  return readCacheJsonFile(_cacheDir, `api_responses/${filename}`);
};

/**
 * 列出所有每日数据缓存条目
 * @param _cacheDir - 兼容旧签名，忽略
 * @returns 文件名列表
 */
export const listDailyDataFiles = async (_cacheDir: string): Promise<string[]> =>
  listCacheKeys('daily_data_');

/**
 * 读取指定日期的每日数据
 * @param _cacheDir - 兼容旧签名，忽略
 * @param date - 日期字符串（如 '2026-05-25'）
 * @returns 解析后的 JSON，失败返回 null
 */
export const readDailyData = async (_cacheDir: string, date: string): Promise<unknown> => {
  // 简单校验：只允许 YYYY-MM-DD 格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readCacheJsonFile(_cacheDir, `daily_data_${date}.json`);
};
