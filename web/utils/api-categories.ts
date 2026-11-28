import fs from 'fs';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { toDateText, normalizeDbDateTime } from '@/utils/database/datetime';
import { formatDate } from './script';
import type { ApiCategory } from '@/types/api-management';
import { API_CATEGORIES_FILE } from '@/types/api-management';
import { CACHE_DIR } from './paths';

/**
 * 读取本地 JSON 快照（数据库不可用时的降级数据）
 * @returns {ApiCategory[]} 分类列表
 */
const readLegacyApiCategories = (): ApiCategory[] => {
  if (!fs.existsSync(API_CATEGORIES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(API_CATEGORIES_FILE, 'utf-8')) as ApiCategory[];
  } catch {
    return [];
  }
};

/**
 * 写入本地 JSON 快照（数据库不可用时的降级数据）
 * @param {ApiCategory[]} categories - 分类列表
 */
const writeLegacyApiCategories = (categories: ApiCategory[]): void => {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(API_CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
};

/**
 * 从数据库读取接口分类列表
 * @returns {Promise<ApiCategory[]>} 分类列表
 */
const readApiCategoriesFromDb = async (): Promise<ApiCategory[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT category_key, name, description, created_at, updated_at FROM hp_api_categories ORDER BY id',
  );
  return rows.map((row) => ({
    category_key: String(row.category_key),
    name: String(row.name),
    description: row.description === null ? '' : String(row.description),
    created_at: toDateText(row.created_at),
    updated_at: toDateText(row.updated_at),
  }));
};

/**
 * 把接口分类全量同步到数据库
 * @param {ApiCategory[]} categories - 分类列表
 * @returns {Promise<void>}
 * @description 与旧版「整份 JSON 覆盖写入」语义一致：UPSERT 现存项并删除列表外的分类；
 *   删除分类会由外键级联清理其下 API 条目
 */
const writeApiCategoriesToDb = async (categories: ApiCategory[]): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const category of categories) {
      await conn.execute(
        `INSERT INTO hp_api_categories (category_key, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
           updated_at = VALUES(updated_at)`,
        [category.category_key, category.name, category.description ?? '',
          normalizeDbDateTime(category.created_at) ?? formatDate(),
          normalizeDbDateTime(category.updated_at) ?? formatDate()],
      );
    }
    const keys = categories.map((category) => category.category_key);
    if (keys.length === 0) {
      await conn.query('DELETE FROM hp_api_categories');
    } else {
      await conn.query('DELETE FROM hp_api_categories WHERE category_key NOT IN (?)', [keys]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * 读取接口分类列表
 * @returns {Promise<ApiCategory[]>} 分类列表
 * @description 优先查库；数据库不可用时降级读取本地 JSON 快照
 */
export const readApiCategories = async (): Promise<ApiCategory[]> => {
  try {
    return await readApiCategoriesFromDb();
  } catch (err) {
    console.warn('[api-categories] 读取 hp_api_categories 失败，回退 JSON：', (err as Error).message);
    return readLegacyApiCategories();
  }
};

/**
 * 写入接口分类列表
 * @param {ApiCategory[]} categories - 分类列表
 * @returns {Promise<void>}
 * @description 写库失败时降级写本地快照，数据库恢复后可重跑 migrate:cache 补齐
 */
export const writeApiCategories = async (categories: ApiCategory[]): Promise<void> => {
  try {
    await writeApiCategoriesToDb(categories);
  } catch (err) {
    console.warn('[api-categories] 写入 hp_api_categories 失败，回退 JSON：', (err as Error).message);
    writeLegacyApiCategories(categories);
  }
};
