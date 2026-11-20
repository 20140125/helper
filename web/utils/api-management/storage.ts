import fs from 'fs';
import type { ApiItem } from '@/types/api-management';
import { API_ITEMS_FILE } from '@/types/api-management';
import { CACHE_DIR } from '@/utils/paths';

/**
 * 读取 API 条目列表
 * @returns {ApiItem[]} API 条目列表
 */
export const readApiItems = (): ApiItem[] => {
  if (!fs.existsSync(API_ITEMS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(API_ITEMS_FILE, 'utf-8')) as ApiItem[];
  } catch {
    return [];
  }
};

/**
 * 写入 API 条目列表
 * @param {ApiItem[]} items - API 条目列表
 */
export const writeApiItems = (items: ApiItem[]): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(API_ITEMS_FILE, JSON.stringify(items, null, 2), 'utf-8');
};
