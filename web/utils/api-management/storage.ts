import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { toDateText, normalizeDbDateTime } from '@/utils/database/datetime';
import { formatDate } from '@/utils/script';
import type { ApiItem } from '@/types/api-management';

/**
 * 从数据库读取 API 条目列表
 * @returns {Promise<ApiItem[]>} API 条目列表
 * @description 库里 category_id 是数字外键，这里 JOIN 回 category_key 供业务层使用
 */
const readApiItemsFromDb = async (): Promise<ApiItem[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT i.item_key, c.category_key AS category_id, i.name, i.method, i.path,
            i.description, i.enabled, i.created_at, i.updated_at
     FROM hp_api_items i JOIN hp_api_categories c ON c.id = i.category_id
     ORDER BY i.id`,
  );
  return rows.map((row) => ({
    item_key: String(row.item_key),
    category_id: String(row.category_id),
    name: String(row.name),
    method: String(row.method) as ApiItem['method'],
    path: String(row.path),
    description: row.description === null ? '' : String(row.description),
    enabled: Boolean(row.enabled),
    created_at: toDateText(row.created_at),
    updated_at: toDateText(row.updated_at),
  }));
};

/**
 * 把 API 条目全量同步到数据库
 * @param {ApiItem[]} items - API 条目列表
 * @returns {Promise<void>}
 * @description 分类字段按 category_key 解析为数字外键；与旧版整份覆盖语义一致，删除列表外的条目
 */
const writeApiItemsToDb = async (items: ApiItem[]): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [categoryRows] = await conn.query<RowDataPacket[]>(
      'SELECT id, category_key FROM hp_api_categories',
    );
    const categoryIds = new Map(
      categoryRows.map((row) => [String(row.category_key), Number(row.id)]),
    );
    for (const item of items) {
      const categoryId = categoryIds.get(item.category_id);
      if (!categoryId) throw new Error(`接口分类不存在：${item.category_id}`);
      await conn.execute(
        `INSERT INTO hp_api_items
         (item_key, category_id, name, method, path, description, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), name = VALUES(name),
           method = VALUES(method), path = VALUES(path), description = VALUES(description),
           enabled = VALUES(enabled), updated_at = VALUES(updated_at)`,
        [item.item_key, categoryId, item.name, item.method, item.path, item.description ?? '',
          item.enabled ? 1 : 0, normalizeDbDateTime(item.created_at) ?? formatDate(),
          normalizeDbDateTime(item.updated_at) ?? formatDate()],
      );
    }
    const keys = items.map((item) => item.item_key);
    if (keys.length === 0) {
      await conn.query('DELETE FROM hp_api_items');
    } else {
      await conn.query('DELETE FROM hp_api_items WHERE item_key NOT IN (?)', [keys]);
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
 * 读取 API 条目列表
 * @returns {Promise<ApiItem[]>} API 条目列表
 * @description 直接查库；数据库异常向上抛出，由路由转成 500，不再降级读本地 JSON
 */
export const readApiItems = async (): Promise<ApiItem[]> => readApiItemsFromDb();

/**
 * 写入 API 条目列表
 * @param {ApiItem[]} items - API 条目列表
 * @returns {Promise<void>}
 * @description 直接写库；数据库异常向上抛出，不再降级写本地 JSON
 */
export const writeApiItems = async (items: ApiItem[]): Promise<void> => {
  await writeApiItemsToDb(items);
};
