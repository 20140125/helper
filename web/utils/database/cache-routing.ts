/**
 * API 响应缓存键到分类表的路由
 * @description api_responses/*.json 按资源类型落到 hp_cache_res_* 分类表；
 *   其余缓存键（含 api_responses/.last_prune）读写 sql/ 里已有的业务表（见 cache-tables.ts）。
 *   分类表用 period_type / period_key 显式记录时间粒度：
 *   day → YYYY-MM-DD、month → YYYY-MM、year → YYYY，静态数据为 static + 空串。
 */
import type { RowDataPacket } from 'mysql2';
import { getPool } from './connection';

/** API 响应归档键前缀 */
const API_PREFIX = 'api_responses/';
/** 未分类响应的兜底表 */
const OTHER_RES_TABLE = 'hp_cache_res_other';
/** 实际入库的时间粒度 */
type PeriodType = 'day' | 'month' | 'year' | 'static';
/** 路由声明的粒度（auto 表示从缓存键里的日期自动推断） */
type RouteGranularity = PeriodType | 'auto';
/** 粒度对应的日期格式 */
const PERIOD_PATTERNS: Record<Exclude<PeriodType, 'static'>, RegExp> = {
  day: /\d{4}-\d{2}-\d{2}/,
  month: /\d{4}-\d{2}/,
  year: /\d{4}/,
};
/** 时间粒度列（与 sql/cache_data/*.sql 种子保持一致） */
const PERIOD_TYPE_DDL = "`period_type` VARCHAR(8) NOT NULL DEFAULT 'static' COMMENT '时间粒度：day/month/year/static'";
const PERIOD_KEY_DDL = "`period_key` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '粒度日期：YYYY-MM-DD / YYYY-MM / YYYY，静态为空'";

/** 文件名前缀与分类表的对应关系（asset_key 去掉该前缀后入库） */
const RES_ROUTES: Array<{ prefix: string; table: string; comment: string; granularity: RouteGranularity }> = [
  { prefix: 'almanac_', table: 'hp_cache_res_calendar', comment: '日历/老黄历响应', granularity: 'month' },
  { prefix: 'nagerholiday-', table: 'hp_cache_res_holiday', comment: '节假日响应', granularity: 'year' },
  { prefix: 'weather_', table: 'hp_cache_res_weather', comment: '天气响应', granularity: 'month' },
  // 星座按星座一条，body 内自带 date / week / month / year 周期标签，文件级无日期
  { prefix: 'horoscope_', table: 'hp_cache_res_horoscope', comment: '星座运势响应', granularity: 'static' },
  { prefix: 'historytoday-', table: 'hp_cache_res_history', comment: '历史上的今天响应', granularity: 'day' },
  { prefix: 'gtimgquotes_', table: 'hp_cache_res_finance', comment: '行情/财经响应', granularity: 'month' },
  { prefix: 'tencenthot_', table: 'hp_cache_res_hot_list', comment: '热搜榜单响应', granularity: 'month' },
  { prefix: 'dailyword_', table: 'hp_cache_res_quote', comment: '每日一言/语录响应', granularity: 'month' },
  { prefix: 'video_', table: 'hp_cache_res_video', comment: '视频资源响应', granularity: 'static' },
  { prefix: 'image_', table: 'hp_cache_res_image', comment: '图片资源响应', granularity: 'static' },
  { prefix: 'news_', table: 'hp_cache_res_news', comment: '新闻资讯响应', granularity: 'static' },
];

/** 单个 API 响应缓存键的落点 */
interface CacheTarget {
  table: string;
  keyColumn: string;
  bodyColumn: string;
  timeColumn: string;
  storedKey: string;
  periodType: PeriodType;
  periodKey: string;
}

/**
 * 校验并规范化缓存键
 * @param {string} key - 相对 .cache 的路径
 * @returns {string} 规范化后的键
 * @description 拒绝空值、路径穿越、绝对路径与反斜杠
 */
export const normalizeCacheKey = (key: string): string => {
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error('非法缓存键');
  }
  return key.replace(/^\.\//, '');
};

/**
 * 判断缓存键是否属于 API 响应归档
 * @param {string} key - 缓存键
 * @returns {boolean} 以 api_responses/ 开头返回 true
 */
export const isApiResponseKey = (key: string): boolean => {
  const normalized = normalizeCacheKey(key);
  return normalized.startsWith(API_PREFIX) && normalized.endsWith('.json');
};

/**
 * 按粒度从缓存键提取日期
 * @param {string} key - 缓存键或 asset_key
 * @param {RouteGranularity} granularity - 声明的粒度，默认按日期自动推断
 * @returns {{ periodType: PeriodType; periodKey: string }} 粒度与日期键
 * @description auto 依次尝试 YYYY-MM-DD / YYYY-MM / YYYY；取不到日期时按静态数据入库
 */
export const resolveCachePeriod = (key: string, granularity: RouteGranularity = 'auto'):
  { periodType: PeriodType; periodKey: string } => {
  if (granularity === 'static') return { periodType: 'static', periodKey: '' };
  const order: Array<Exclude<PeriodType, 'static'>> = granularity === 'auto'
    ? ['day', 'month', 'year']
    : [granularity];
  for (const type of order) {
    const matched = key.match(PERIOD_PATTERNS[type]);
    if (matched) return { periodType: type, periodKey: matched[0] };
  }
  return { periodType: 'static', periodKey: '' };
};

/**
 * 把 API 响应缓存键解析为具体表、列与行键
 * @param {string} key - 缓存键
 * @returns {CacheTarget} 落点信息（含时间粒度）
 */
