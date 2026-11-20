import fs from 'fs';
import type { ApiCategory } from '@/types/api-management';
import { API_CATEGORIES_FILE } from '@/types/api-management';
import { CACHE_DIR } from './paths';

/**
 * 读取接口分类列表
 * @returns {ApiCategory[]} 分类列表
 */
export const readApiCategories = (): ApiCategory[] => {
  if (!fs.existsSync(API_CATEGORIES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(API_CATEGORIES_FILE, 'utf-8')) as ApiCategory[];
  } catch {
    return [];
  }
};

/**
 * 写入接口分类列表
 * @param {ApiCategory[]} categories - 分类列表
 */
export const writeApiCategories = (categories: ApiCategory[]): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(API_CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
};
