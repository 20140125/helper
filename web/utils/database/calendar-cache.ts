/**
 * 日历 / 每日数据 / API 响应归档的查询镜像与同步
 *
 * 设计说明：
 *   - 这些文件由 shell 年度更新、守护进程、每日预取与 api_archive.sh 写入，文件仍是写入真源；
 *   - 结构化表（hp_holiday_data / hp_month_config / hp_daily_data / hp_cache_res_*）是初始化快照，
 *     无法完整表达 code / config / 原始 JSON 全文与顺序，因此新增 hp_cache_files 保存原始文件镜像；
 *   - 查询侧统一读 hp_cache_files，按文件 mtime 水位自动同步，shell 写入后下一次查询即可收敛。
 */
import fs from 'fs';
import path from 'path';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { CACHE_DIR } from '@/utils/paths';

/** 查询镜像表名 */
const MIRROR_TABLE = 'hp_cache_files';
/** 记录上次同步时文件 mtime 的元数据键 */
const SYNC_META_KEY = 'calendar_cache_sync_at';
/** API 响应归档目录 */
const API_DIR = path.join(CACHE_DIR, 'api_responses');
/** 顶层固定缓存文件 */
const TOP_LEVEL_FILES = ['holiday_data.json', 'month_config.json', 'daemon_sent_state.json'];

/** 单个待镜像文件 */
interface SourceFile {
  /** 相对 .cache 的键，如 api_responses/almanac_2026-11.json */
  key: string;
  /** 绝对路径 */
  file: string;
  /** 文件 mtime（毫秒整数） */
  mtime: number;
}

/** 文件与数据库的差异报告 */
export interface CalendarCacheDiff {
  file: { total: number; api: number; daily: number; mtime: number };
  db: { total: number; api: number; daily: number };
  stale: boolean;
}

/** 镜像表的一行 */
export interface CalendarCacheEntry {
  body: string;
  updatedAt: number;
}

/**
 * 收集需要镜像的文件
 * @returns {SourceFile[]} 文件清单（按键排序）
 */
const collectSourceFiles = (): SourceFile[] => {
  const files: SourceFile[] = [];
  const push = (key: string, file: string): void => {
    if (!fs.existsSync(file)) return;
    const stat = fs.statSync(file);
    if (!stat.isFile()) return;
    files.push({ key, file, mtime: Math.trunc(stat.mtimeMs) });
  };
  for (const name of TOP_LEVEL_FILES) push(name, path.join(CACHE_DIR, name));
  for (const name of fs.readdirSync(CACHE_DIR)) {
    if (name.startsWith('daily_data_') && name.endsWith('.json')) {
      push(name, path.join(CACHE_DIR, name));
    }
  }
  if (fs.existsSync(API_DIR)) {
    for (const name of fs.readdirSync(API_DIR)) {
      if (!name.endsWith('.json') && name !== '.last_prune') continue;
      push(`api_responses/${name}`, path.join(API_DIR, name));
    }
  }
  return files.sort((a, b) => a.key.localeCompare(b.key));
};

/**
 * 确保查询镜像表存在
 * @returns {Promise<void>}
 * @description 现有库无需重跑建表脚本，运行时自动补表；SQL 种子同步维护同一结构
 */
const ensureMirrorTable = async (): Promise<void> => {
  await getPool().query(
    `CREATE TABLE IF NOT EXISTS \`${MIRROR_TABLE}\` (
      \`file_key\` VARCHAR(191) NOT NULL,
      \`body\` LONGTEXT NULL,
      \`updated_at\` BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (\`file_key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='日历与 API 响应缓存文件的查询镜像'`,
  );
};

/**
 * 计算文件清单的最大 mtime
 * @param files - 文件清单
 * @returns {number} 最大 mtime，空清单返回 0
 */
const maxMtime = (files: SourceFile[]): number =>
  files.reduce((max, item) => Math.max(max, item.mtime), 0);

/**
 * 从文件全量重建查询镜像表
 * @returns {Promise<{ total: number; api: number; daily: number }>} 入库条数
 * @description 单事务内 DELETE + INSERT；body 保存原始文件全文，不做 JSON 解析
 */
