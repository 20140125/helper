/**
 * 缓存数据管理访问层
 * @description 把 13 张 hp_cache_* 表统一成「表 / 键 / 正文 / 粒度」视图，
 *   供管理端按表、粒度、关键字分页检索，并直接读写数据库行；不新建任何表。
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from './connection';
import { listResRoutes, resolveCachePeriod } from './cache-routing';
import {
  CACHE_ADMIN_BODY_MAX_LENGTH,
  CACHE_ADMIN_FLAT_TABLES,
  CACHE_ADMIN_MAX_PAGE_SIZE,
  CACHE_ADMIN_PAGE_SIZE,
  type CacheAdminDetail,
  type CacheAdminEntry,
  type CacheAdminList,
  type CacheAdminPeriod,
  type CacheAdminQuery,
  type CacheAdminTable,
  type CacheAdminWriteBody,
} from '@/types/cache-admin';

/** 展平表名集合 */
const FLAT_TABLES = new Set<string>(CACHE_ADMIN_FLAT_TABLES);

/** 路由声明的粒度类型（跟随 resolveCachePeriod 的参数，避免重复声明） */
type Granularity = NonNullable<Parameters<typeof resolveCachePeriod>[1]>;

/** 12 张分类表（前缀路由按表名去重，多平台共用的热搜表只保留一条；含兜底表） */
const RES_TABLES: Array<{ prefix: string; table: string; comment: string; granularity: Granularity }> = [
  ...listResRoutes().filter(
    (route, index, routes) => routes.findIndex((item) => item.table === route.table) === index,
  ),
  { prefix: '', table: 'hp_cache_res_other', comment: '其它未分类响应', granularity: 'auto' },
];

/** 可管理的表名白名单，避免把请求参数直接拼进 SQL */
const ALL_TABLES = new Set<string>([...CACHE_ADMIN_FLAT_TABLES, ...RES_TABLES.map((route) => route.table)]);

/** 粒度白名单 */
const PERIODS = new Set<string>(['day', 'month', 'year', 'static']);

/** 统一查询结果行 */
interface CacheRow extends RowDataPacket {
  table_name: string;
  section: string;
  entry_key: string;
  body: string;
  size: number;
  period_type: string;
  period_key: string;
  updated_at: number;
}

/** 计数查询行 */
interface CountRow extends RowDataPacket {
  total: number;
}

/**
 * 列出全部可管理的缓存表
 * @returns {CacheAdminTable[]} 1 张展平表 + 12 张分类表（高德地理编码表已独立成页）
 */
export const listCacheAdminTables = (): CacheAdminTable[] => [
  { name: 'hp_cache_dailyword_library', kind: 'flat', comment: '每日一词历史库', granularity: 'flat' },
  ...RES_TABLES.map((route) => ({
    name: route.table,
    kind: 'res' as const,
    comment: route.comment,
    granularity: route.granularity,
  })),
];

/**
 * 判断表名是否在管理白名单内
 * @param {string} name - 表名
 * @returns {boolean} 可管理返回 true
 */
export const isCacheAdminTable = (name: string): boolean => ALL_TABLES.has(name);

/**
 * 校验写入参数
 * @param {CacheAdminWriteBody} payload - 写入请求
 * @returns {string | null} 错误说明，合法时返回 null
 */
export const validateCacheAdminWrite = (payload: CacheAdminWriteBody): string | null => {
  if (!isCacheAdminTable(payload.table)) return '不支持的缓存表';
  if (typeof payload.key !== 'string' || !payload.key || payload.key.length > 191) {
    return '缓存键为空或超长（最多 191 字符）';
  }
  if (typeof payload.body !== 'string' || payload.body.length > CACHE_ADMIN_BODY_MAX_LENGTH) {
    return '缓存正文为空或超长';
  }
  if (FLAT_TABLES.has(payload.table) && !payload.section) return '展平表必须指定 section';
  return null;
};

