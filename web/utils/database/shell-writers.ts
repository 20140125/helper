/**
 * shell 写入型缓存（自定义规则 / 每日一词 / 高德地理编码）的查询镜像与同步
 *
 * 设计说明：
 *   - custom_rules.json、dailyword_library.json、amap_geocode.json 由 shell 与 Web 双端写入，
 *     文件仍是写入与交换真源；custom_rules.json 含 webhookIds / custom_content / output_mode 等
 *     结构化表没有的字段，因此查询侧读 hp_shell_cache_files 里的原始 JSON 全文；
 *   - 同步时同时把规则 UPSERT 进 hp_custom_rules（不删除，保护 hp_rule_webhooks 外键），
 *     并重建 hp_cache_dailyword_library / hp_cache_amap_geocode，让 SQL 控制台也能查到最新数据；
 *   - 按文件 mtime 水位自动同步，写入后下一次查询即可收敛。
 */
import fs from 'fs';
import path from 'path';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { normalizeDbDateTime } from '@/utils/database/datetime';
import { CACHE_DIR } from '@/utils/paths';
import { formatDate } from '@/utils/script';
import { VALID_TYPES } from '@/types/rule';

/** 查询镜像表名 */
const MIRROR_TABLE = 'hp_shell_cache_files';
/** 记录上次同步时文件 mtime 的元数据键 */
const SYNC_META_KEY = 'shell_writers_sync_at';
/** 三份 shell 写入型缓存文件 */
const SOURCE_FILES = ['custom_rules.json', 'dailyword_library.json', 'amap_geocode.json'];

/** 单个待镜像文件 */
interface SourceFile {
  key: string;
  file: string;
  mtime: number;
}

/** 文件与数据库的差异报告 */
export interface ShellWritersDiff {
  file: { files: number; rules: number; dailyword: number; amap: number; mtime: number };
  db: { files: number; rules: number; dailyword: number; amap: number };
  stale: boolean;
}

/** custom_rules.json 中入库所需的字段 */
interface RuleFileRow {
  id?: string;
  name?: string;
  type?: string;
  condition?: string;
  time?: string;
  message?: string;
  template_id?: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  lastTriggeredAt?: string;
}

/** 扁平缓存表的一行 */
interface FlatCacheRow {
  section: string;
  row_key: string;
  data: string;
}

/**
 * 读取 JSON 文件
 * @param file - 绝对路径
 * @returns {T} 解析结果，缺失或异常时返回空对象
 */
const readJson = <T>(file: string): T => {
  if (!fs.existsSync(file)) return {} as T;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return {} as T;
  }
};

/**
 * 收集三份待镜像文件
 * @returns {SourceFile[]} 文件清单
 */
const collectSourceFiles = (): SourceFile[] =>
  SOURCE_FILES.flatMap((key) => {
    const file = path.join(CACHE_DIR, key);
    if (!fs.existsSync(file)) return [];
    const stat = fs.statSync(file);
    return stat.isFile() ? [{ key, file, mtime: Math.trunc(stat.mtimeMs) }] : [];
  });

/**
 * 计算文件清单的最大 mtime
 * @param files - 文件清单
 * @returns {number} 最大 mtime
 */
const maxMtime = (files: SourceFile[]): number =>
  files.reduce((max, item) => Math.max(max, item.mtime), 0);

/**
 * 确保查询镜像表存在
 * @returns {Promise<void>}
 */
const ensureMirrorTable = async (): Promise<void> => {
  await getPool().query(
    `CREATE TABLE IF NOT EXISTS \`${MIRROR_TABLE}\` (
      \`file_key\` VARCHAR(191) NOT NULL,
      \`body\` LONGTEXT NULL,
      \`updated_at\` BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (\`file_key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='shell 写入型缓存文件的查询镜像'`,
  );
};

/**
 * 把嵌套 JSON 展开为 (section, row_key, data) 行
 * @param doc - 文件解析结果
 * @returns {FlatCacheRow[]} 待入库行
 * @description 顶层标量存 row_key=''、data 为原文本；顶层对象的每个键单独一行，data 为该项 JSON
 */
const flattenCache = (doc: Record<string, unknown>): FlatCacheRow[] => {
  const rows: FlatCacheRow[] = [];
  const toData = (value: unknown): string =>
    (typeof value === 'string' ? value : JSON.stringify(value ?? null));
  for (const [section, value] of Object.entries(doc)) {
    if (value === null || typeof value !== 'object') {
      rows.push({ section, row_key: '', data: toData(value) });
      continue;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      rows.push({ section, row_key: key, data: toData(item) });
    }
  }
  return rows;
};

/**
 * 从文件全量同步查询镜像与结构化缓存表
 * @returns {Promise<{ files: number; rules: number; dailyword: number; amap: number }>} 同步条数
 */
