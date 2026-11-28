/**
 * 缓存条目读写工具（数据库真源）
 * @description .cache 下的全部 JSON 已迁入缓存分表，本模块只做数据库读写；
 *   函数名沿用历史命名，返回值统一为 Promise，调用处需 await。
 */
import {
  cacheKeyExists,
  listCacheEntries,
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
 * @returns 缓存条目信息列表
 */
export const listCacheFiles = async (): Promise<CacheFileInfo[]> => {
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
 * @returns 条目总数
 */
export const countCacheFiles = async (): Promise<number> => {
  const files = await listCacheFiles();
  return files.length;
};

/**
 * 读取指定缓存条目内容
 * @param filename - 缓存键（已通过 isValidFilename 校验）
 * @returns 存在返回 { content }；不存在返回 { notFound: true }；失败返回 { error }
 */
export const readCacheFile = async (
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
 * @param filename - 缓存键
 * @param content - 合法的 JSON 字符串
 * @returns 条目不存在时返回错误信息，成功时返回 null
 */
export const writeCacheFile = async (
  filename: string,
  content: string,
): Promise<string | null> => {
  if (!(await cacheKeyExists(filename))) return '缓存条目不存在';
  await writeCacheBody(filename, content);
  return null;
};
