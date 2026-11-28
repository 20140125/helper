/**
 * 高德地理编码缓存访问层
 * @description 独立管理页直接读写 hp_cache_amap_geocode 的扁平行（row_key 为空串），
 *   与运行时 amap_geocode.json 的 flatten / unflatten 结构保持一致；不使用任何本地文件。
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPool } from './connection';
import {
  AMAP_GEOCODE_ADDRESS_MAX_LENGTH,
  AMAP_GEOCODE_COORD_PATTERN,
} from '@/types/amap-geocode';
import type { AmapGeocodeEntry, AmapGeocodeWriteBody } from '@/types/amap-geocode';

/** 目标表 */
const TABLE = 'hp_cache_amap_geocode';
/** 扁平行的 row_key 恒为空串（地址本身就是 section） */
const FLAT_ROW_KEY = '';

/**
 * 校验地理编码写入参数
 * @param {AmapGeocodeWriteBody} payload - 写入请求
 * @returns {string | null} 错误说明，合法时返回 null
 */
export const validateAmapGeocodeWrite = (payload: AmapGeocodeWriteBody): string | null => {
  if (!payload || typeof payload !== 'object') return '请求体不合法';
  const address = String(payload.address ?? '').trim();
  const coordinates = String(payload.coordinates ?? '').trim();
  if (!address) return '地址不能为空';
  if (address.length > AMAP_GEOCODE_ADDRESS_MAX_LENGTH) {
    return `地址超长（最多 ${AMAP_GEOCODE_ADDRESS_MAX_LENGTH} 字符）`;
  }
  if (!AMAP_GEOCODE_COORD_PATTERN.test(coordinates)) return '坐标格式应为「经度,纬度」';
  return null;
};

/**
 * 列出地理编码缓存记录
 * @param {string} keyword - 按地址模糊匹配，空串表示全部
 * @returns {Promise<AmapGeocodeEntry[]>} 按地址排序的记录
 * @description 只返回扁平行，避免把嵌套结构行当成独立地址编辑
 */
export const listAmapGeocodeEntries = async (keyword: string = ''): Promise<AmapGeocodeEntry[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT \`section\` AS address, COALESCE(\`data\`, '') AS coordinates,
       \`cache_updated_at\` AS updated_at
     FROM \`${TABLE}\`
     WHERE \`row_key\` = ? AND \`section\` LIKE ?
     ORDER BY \`section\``,
    [FLAT_ROW_KEY, `%${keyword}%`],
  );
  return rows.map((row) => ({
    address: String(row.address ?? ''),
    coordinates: String(row.coordinates ?? ''),
    updatedAt: Number(row.updated_at ?? 0),
  }));
};

/**
 * 新增或更新一条地理编码缓存
 * @param {AmapGeocodeWriteBody} payload - 地址、坐标与可选原地址
 * @returns {Promise<void>} 无返回值
 * @description 地址变更时在事务内删除旧行再写入，避免主键残留；同名地址已存在时拒绝覆盖
 */
export const writeAmapGeocodeEntry = async (payload: AmapGeocodeWriteBody): Promise<void> => {
  const error = validateAmapGeocodeWrite(payload);
  if (error) throw new Error(error);
  const address = String(payload.address).trim();
  const coordinates = String(payload.coordinates).trim();
  const originalAddress = String(payload.originalAddress ?? '').trim();
  const renamed = Boolean(originalAddress) && originalAddress !== address;
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (renamed) {
      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT 1 FROM \`${TABLE}\` WHERE \`section\` = ? AND \`row_key\` = ? LIMIT 1`,
        [address, FLAT_ROW_KEY],
      );
      if (existing.length > 0) throw new Error('该地址已存在');
      await conn.execute(
        `DELETE FROM \`${TABLE}\` WHERE \`section\` = ? AND \`row_key\` = ?`,
        [originalAddress, FLAT_ROW_KEY],
      );
    }
    await conn.execute(
      `INSERT INTO \`${TABLE}\` (\`section\`, \`row_key\`, \`data\`, \`cache_updated_at\`)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`),
         \`cache_updated_at\` = VALUES(\`cache_updated_at\`)`,
      [address, FLAT_ROW_KEY, coordinates, Date.now()],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * 删除一条地理编码缓存
 * @param {string} address - 地址文本
 * @returns {Promise<boolean>} 实际删除返回 true
 */
export const deleteAmapGeocodeEntry = async (address: string): Promise<boolean> => {
  const trimmed = String(address ?? '').trim();
  if (!trimmed) return false;
  const [result] = await getPool().execute<ResultSetHeader>(
    `DELETE FROM \`${TABLE}\` WHERE \`section\` = ? AND \`row_key\` = ?`,
    [trimmed, FLAT_ROW_KEY],
  );
  return result.affectedRows > 0;
};