/**
 * 生成 13 张表的统一查询
 * @returns {string} UNION ALL SQL（table_name / section / entry_key / body / size / period_* / updated_at）
 * @description 分类表直接取 period_type / period_key；展平表按 section=entries 推导按天粒度
 */
const buildUnionSql = (): string => {
  const parts: string[] = [];
  for (const route of RES_TABLES) {
    parts.push(
      `SELECT '${route.table}' AS table_name, '' AS section, \`asset_key\` AS entry_key,
         \`body\` AS body, LENGTH(\`body\`) AS size, \`period_type\` AS period_type,
         \`period_key\` AS period_key, \`cache_updated_at\` AS updated_at
       FROM \`${route.table}\``,
    );
  }
  for (const table of CACHE_ADMIN_FLAT_TABLES) {
    parts.push(
      `SELECT '${table}' AS table_name, \`section\` AS section, \`row_key\` AS entry_key,
         COALESCE(\`data\`, '') AS body, LENGTH(COALESCE(\`data\`, '')) AS size,
         CASE WHEN \`section\` = 'entries' THEN 'day' ELSE 'static' END AS period_type,
         CASE WHEN \`section\` = 'entries' THEN \`row_key\` ELSE '' END AS period_key,
         \`cache_updated_at\` AS updated_at
       FROM \`${table}\``,
    );
  }
  return parts.join(' UNION ALL ');
};

/** 把数据库行转换成列表条目（正文只保留预览，避免大 JSON 撑爆接口） */
const toEntry = (row: CacheRow): CacheAdminEntry => {
  const body = String(row.body ?? '');
  const period = String(row.period_type ?? 'static');
  return {
    table: String(row.table_name),
    section: String(row.section ?? ''),
    entryKey: String(row.entry_key ?? ''),
    preview: body.slice(0, 160),
    size: Number(row.size ?? 0),
    periodType: (PERIODS.has(period) ? period : 'static') as CacheAdminPeriod,
    periodKey: String(row.period_key ?? ''),
    updatedAt: Number(row.updated_at ?? 0),
  };
};

/**
 * 分页检索缓存行
 * @param {CacheAdminQuery} query - 表、粒度、关键字与分页参数
 * @returns {Promise<CacheAdminList>} 当前页记录、总数与表清单
 * @description 条件全部参数化；表名与粒度走白名单，正文关键字仅用于筛选
 */
export const listCacheAdminEntries = async (query: CacheAdminQuery): Promise<CacheAdminList> => {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.table) {
    if (!isCacheAdminTable(query.table)) throw new Error('不支持的缓存表');
    where.push('table_name = ?');
    params.push(query.table);
  }
  if (query.periodType) {
    if (!PERIODS.has(query.periodType)) throw new Error('不支持的时间粒度');
    where.push('period_type = ?');
    params.push(query.periodType);
  }
  if (query.keyword?.trim()) {
    where.push('(entry_key LIKE ? OR section LIKE ? OR body LIKE ?)');
    const keyword = `%${query.keyword.trim()}%`;
    params.push(keyword, keyword, keyword);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(
    Math.max(Math.trunc(query.limit ?? 0) || CACHE_ADMIN_PAGE_SIZE, 1),
    CACHE_ADMIN_MAX_PAGE_SIZE,
  );
  const offset = Math.max(Math.trunc(query.offset ?? 0) || 0, 0);
  const union = buildUnionSql();
  const pool = getPool();
  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM (${union}) AS cache_rows ${whereSql}`, params,
  );
  const [rows] = await pool.query<CacheRow[]>(
    `SELECT table_name, section, entry_key, body, size, period_type, period_key, updated_at
     FROM (${union}) AS cache_rows ${whereSql}
     ORDER BY updated_at DESC, table_name, entry_key LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return {
    items: rows.map(toEntry),
    total: Number(countRows[0]?.total ?? 0),
    tables: listCacheAdminTables(),
  };
};

/**
 * 读取单条缓存行全文
 * @param {string} table - 表名
 * @param {string} section - 展平表的 section，分类表传空串
 * @param {string} key - 缓存键
 * @returns {Promise<CacheAdminDetail | null>} 详情，不存在返回 null
 */
