import fs from 'fs';
import path from 'path';
import { formatDate } from './script';
import type { CacheFileInfo } from '@/types/cache';

/** 列表视图中应被隐藏的系统保留文件 */
export const RESERVED_CACHE_FILES = [
  'users.json',
  'webhooks.json',
  'rbac.json',
  'permission_metas.json',
  'permission_requests.json',
  'api_categories.json',
  'api_items.json',
];

/**
 * 校验缓存文件名是否合法
 * @param filename - 待校验的文件名（可包含子目录路径）
 * @returns 合法返回 true，否则返回 false
 */
export const isValidFilename = (filename: string): boolean => {
  if (!filename || !filename.endsWith('.json')) return false;
  // 拒绝路径穿越、绝对路径以及反斜杠
  if (filename.includes('..') || filename.startsWith('/') || filename.includes('\\')) return false;
  return true;
};

/**
 * 递归遍历目录，查找所有 JSON 文件
 * @param dir - 目录路径
 * @param relativePath - 相对路径（用于递归）
 * @returns 文件信息列表
 */
const findJsonFilesRecursively = (dir: string, relativePath: string = ''): Array<{ name: string; size: number; mtime: string; mtimeMs: number }> => {
  if (!fs.existsSync(dir)) return [];
  
  const files: Array<{ name: string; size: number; mtime: string; mtimeMs: number }> = [];
  
  for (const item of fs.readdirSync(dir)) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      // 递归遍历子目录（统一使用 / 作为分隔符）
      const subRelativePath = relativePath ? `${relativePath}/${item}` : item;
      const subDirFiles = findJsonFilesRecursively(itemPath, subRelativePath);
      files.push(...subDirFiles);
    } else if (item.endsWith('.json') && !RESERVED_CACHE_FILES.includes(item)) {
      // 处理 JSON 文件（统一使用 / 作为分隔符，便于前端 URL 拼接和跨平台使用）
      const fileName = relativePath ? `${relativePath}/${item}` : item;
      files.push({
        name: fileName,
        size: stat.size,
        mtime: formatDate(stat.mtime),
        mtimeMs: stat.mtimeMs
      });
    }
  }
  
  return files;
};

/**
 * 列出缓存目录下所有对用户可见的 JSON 文件
 * @description 递归遍历所有子目录，过滤掉系统保留文件，按修改时间倒序返回
 * @param cacheDir - 缓存目录路径
 * @returns 缓存文件信息列表（按 mtime 降序）
 */
export const listCacheFiles = (cacheDir: string): CacheFileInfo[] => {
  const files = findJsonFilesRecursively(cacheDir);
  return files
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map(({ mtimeMs: _mtimeMs, ...rest }) => rest) as CacheFileInfo[];
};

/**
 * 统计缓存目录下的 JSON 文件总数
 * @description 递归统计所有子目录中的 JSON 文件
 * @param cacheDir - 缓存目录路径
 * @returns 文件总数（目录不存在时返回 0）
 */
export const countCacheFiles = (cacheDir: string): number => {
  const files = findJsonFilesRecursively(cacheDir);
  return files.length;
};

/**
 * 读取指定缓存文件内容
 * @param cacheDir - 缓存目录路径
 * @param filename - 文件名（可能包含子目录路径，已通过 isValidFilename 校验）
 * @returns 读取结果：存在则返回 { content }；不存在返回 { notFound: true }；读取失败返回 { error }
 */
export const readCacheFile = (
  cacheDir: string,
  filename: string,
): { content: string } | { notFound: true } | { error: string } => {
  const filePath = path.join(cacheDir, filename);
  if (!fs.existsSync(filePath)) return { notFound: true };
  try {
    return { content: fs.readFileSync(filePath, 'utf-8') };
  } catch (err) {
    return { error: (err as Error).message };
  }
};

/**
 * 校验缓存写入参数
 * @param filename - 文件名
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
 * 将内容写入指定缓存文件
 * @param cacheDir - 缓存目录路径
 * @param filename - 文件名（可能包含子目录路径，已通过校验）
 * @param content - 合法的 JSON 字符串
 * @returns 文件不存在时返回错误信息，成功时返回 null
 */
export const writeCacheFile = (cacheDir: string, filename: string, content: string): string | null => {
  const filePath = path.join(cacheDir, filename);
  if (!fs.existsSync(filePath)) return '文件不存在';
  // 确保父目录存在（子目录场景下修改后仍可安全写入）
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return null;
};

/**
 * 通用：读取 .cache/ 下的指定 JSON 文件并解析
 * @param cacheDir - 缓存目录路径
 * @param filename - 文件名（如 'holiday_data.json'）
 * @returns 解析后的 JSON 对象，文件不存在或解析失败返回 null
 */
export const readCacheJsonFile = (cacheDir: string, filename: string): unknown => {
  const filePath = path.join(cacheDir, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
};

/**
 * 列出 api_responses/ 目录下所有缓存文件
 * @param cacheDir - 缓存目录路径
 * @returns 文件名列表
 */
export const listApiResponses = (cacheDir: string): string[] => {
  const dir = path.join(cacheDir, 'api_responses');
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
};

/**
 * 读取 api_responses/ 下的指定缓存文件
 * @param cacheDir - 缓存目录路径
 * @param filename - 文件名（如 'weather_深圳_2026-05.json'）
 * @returns 解析后的 JSON 对象，失败返回 null
 */
export const readApiResponse = (cacheDir: string, filename: string): unknown => {
  // 防止路径遍历
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  const filePath = path.join(cacheDir, 'api_responses', filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
};

/**
 * 列出所有每日数据文件
 * @param cacheDir - 缓存目录路径
 * @returns 文件名列表（如 ['daily_data_2026-05-25.json']）
 */
export const listDailyDataFiles = (cacheDir: string): string[] => {
  try {
    return fs.readdirSync(cacheDir)
      .filter(f => f.startsWith('daily_data_') && f.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
};

/**
 * 读取指定的每日数据文件
 * @param cacheDir - 缓存目录路径
 * @param date - 日期字符串（如 '2026-05-25'）
 * @returns 解析后的 JSON 对象，失败返回 null
 */
export const readDailyData = (cacheDir: string, date: string): unknown => {
  // 简单校验：只允许 YYYY-MM-DD 格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readCacheJsonFile(cacheDir, `daily_data_${date}.json`);
};
