import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { toDateText, normalizeDbDateTime } from '@/utils/database/datetime';
import { formatDate } from './script';
import type { ApiCategory } from '@/types/api-management';

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
 * @description 直接查库；数据库异常向上抛出，由路由转成 500，不再降级读本地 JSON
 */
export const readApiCategories = async (): Promise<ApiCategory[]> => readApiCategoriesFromDb();

/**
 * 写入接口分类列表
 * @param {ApiCategory[]} categories - 分类列表
 * @returns {Promise<void>}
 * @description 直接写库；数据库异常向上抛出，不再降级写本地 JSON
 */
export const writeApiCategories = async (categories: ApiCategory[]): Promise<void> => {
  await writeApiCategoriesToDb(categories);
};