export const syncCalendarCacheFromFiles = async (): Promise<{ total: number; api: number; daily: number }> => {
  await ensureMirrorTable();
  const files = collectSourceFiles();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM \`${MIRROR_TABLE}\``);
    for (const item of files) {
      await conn.execute(
        `INSERT INTO \`${MIRROR_TABLE}\` (file_key, body, updated_at) VALUES (?, ?, ?)`,
        [item.key, fs.readFileSync(item.file, 'utf-8'), item.mtime],
      );
    }
    await conn.execute(
      `INSERT INTO hp_cache_meta (meta_key, meta_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
      [SYNC_META_KEY, String(maxMtime(files))],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return {
    total: files.length,
    api: files.filter((item) => item.key.startsWith('api_responses/') && item.key.endsWith('.json')).length,
    daily: files.filter((item) => item.key.startsWith('daily_data_')).length,
  };
};

/** 正在进行的同步（避免并发查询重复重建） */
let pendingSync: Promise<void> | null = null;

/**
 * 文件有更新时自动同步查询镜像
 * @returns {Promise<void>}
 * @description 数据库不可用时由调用方降级读文件
 */
export const syncCalendarCacheIfStale = async (): Promise<void> => {
  if (pendingSync) return pendingSync;
  pendingSync = (async () => {
    await ensureMirrorTable();
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT meta_value FROM hp_cache_meta WHERE meta_key = ?', [SYNC_META_KEY],
    );
    const stored = Number(rows[0]?.meta_value ?? 0);
    if (maxMtime(collectSourceFiles()) > stored) await syncCalendarCacheFromFiles();
  })().finally(() => {
    pendingSync = null;
  });
  return pendingSync;
};

/**
 * 统计文件与镜像表的差异
 * @returns {Promise<CalendarCacheDiff>} 差异报告
 */
export const collectCalendarCacheDiff = async (): Promise<CalendarCacheDiff> => {
  await ensureMirrorTable();
  const files = collectSourceFiles();
  const pool = getPool();
  const [totalRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM \`${MIRROR_TABLE}\``,
  );
  const [apiRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM \`${MIRROR_TABLE}\` WHERE file_key LIKE 'api_responses/%' AND file_key LIKE '%.json'`,
  );
  const [dailyRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM \`${MIRROR_TABLE}\` WHERE file_key LIKE 'daily_data_%'`,
  );
  const [metaRows] = await pool.query<RowDataPacket[]>(
    'SELECT meta_value FROM hp_cache_meta WHERE meta_key = ?', [SYNC_META_KEY],
  );
  const mtime = maxMtime(files);
  return {
    file: {
      total: files.length,
      api: files.filter((item) => item.key.startsWith('api_responses/') && item.key.endsWith('.json')).length,
      daily: files.filter((item) => item.key.startsWith('daily_data_')).length,
      mtime,
    },
    db: {
      total: Number(totalRows[0]?.n ?? 0),
      api: Number(apiRows[0]?.n ?? 0),
      daily: Number(dailyRows[0]?.n ?? 0),
    },
    stale: mtime > Number(metaRows[0]?.meta_value ?? 0),
  };
};

/**
 * 判断镜像是否需要同步
 * @param diff - 差异报告
 * @returns {boolean} 数量不一致或文件比水位新时返回 true
 */
export const hasCalendarCacheDiff = (diff: CalendarCacheDiff): boolean =>
  diff.stale || diff.file.total !== diff.db.total
  || diff.file.api !== diff.db.api || diff.file.daily !== diff.db.daily;

/**
 * 读取镜像表里的原始文件条目
 * @param key - 相对 .cache 的文件键
 * @returns {Promise<CalendarCacheEntry | null>} 条目，不存在时返回 null
 */
export const readCalendarCacheEntry = async (key: string): Promise<CalendarCacheEntry | null> => {
  await ensureMirrorTable();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT body, updated_at FROM \`${MIRROR_TABLE}\` WHERE file_key = ?`, [key],
  );
  if (rows.length === 0) return null;
  return { body: String(rows[0].body ?? ''), updatedAt: Number(rows[0].updated_at ?? 0) };
};

/**
 * 读取镜像表里的 JSON 文件
 * @param key - 相对 .cache 的文件键
 * @returns {Promise<unknown | null>} 解析结果，不存在或解析失败时返回 null
 */
export const readCalendarCacheJson = async (key: string): Promise<unknown | null> => {
  const entry = await readCalendarCacheEntry(key);
  if (!entry) return null;
  try {
    return JSON.parse(entry.body) as unknown;
  } catch {
    return null;
  }
};

/**
 * 列出镜像表里指定前缀的文件键
 * @param prefix - 键前缀
 * @returns {Promise<string[]>} 排序后的键列表
 */
export const listCalendarCacheKeys = async (prefix: string): Promise<string[]> => {
  await ensureMirrorTable();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT file_key FROM \`${MIRROR_TABLE}\` WHERE file_key LIKE ? ORDER BY file_key`,
    [`${prefix}%`],
  );
  return rows.map((row) => String(row.file_key));
};

/**
 * 列出 API 响应归档文件名（不含目录）
 * @returns {Promise<string[]>} 文件名列表
 */
export const listApiResponseFilesFromDb = async (): Promise<string[]> => {
  const keys = await listCalendarCacheKeys('api_responses/');
  return keys
    .filter((key) => key.endsWith('.json'))
    .map((key) => key.slice('api_responses/'.length))
    .sort();
};

/**
 * 列出每日数据文件名
 * @returns {Promise<string[]>} 文件名列表
 */
export const listDailyDataFilesFromDb = async (): Promise<string[]> =>
  listCalendarCacheKeys('daily_data_');

/**
 * 一次读出全部 API 响应归档条目（供清单模式计算大小与时间）
 * @returns {Promise<Array<{ filename: string; body: string; updatedAt: number }>>} 条目列表
 */
export const readApiResponseEntriesFromDb = async (): Promise<
  Array<{ filename: string; body: string; updatedAt: number }>
> => {
  await ensureMirrorTable();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT file_key, body, updated_at FROM \`${MIRROR_TABLE}\`
     WHERE file_key LIKE 'api_responses/%' AND file_key LIKE '%.json' ORDER BY file_key`,
  );
  return rows.map((row) => ({
    filename: String(row.file_key).slice('api_responses/'.length),
    body: String(row.body ?? ''),
    updatedAt: Number(row.updated_at ?? 0),
  }));
};