export const resolveCacheTarget = (key: string): CacheTarget => {
  const normalized = normalizeCacheKey(key);
  if (!isApiResponseKey(normalized)) {
    throw new Error('非 api_responses/*.json 缓存键请使用已有业务表访问层');
  }
  const name = normalized.slice(API_PREFIX.length);
  const base = name.endsWith('.json') ? name.slice(0, -5) : name;
  const route = RES_ROUTES.find((item) => base.startsWith(item.prefix));
  if (!route) {
    const storedKey = normalized;
    return {
      table: OTHER_RES_TABLE,
      keyColumn: 'asset_key',
      bodyColumn: 'body',
      timeColumn: 'cache_updated_at',
      storedKey,
      ...resolveCachePeriod(storedKey, 'auto'),
    };
  }
  const storedKey = base.slice(route.prefix.length);
  return {
    table: route.table,
    keyColumn: 'asset_key',
    bodyColumn: 'body',
    timeColumn: 'cache_updated_at',
    storedKey,
    ...resolveCachePeriod(storedKey, route.granularity),
  };
};

/**
 * 列出全部分类表及其文件名前缀
 * @returns {Array<{ prefix: string; table: string; comment: string; granularity: RouteGranularity }>} 分类表清单
 */
export const listResRoutes = (): Array<{ prefix: string; table: string; comment: string; granularity: RouteGranularity }> =>
  RES_ROUTES.map((item) => ({ ...item }));

/**
 * 生成 API 响应归档的汇总查询（file_key / size / updated_at 三列）
 * @returns {string} UNION ALL SQL
 * @description 分类表的 asset_key 需拼回 api_responses/<前缀><键>.json，与运行时缓存键保持一致
 */
export const buildCacheUnionSql = (): string => {
  const parts: string[] = [];
  for (const route of RES_ROUTES) {
    parts.push(
      `SELECT CONCAT('${API_PREFIX}', '${route.prefix}', asset_key, '.json') AS file_key,
         LENGTH(body) AS size, cache_updated_at AS updated_at FROM \`${route.table}\``,
    );
  }
  parts.push(
    `SELECT asset_key AS file_key, LENGTH(body) AS size, cache_updated_at AS updated_at
     FROM \`${OTHER_RES_TABLE}\``,
  );
  return parts.join(' UNION ALL ');
};

/** 建表语句缓存，避免每次读写重复执行 DDL */
let ensured: Promise<void> | null = null;

/**
 * 确保 API 响应分类表存在
 * @returns {Promise<void>}
 * @description 现有库已由 sql/cache_data.sql 建表；此处仅做运行时兜底与旧库补列，进程内只执行一次
 */
export const ensureCacheTables = async (): Promise<void> => {
  if (!ensured) ensured = createTables();
  try {
    await ensured;
  } catch (err) {
    ensured = null;
    throw err;
  }
};

/** 判断是否为并发迁移导致的重复列 / 重复索引错误 */
const isDuplicateSchemaError = (err: unknown): boolean => {
  const code = (err as { code?: string }).code;
  return code === 'ER_DUP_FIELDNAME' || code === 'ER_DUP_KEYNAME';
};

/** 执行建表与旧库补列 */
const createTables = async (): Promise<void> => {
  const pool = getPool();
  const tables = [...RES_ROUTES, { table: OTHER_RES_TABLE, comment: '其它未分类响应' }];
  const names = tables.map((item) => item.table);
  const placeholders = names.map(() => '?').join(', ');
  const [tableRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS table_name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`, names,
  );
  const existingTables = new Set(tableRows.map((row) => String(row.table_name)));
  const [columnRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})
       AND COLUMN_NAME IN ('period_type', 'period_key')`, names,
  );
  const columnsByTable = new Map<string, Set<string>>();
  for (const row of columnRows) {
    const name = String(row.table_name);
    const columns = columnsByTable.get(name) ?? new Set<string>();
    columns.add(String(row.column_name));
    columnsByTable.set(name, columns);
  }
  const [indexRows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT TABLE_NAME AS table_name FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})
       AND INDEX_NAME = 'idx_cache_period'`, names,
  );
  const indexedTables = new Set(indexRows.map((row) => String(row.table_name)));
  const alterTable = async (table: string, ddl: string): Promise<void> => {
    try {
      await pool.query(`ALTER TABLE \`${table}\` ${ddl}`);
    } catch (err) {
      if (!isDuplicateSchemaError(err)) throw err;
    }
  };
  for (const route of tables) {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS \`${route.table}\` (
        \`asset_key\` VARCHAR(191) NOT NULL COMMENT '缓存文件名',
        \`body\` LONGTEXT NOT NULL COMMENT '原始响应 JSON 全文',
        \`cache_updated_at\` BIGINT NOT NULL DEFAULT 0,
        ${PERIOD_TYPE_DDL},
        ${PERIOD_KEY_DDL},
        PRIMARY KEY (\`asset_key\`),
        KEY \`idx_cache_period\` (\`period_type\`, \`period_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='${route.comment}（基于 api_responses 分类）'`,
    );
    // 新建表已含粒度列与索引；已存在的旧表按缺项补齐
    if (!existingTables.has(route.table)) continue;
    const columns = columnsByTable.get(route.table) ?? new Set<string>();
    if (!columns.has('period_type')) await alterTable(route.table, `ADD COLUMN ${PERIOD_TYPE_DDL}`);
    if (!columns.has('period_key')) await alterTable(route.table, `ADD COLUMN ${PERIOD_KEY_DDL}`);
    if (!indexedTables.has(route.table)) {
      await alterTable(route.table, 'ADD KEY `idx_cache_period` (`period_type`, `period_key`)');
    }
  }
};