export const syncShellWritersFromFiles = async (): Promise<{
  files: number; rules: number; dailyword: number; amap: number;
}> => {
  await ensureMirrorTable();
  const files = collectSourceFiles();
  const ruleRows = readJson<RuleFileRow[]>(path.join(CACHE_DIR, 'custom_rules.json'));
  const rules = Array.isArray(ruleRows) ? ruleRows : [];
  const validRules = rules.filter((rule) => rule.id
    && VALID_TYPES.includes(rule.type as typeof VALID_TYPES[number]));
  const dailywordRows = flattenCache(readJson<Record<string, unknown>>(path.join(CACHE_DIR, 'dailyword_library.json')));
  const amapRows = flattenCache(readJson<Record<string, unknown>>(path.join(CACHE_DIR, 'amap_geocode.json')));

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

    // 规则只做 UPSERT，不删除：hp_rule_webhooks 外键为 CASCADE，删除会连带清理关联关系
    for (const rule of validRules) {
      await conn.execute(
        `INSERT INTO hp_custom_rules
         (rule_key, name, type, condition_value, time, message, template_id, enabled,
          created_at, updated_at, last_triggered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type),
           condition_value = VALUES(condition_value), time = VALUES(time),
           message = VALUES(message), template_id = VALUES(template_id),
           enabled = VALUES(enabled), updated_at = VALUES(updated_at),
           last_triggered_at = VALUES(last_triggered_at)`,
        [String(rule.id), String(rule.name ?? ''), String(rule.type),
          String(rule.condition ?? ''), String(rule.time ?? '09:00'),
          String(rule.message ?? ''), rule.template_id ?? null,
          rule.enabled === false ? 0 : 1,
          normalizeDbDateTime(rule.created_at) ?? formatDate(),
          normalizeDbDateTime(rule.updated_at) ?? formatDate(),
          normalizeDbDateTime(rule.lastTriggeredAt)],
      );
    }

    const rebuild = async (table: string, rows: FlatCacheRow[], mtime: number): Promise<void> => {
      await conn.query(`DELETE FROM \`${table}\``);
      for (const row of rows) {
        await conn.execute(
          `INSERT INTO \`${table}\` (section, row_key, data, cache_updated_at) VALUES (?, ?, ?, ?)`,
          [row.section, row.row_key, row.data, mtime],
        );
      }
    };
    const dailyMtime = files.find((item) => item.key === 'dailyword_library.json')?.mtime ?? 0;
    const amapMtime = files.find((item) => item.key === 'amap_geocode.json')?.mtime ?? 0;
    await rebuild('hp_cache_dailyword_library', dailywordRows, dailyMtime);
    await rebuild('hp_cache_amap_geocode', amapRows, amapMtime);

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
    files: files.length,
    rules: validRules.length,
    dailyword: dailywordRows.length,
    amap: amapRows.length,
  };
};

/** 正在进行的同步（避免并发查询重复重建） */
let pendingSync: Promise<void> | null = null;

/**
 * 文件有更新时自动同步
 * @returns {Promise<void>}
 * @description 数据库不可用时由调用方降级读文件
 */
export const syncShellWritersIfStale = async (): Promise<void> => {
  if (pendingSync) return pendingSync;
  pendingSync = (async () => {
    await ensureMirrorTable();
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT meta_value FROM hp_cache_meta WHERE meta_key = ?', [SYNC_META_KEY],
    );
    const stored = Number(rows[0]?.meta_value ?? 0);
    if (maxMtime(collectSourceFiles()) > stored) await syncShellWritersFromFiles();
  })().finally(() => {
    pendingSync = null;
  });
  return pendingSync;
};

/**
 * 统计文件与数据库的差异
 * @returns {Promise<ShellWritersDiff>} 差异报告
 */
export const collectShellWritersDiff = async (): Promise<ShellWritersDiff> => {
  await ensureMirrorTable();
  const files = collectSourceFiles();
  const pool = getPool();
  const [mirrorRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM \`${MIRROR_TABLE}\``,
  );
  const [ruleRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_custom_rules');
  const [dailyRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_cache_dailyword_library');
  const [amapRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_cache_amap_geocode');
  const [metaRows] = await pool.query<RowDataPacket[]>(
    'SELECT meta_value FROM hp_cache_meta WHERE meta_key = ?', [SYNC_META_KEY],
  );
  const fileRules = readJson<RuleFileRow[]>(path.join(CACHE_DIR, 'custom_rules.json'));
  return {
    file: {
      files: files.length,
      rules: Array.isArray(fileRules) ? fileRules.length : 0,
      dailyword: flattenCache(readJson<Record<string, unknown>>(path.join(CACHE_DIR, 'dailyword_library.json'))).length,
      amap: flattenCache(readJson<Record<string, unknown>>(path.join(CACHE_DIR, 'amap_geocode.json'))).length,
      mtime: maxMtime(files),
    },
    db: {
      files: Number(mirrorRows[0]?.n ?? 0),
      rules: Number(ruleRows[0]?.n ?? 0),
      dailyword: Number(dailyRows[0]?.n ?? 0),
      amap: Number(amapRows[0]?.n ?? 0),
    },
    stale: maxMtime(files) > Number(metaRows[0]?.meta_value ?? 0),
  };
};

/**
 * 判断是否需要同步
 * @param diff - 差异报告
 * @returns {boolean} 数量不一致或文件比水位新时返回 true
 */
export const hasShellWritersDiff = (diff: ShellWritersDiff): boolean =>
  diff.stale
  || (Object.keys(diff.file).filter((key) => key !== 'mtime') as Array<keyof ShellWritersDiff['db']>)
    .some((key) => diff.file[key] !== diff.db[key]);

/**
 * 读取查询镜像里的 JSON 文件
 * @param key - 文件名（如 custom_rules.json）
 * @returns {Promise<T | null>} 解析结果，不存在或解析失败时返回 null
 */
export const readShellCacheJson = async <T>(key: string): Promise<T | null> => {
  await ensureMirrorTable();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT body FROM \`${MIRROR_TABLE}\` WHERE file_key = ?`, [key],
  );
  if (rows.length === 0) return null;
  try {
    return JSON.parse(String(rows[0].body ?? '')) as T;
  } catch {
    return null;
  }
};