export const readCacheAdminEntry = async (
  table: string,
  section: string,
  key: string,
): Promise<CacheAdminDetail | null> => {
  if (!isCacheAdminTable(table)) throw new Error('不支持的缓存表');
  const pool = getPool();
  if (FLAT_TABLES.has(table)) {
    const [rows] = await pool.query<CacheRow[]>(
      `SELECT '${table}' AS table_name, \`section\`, \`row_key\` AS entry_key,
         COALESCE(\`data\`, '') AS body, LENGTH(COALESCE(\`data\`, '')) AS size,
         'day' AS period_type, \`row_key\` AS period_key, \`cache_updated_at\` AS updated_at
       FROM \`${table}\` WHERE \`section\` = ? AND \`row_key\` = ? LIMIT 1`,
      [section, key],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    const isDaily = String(row.section) === 'entries';
    return {
      ...toEntry(row),
      body: String(row.body ?? ''),
      periodType: isDaily ? 'day' : 'static',
      periodKey: isDaily ? String(row.entry_key) : '',
    };
  }
  const [rows] = await pool.query<CacheRow[]>(
    `SELECT '${table}' AS table_name, '' AS section, \`asset_key\` AS entry_key, \`body\`,
       LENGTH(\`body\`) AS size, \`period_type\`, \`period_key\`, \`cache_updated_at\` AS updated_at
     FROM \`${table}\` WHERE \`asset_key\` = ? LIMIT 1`,
    [key],
  );
  if (rows.length === 0) return null;
  return { ...toEntry(rows[0]), body: String(rows[0].body ?? '') };
};

/**
 * 新增或更新一条缓存行
 * @param {CacheAdminWriteBody} payload - 目标表、键与正文
 * @returns {Promise<void>} 无返回值
 * @description 分类表写入时按路由声明的粒度重算 period_type / period_key，与运行时写入规则一致
 */
export const writeCacheAdminEntry = async (payload: CacheAdminWriteBody): Promise<void> => {
  const error = validateCacheAdminWrite(payload);
  if (error) throw new Error(error);
  const { table, key, body } = payload;
  const section = payload.section ?? '';
  const now = Date.now();
  if (FLAT_TABLES.has(table)) {
    await getPool().execute(
      `INSERT INTO \`${table}\` (\`section\`, \`row_key\`, \`data\`, \`cache_updated_at\`)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`), \`cache_updated_at\` = VALUES(\`cache_updated_at\`)`,
      [section, key, body, now],
    );
    return;
  }
  const route = RES_TABLES.find((item) => item.table === table);
  const { periodType, periodKey } = resolveCachePeriod(key, route?.granularity ?? 'auto');
  await getPool().execute(
    `INSERT INTO \`${table}\` (\`asset_key\`, \`body\`, \`cache_updated_at\`, \`period_type\`, \`period_key\`)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE \`body\` = VALUES(\`body\`), \`cache_updated_at\` = VALUES(\`cache_updated_at\`),
       \`period_type\` = VALUES(\`period_type\`), \`period_key\` = VALUES(\`period_key\`)`,
    [key, body, now, periodType, periodKey],
  );
};

/**
 * 删除一条缓存行
 * @param {string} table - 表名
 * @param {string} section - 展平表的 section，分类表传空串
 * @param {string} key - 缓存键
 * @returns {Promise<boolean>} 实际删除了记录返回 true
 */
export const deleteCacheAdminEntry = async (
  table: string,
  section: string,
  key: string,
): Promise<boolean> => {
  if (!isCacheAdminTable(table)) throw new Error('不支持的缓存表');
  const flat = FLAT_TABLES.has(table);
  const sql = flat
    ? `DELETE FROM \`${table}\` WHERE \`section\` = ? AND \`row_key\` = ?`
    : `DELETE FROM \`${table}\` WHERE \`asset_key\` = ?`;
  const params = flat ? [section, key] : [key];
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result.affectedRows > 0;
};
