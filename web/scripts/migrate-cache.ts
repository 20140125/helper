/**
 * .cache/*.json → MySQL 查询库的分批迁移入口
 *
 * 设计约定：
 *   1. 默认只读（dry-run），只有显式传 --apply 才写库，避免误操作覆盖线上数据；
 *   2. 同一批次可重复执行：主键存在则跳过，不覆盖库中已有的记录；
 *   3. 库中已有的真实数据优先，文件只负责补齐缺失记录和收敛审批状态。
 *
 * 用法（在 web/ 目录下）：
 *   npm run migrate:cache
 *   npm run migrate:cache -- --batch=permission-requests --verify
 *   npm run migrate:cache -- --batch=api-metadata --apply
 *   npm run migrate:cache -- --batch=content-library --apply
 *   npm run migrate:cache -- --batch=calendar-cache --apply
 *   npm run migrate:cache -- --batch=shell-writers --apply
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { CACHE_DIR, PROJECT_DIR } from '@/utils/paths';
import { toDateText } from '@/utils/database/datetime';
import { getPool } from '@/utils/database/connection';
import {
  collectContentLibraryDiff,
  hasContentLibraryDiff,
  syncContentLibraryFromFiles,
} from '@/utils/database/content-library';
import {
  collectCalendarCacheDiff,
  hasCalendarCacheDiff,
  syncCalendarCacheFromFiles,
} from '@/utils/database/calendar-cache';
import {
  collectShellWritersDiff,
  hasShellWritersDiff,
  syncShellWritersFromFiles,
} from '@/utils/database/shell-writers';

dotenv.config({ path: path.join(PROJECT_DIR, 'web', '.env') });

/** 批次状态：ready=已实现，planned=已规划待实现 */
type BatchStatus = 'ready' | 'planned';

/** 迁移批次定义 */
interface MigrationBatch {
  /** 批次名（--batch 参数值） */
  name: string;
  /** 实现状态 */
  status: BatchStatus;
  /** 文件数据源 */
  source: string;
  /** 目标数据表 */
  target: string;
  /** 批次说明 */
  note: string;
}

/**
 * 迁移批次总表（按风险从低到高排列，逐批实现后再把 status 改为 ready）
 * @description 划分依据：是否只在 Web 侧读写、是否有 shell 写入链路
 */
const BATCHES: MigrationBatch[] = [
  {
    name: 'permission-requests',
    status: 'ready',
    source: '.cache/permission_requests.json',
    target: 'hp_permission_requests',
    note: '纯 Web 闭环，无 shell 依赖；权限申请记录',
  },
  {
    name: 'api-metadata',
    status: 'ready',
    source: '.cache/api_categories.json、api_items.json、webhooks.json',
    target: 'hp_api_categories、hp_api_items、hp_webhooks',
    note: 'Web 写入 + shell 只读，需保留文件镜像',
  },
  {
    name: 'content-library',
    status: 'ready',
    source: '.cache/greetings.json、reminder_quotes.json、message_templates.json',
    target: 'hp_greetings、hp_reminder_quotes、hp_message_templates 等',
    note: '文件保留元信息且 shell 会写入；查询走库，按文件 mtime 自动同步',
  },
  {
    name: 'calendar-cache',
    status: 'ready',
    source: '.cache/holiday_data.json、month_config.json、daily_data_*.json、api_responses/*',
    target: 'hp_holiday_data、hp_month_config、hp_daily_data、hp_cache_res_*',
    note: 'shell 写入；查询走 hp_cache_files 镜像，按文件 mtime 自动同步',
  },
  {
    name: 'shell-writers',
    status: 'ready',
    source: '.cache/custom_rules.json、dailyword_library.json、amap_geocode.json',
    target: 'hp_custom_rules、hp_cache_dailyword_library、hp_cache_amap_geocode',
    note: 'shell 为写入真源；查询走 hp_shell_cache_files 镜像，文件保留供 shell 读写',
  },
];

/** 权限申请状态枚举 */
type RequestStatus = 'pending' | 'approved' | 'rejected';

/** JSON 快照中的申请记录（字段为驼峰命名） */
interface LegacyRequest {
  request_id?: string;
  email?: string;
  fromPath?: string;
  reason?: string;
  status?: string;
  created_at?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  rejectReason?: string;
}

/** 规范化后可直接写入数据库的记录 */
interface RequestRow {
  requestId: string;
  email: string;
  fromPath: string;
  reason: string | null;
  status: RequestStatus;
  rejectReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** 文件与数据库的差异报告 */
interface BatchDiff {
  fileRows: RequestRow[];
  dbCount: number;
  missing: RequestRow[];
  stale: RequestRow[];
  hasUniqueKey: boolean;
}

/**
 * 打印批次总表
 * @description 不传 --batch 时展示迁移计划与实现进度
 */
const printBatches = (): void => {
  console.log('分批迁移计划（默认只读，写库需 --apply）：');
  BATCHES.forEach((batch, index) => {
    console.log(`  ${index + 1}. [${batch.status === 'ready' ? '可执行' : '计划中'}] ${batch.name}`);
    console.log(`     源：${batch.source}`);
    console.log(`     目标：${batch.target}`);
    console.log(`     说明：${batch.note}`);
  });
  console.log('用法：npm run migrate:cache -- --batch=<批次名> [--verify|--apply]');
};

/**
 * 建立数据库连接
 * @returns {Promise<mysql.Connection>} 独立连接，便于脚本退出时显式关闭
 */
const openConnection = async (): Promise<mysql.Connection> => {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('数据库未配置：请检查 web/.env 中的 DB_HOST / DB_USER / DB_NAME');
  }
  return mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD ?? '',
    database: DB_NAME,
    charset: 'utf8mb4',
  });
};

/**
 * 把文件里的日期文本规范化为 MySQL DATETIME 文本
 * @param value - 原始值（支持 2026/5/6 10:26:27、ISO 8601 等）
 * @returns {string | null} YYYY-MM-DD HH:mm:ss 或 null
 */
const normalizeDateTime = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const pad = (part: string): string => part.padStart(2, '0');
  const matched = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})/);
  if (matched) {
    return `${matched[1]}-${pad(matched[2])}-${pad(matched[3])} ${pad(matched[4])}:${matched[5]}:${matched[6]}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * 把 JSON 快照记录转换为待入库的行
 * @param item - 文件记录
 * @returns {RequestRow} 规范化记录
 */
const toRequestRow = (item: LegacyRequest): RequestRow => ({
  requestId: String(item.request_id ?? ''),
  email: String(item.email ?? ''),
  fromPath: String(item.fromPath ?? ''),
  reason: item.reason ? String(item.reason) : null,
  status: item.status === 'approved' || item.status === 'rejected' ? item.status : 'pending',
  rejectReason: item.rejectReason ? String(item.rejectReason) : null,
  resolvedBy: item.resolvedBy ? String(item.resolvedBy) : null,
  resolvedAt: normalizeDateTime(item.resolvedAt),
  createdAt: normalizeDateTime(item.created_at) ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
});

/**
 * 读取权限申请 JSON 快照
 * @returns {RequestRow[]} 有效记录列表
 */
const readLegacyRequests = (): RequestRow[] => {
  const file = path.join(CACHE_DIR, 'permission_requests.json');
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { requests?: LegacyRequest[] };
  return (parsed.requests ?? []).map(toRequestRow).filter((row) => row.requestId.length > 0);
};

/**
 * 检查 hp_permission_requests 是否已有 request_id 唯一键
 * @param conn - 数据库连接
 * @returns {Promise<boolean>} 唯一键是否存在
 */
const hasUniqueKey = async (conn: mysql.Connection): Promise<boolean> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hp_permission_requests'
       AND INDEX_NAME = 'uk_request_id' LIMIT 1`,
  );
  return rows.length > 0;
};

/**
 * 计算文件与数据库的差异（只读）
 * @param conn - 数据库连接
 * @returns {Promise<BatchDiff>} 差异报告
 */
const collectDiff = async (conn: mysql.Connection): Promise<BatchDiff> => {
  const fileRows = readLegacyRequests();
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT request_id, status FROM hp_permission_requests',
  );
  const dbStatus = new Map(rows.map((row) => [String(row.request_id), String(row.status)]));
  return {
    fileRows,
    dbCount: rows.length,
    missing: fileRows.filter((row) => !dbStatus.has(row.requestId)),
    // 降级写快照期间，库里可能仍是 pending；只收敛这类状态差异，不覆盖其它字段
    stale: fileRows.filter((row) => dbStatus.get(row.requestId) === 'pending' && row.status !== 'pending'),
    hasUniqueKey: await hasUniqueKey(conn),
  };
};

/**
 * 打印差异报告（只输出记录 ID，不输出邮箱等个人信息）
 * @param diff - 差异报告
 * @param title - 报告标题
 */
const printDiff = (diff: BatchDiff, title = '当前差异'): void => {
  console.log(`${title}：文件 ${diff.fileRows.length} 条 / 数据库 ${diff.dbCount} 条`);
  console.log(`  待补记录：${diff.missing.length} 条${diff.missing.length ? `（${diff.missing.map((r) => r.requestId).join('、')}）` : ''}`);
  console.log(`  待收敛状态：${diff.stale.length} 条${diff.stale.length ? `（${diff.stale.map((r) => r.requestId).join('、')}）` : ''}`);
  console.log(`  request_id 唯一键：${diff.hasUniqueKey ? '已存在' : '缺失'}`);
};

/**
 * 判断是否存在需要迁移的差异
 * @param diff - 差异报告
 * @returns {boolean} 是否需要执行迁移
 */
const hasDiff = (diff: BatchDiff): boolean =>
  diff.missing.length > 0 || diff.stale.length > 0 || !diff.hasUniqueKey;

/**
 * 执行第一批迁移：补唯一键、插入缺失记录、收敛审批状态
 * @param conn - 数据库连接
 * @param diff - 迁移前差异报告
 */
const applyBatch = async (conn: mysql.Connection, diff: BatchDiff): Promise<void> => {
  if (!diff.hasUniqueKey) {
    await conn.query('ALTER TABLE `hp_permission_requests` ADD UNIQUE KEY `uk_request_id` (`request_id`)');
    console.log('已补齐唯一键 uk_request_id');
  }
  await conn.beginTransaction();
  try {
    for (const row of diff.missing) {
      await conn.execute(
        `INSERT IGNORE INTO hp_permission_requests
         (request_id, email, from_path, reason, status, reject_reason, resolved_by, resolved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.requestId, row.email, row.fromPath, row.reason, row.status,
          row.rejectReason, row.resolvedBy, row.resolvedAt, row.createdAt],
      );
    }
    for (const row of diff.stale) {
      await conn.execute(
        `UPDATE hp_permission_requests
         SET status = ?, reject_reason = ?, resolved_by = ?, resolved_at = ?
         WHERE request_id = ? AND status = 'pending'`,
        [row.status, row.rejectReason, row.resolvedBy, row.resolvedAt, row.requestId],
      );
    }
    await conn.commit();
    console.log(`已补齐 ${diff.missing.length} 条记录、收敛 ${diff.stale.length} 条状态`);
  } catch (err) {
    await conn.rollback();
    throw err;
  }
};

// ==============================
// 批次 2：接口分类 / API 条目 / Webhook
// ==============================

/** JSON 快照中的接口分类 */
interface LegacyApiCategory {
  category_key?: string;
  name?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

/** JSON 快照中的 API 条目（category_id 存分类业务标识） */
interface LegacyApiItem {
  item_key?: string;
  category_id?: string;
  name?: string;
  method?: string;
  path?: string;
  description?: string;
  enabled?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

/** JSON 快照中的企业微信机器人 */
interface LegacyWebhook {
  id?: string;
  name?: string;
  url?: string;
  style?: string;
  created_at?: string;
  updated_at?: string;
}

/** 批次 2 差异报告 */
interface ApiMetadataDiff {
  categories: LegacyApiCategory[];
  items: LegacyApiItem[];
  webhookFile: LegacyWebhook[];
  dbCategories: number;
  dbItems: number;
  dbWebhooks: number;
  categoryMissing: string[];
  itemMissing: string[];
  webhookMissingInDb: string[];
  mirrorOutOfSync: boolean;
}

/**
 * 读取 .cache 下的数组型 JSON 快照
 * @param fileName - 相对 CACHE_DIR 的文件名
 * @returns {T[]} 解析后的数组，文件不存在或格式异常时返回空数组
 */
const readLegacyArray = <T>(fileName: string): T[] => {
  const filePath = path.join(CACHE_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

/**
 * 计算批次 2 的文件与数据库差异（只读）
 * @param conn - 数据库连接
 * @returns {Promise<ApiMetadataDiff>} 差异报告
 */
const collectApiMetadataDiff = async (conn: mysql.Connection): Promise<ApiMetadataDiff> => {
  const categories = readLegacyArray<LegacyApiCategory>('api_categories.json')
    .filter((item) => typeof item.category_key === 'string' && item.category_key.length > 0);
  const items = readLegacyArray<LegacyApiItem>('api_items.json')
    .filter((item) => typeof item.item_key === 'string' && item.item_key.length > 0);
  const webhookFile = readLegacyArray<LegacyWebhook>('webhooks.json')
    .filter((item) => typeof item.id === 'string' && item.id.length > 0);

  const [catRows] = await conn.query<RowDataPacket[]>('SELECT category_key FROM hp_api_categories');
  const [itemRows] = await conn.query<RowDataPacket[]>('SELECT item_key FROM hp_api_items');
  const [hookRows] = await conn.query<RowDataPacket[]>('SELECT webhook_key FROM hp_webhooks');

  const catKeys = new Set(catRows.map((row) => String(row.category_key)));
  const itemKeys = new Set(itemRows.map((row) => String(row.item_key)));
  const hookKeys = new Set(hookRows.map((row) => String(row.webhook_key)));
  const fileHookKeys = webhookFile.map((item) => String(item.id)).sort();
  const dbHookKeys = hookRows.map((row) => String(row.webhook_key)).sort();

  return {
    categories,
    items,
    webhookFile,
    dbCategories: catRows.length,
    dbItems: itemRows.length,
    dbWebhooks: hookRows.length,
    categoryMissing: categories
      .filter((item) => !catKeys.has(String(item.category_key)))
      .map((item) => String(item.category_key)),
    itemMissing: items
      .filter((item) => !itemKeys.has(String(item.item_key)))
      .map((item) => String(item.item_key)),
    webhookMissingInDb: webhookFile
      .filter((item) => !hookKeys.has(String(item.id)))
      .map((item) => String(item.id)),
    // shell 只读 JSON 镜像，必须与库里的机器人清单完全一致
    mirrorOutOfSync: fileHookKeys.length !== dbHookKeys.length
      || fileHookKeys.some((key, index) => key !== dbHookKeys[index]),
  };
};

/**
 * 打印批次 2 差异报告（只输出记录标识，不输出 Webhook URL）
 * @param diff - 差异报告
 * @param title - 报告标题
 */
const printApiMetadataDiff = (diff: ApiMetadataDiff, title = '当前差异'): void => {
  console.log(`${title}：`);
  console.log(`  接口分类：文件 ${diff.categories.length} / 库 ${diff.dbCategories}，待补 ${diff.categoryMissing.length} 条`
    + (diff.categoryMissing.length ? `（${diff.categoryMissing.join('、')}）` : ''));
  console.log(`  API 条目：文件 ${diff.items.length} / 库 ${diff.dbItems}，待补 ${diff.itemMissing.length} 条`
    + (diff.itemMissing.length ? `（${diff.itemMissing.join('、')}）` : ''));
  console.log(`  Webhook：库 ${diff.dbWebhooks} / 镜像 ${diff.webhookFile.length}，待入库 ${diff.webhookMissingInDb.length} 条`
    + `，镜像需同步：${diff.mirrorOutOfSync ? '是' : '否'}`);
};

/**
 * 判断批次 2 是否存在待迁移差异
 * @param diff - 差异报告
 * @returns {boolean} 是否需要执行迁移
 */
const hasApiMetadataDiff = (diff: ApiMetadataDiff): boolean =>
  diff.categoryMissing.length > 0
  || diff.itemMissing.length > 0
  || diff.webhookMissingInDb.length > 0
  || diff.mirrorOutOfSync;

/**
 * 从数据库重建 shell 只读的 Webhook JSON 镜像
 * @param conn - 数据库连接
 * @description 库为唯一真源；镜像含真实 URL，已被 .gitignore 忽略，不输出到日志
 */
const syncWebhookMirror = async (conn: mysql.Connection): Promise<void> => {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT webhook_key, name, url, style, created_at, updated_at FROM hp_webhooks ORDER BY id',
  );
  const mirror = rows.map((row) => ({
    id: String(row.webhook_key),
    name: String(row.name),
    url: String(row.url),
    style: row.style === null ? '' : String(row.style),
    created_at: toDateText(row.created_at),
    updated_at: toDateText(row.updated_at),
  }));
  fs.writeFileSync(path.join(CACHE_DIR, 'webhooks.json'), JSON.stringify(mirror, null, 2), 'utf-8');
  console.log(`已同步 Webhook JSON 镜像：${mirror.length} 条（供 shell 只读）`);
};

/**
 * 执行批次 2 迁移：补齐分类/条目/机器人并重建 shell 镜像
 * @param conn - 数据库连接
 * @param diff - 迁移前差异报告
 */
const applyApiMetadataBatch = async (conn: mysql.Connection, diff: ApiMetadataDiff): Promise<void> => {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.beginTransaction();
  try {
    for (const key of diff.categoryMissing) {
      const category = diff.categories.find((item) => item.category_key === key);
      if (!category) continue;
      await conn.execute(
        `INSERT IGNORE INTO hp_api_categories (category_key, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [key, String(category.name ?? ''), String(category.description ?? ''),
          normalizeDateTime(category.created_at) ?? now, normalizeDateTime(category.updated_at) ?? now],
      );
    }
    const [catRows] = await conn.query<RowDataPacket[]>('SELECT id, category_key FROM hp_api_categories');
    const categoryIds = new Map(catRows.map((row) => [String(row.category_key), Number(row.id)]));
    for (const key of diff.itemMissing) {
      const item = diff.items.find((entry) => entry.item_key === key);
      if (!item) continue;
      const categoryId = categoryIds.get(String(item.category_id ?? ''));
      if (!categoryId) throw new Error(`接口分类不存在：${item.category_id}`);
      await conn.execute(
        `INSERT IGNORE INTO hp_api_items
         (item_key, category_id, name, method, path, description, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [key, categoryId, String(item.name ?? ''), String(item.method ?? 'GET'),
          String(item.path ?? ''), String(item.description ?? ''),
          item.enabled === false || item.enabled === 0 ? 0 : 1,
          normalizeDateTime(item.created_at) ?? now, normalizeDateTime(item.updated_at) ?? now],
      );
    }
    for (const key of diff.webhookMissingInDb) {
      const webhook = diff.webhookFile.find((item) => item.id === key);
      if (!webhook) continue;
      await conn.execute(
        `INSERT IGNORE INTO hp_webhooks (webhook_key, name, url, style, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [key, String(webhook.name ?? ''), String(webhook.url ?? ''), String(webhook.style ?? ''),
          normalizeDateTime(webhook.created_at) ?? now, normalizeDateTime(webhook.updated_at) ?? now],
      );
    }
    await conn.commit();
    console.log(`已补齐分类 ${diff.categoryMissing.length} 条、API 条目 ${diff.itemMissing.length} 条、`
      + `机器人 ${diff.webhookMissingInDb.length} 条`);
  } catch (err) {
    await conn.rollback();
    throw err;
  }
  await syncWebhookMirror(conn);
};

// ==============================
// 批次 3：内容库（祝福语 / 提醒寄语 / 消息模板）
// ==============================

/** 批次 3 差异报告类型（由模块函数推导，避免重复定义结构） */
type ContentDiff = Awaited<ReturnType<typeof collectContentLibraryDiff>>;

/**
 * 打印批次 3 差异报告
 * @param diff - 差异报告
 * @param title - 报告标题
 */
const printContentLibraryDiff = (diff: ContentDiff, title = '当前差异'): void => {
  console.log(`${title}：`);
  console.log(`  祝福语：文件 ${diff.file.greetings} / 库 ${diff.db.greetings}`);
  console.log(`  提醒寄语：文件 ${diff.file.quotes} / 库 ${diff.db.quotes}`);
  console.log(`  消息模板：文件 ${diff.file.templates} / 库 ${diff.db.templates}`);
  console.log(`  模板风格：文件 ${diff.file.styles} / 库 ${diff.db.styles}；显示名：文件 ${diff.file.names} / 库 ${diff.db.names}`);
  console.log(`  文件比同步水位新：${diff.stale ? '是' : '否'}`);
};

/**
 * 执行/校验批次 3
 * @param args - 命令行参数
 * @description 该批次直接复用运行时同步模块，脚本退出前显式关闭连接池
 */
const runContentLibraryBatch = async (args: string[]): Promise<void> => {
  try {
    const diff = await collectContentLibraryDiff();
    printContentLibraryDiff(diff);
    if (args.includes('--apply')) {
      if (hasContentLibraryDiff(diff)) {
        const stats = await syncContentLibraryFromFiles();
        console.log(`已从文件同步：祝福语 ${stats.greetings} 条、寄语 ${stats.quotes} 条、`
          + `模板 ${stats.templates} 条、风格 ${stats.styles} 条、显示名 ${stats.names} 条`);
      } else {
        console.log('无需写入，数据已一致');
      }
      const after = await collectContentLibraryDiff();
      printContentLibraryDiff(after, '迁移后复核');
      if (hasContentLibraryDiff(after)) process.exitCode = 1;
    } else if (args.includes('--verify')) {
      if (hasContentLibraryDiff(diff)) process.exitCode = 1;
    } else {
      console.log('dry-run：未写库。确认后加 --apply 执行迁移');
    }
  } finally {
    await getPool().end();
  }
};

// ==============================
// 批次 4：日历 / 每日数据 / API 响应归档
// ==============================

/** 批次 4 差异报告类型（由模块函数推导） */
type CalendarDiff = Awaited<ReturnType<typeof collectCalendarCacheDiff>>;

/**
 * 打印批次 4 差异报告
 * @param diff - 差异报告
 * @param title - 报告标题
 */
const printCalendarCacheDiff = (diff: CalendarDiff, title = '当前差异'): void => {
  console.log(`${title}：`);
  console.log(`  文件总数：文件 ${diff.file.total} / 镜像 ${diff.db.total}`);
  console.log(`  API 响应：文件 ${diff.file.api} / 镜像 ${diff.db.api}；每日数据：文件 ${diff.file.daily} / 镜像 ${diff.db.daily}`);
  console.log(`  文件比同步水位新：${diff.stale ? '是' : '否'}`);
};

/**
 * 执行/校验批次 4
 * @param args - 命令行参数
 * @description 复用运行时镜像同步模块，脚本退出前显式关闭连接池
 */
const runCalendarCacheBatch = async (args: string[]): Promise<void> => {
  try {
    const diff = await collectCalendarCacheDiff();
    printCalendarCacheDiff(diff);
    if (args.includes('--apply')) {
      if (hasCalendarCacheDiff(diff)) {
        const stats = await syncCalendarCacheFromFiles();
        console.log(`已从文件同步：共 ${stats.total} 个文件（API 响应 ${stats.api} 个、每日数据 ${stats.daily} 个）`);
      } else {
        console.log('无需写入，数据已一致');
      }
      const after = await collectCalendarCacheDiff();
      printCalendarCacheDiff(after, '迁移后复核');
      if (hasCalendarCacheDiff(after)) process.exitCode = 1;
    } else if (args.includes('--verify')) {
      if (hasCalendarCacheDiff(diff)) process.exitCode = 1;
    } else {
      console.log('dry-run：未写库。确认后加 --apply 执行迁移');
    }
  } finally {
    await getPool().end();
  }
};

// ==============================
// 批次 5：shell 写入型缓存（规则 / 每日一词 / 高德地理编码）
// ==============================

/** 批次 5 差异报告类型（由模块函数推导） */
type ShellDiff = Awaited<ReturnType<typeof collectShellWritersDiff>>;

/**
 * 打印批次 5 差异报告
 * @param diff - 差异报告
 * @param title - 报告标题
 */
const printShellWritersDiff = (diff: ShellDiff, title = '当前差异'): void => {
  console.log(`${title}：`);
  console.log(`  镜像文件：文件 ${diff.file.files} / 库 ${diff.db.files}`);
  console.log(`  自定义规则：文件 ${diff.file.rules} / 库 ${diff.db.rules}`);
  console.log(`  每日一词：文件 ${diff.file.dailyword} / 库 ${diff.db.dailyword}；高德缓存：文件 ${diff.file.amap} / 库 ${diff.db.amap}`);
  console.log(`  文件比同步水位新：${diff.stale ? '是' : '否'}`);
};

/**
 * 执行/校验批次 5
 * @param args - 命令行参数
 * @description 复用运行时镜像同步模块，脚本退出前显式关闭连接池
 */
const runShellWritersBatch = async (args: string[]): Promise<void> => {
  try {
    const diff = await collectShellWritersDiff();
    printShellWritersDiff(diff);
    if (args.includes('--apply')) {
      if (hasShellWritersDiff(diff)) {
        const stats = await syncShellWritersFromFiles();
        console.log(`已从文件同步：镜像 ${stats.files} 个文件、规则 ${stats.rules} 条、`
          + `每日一词 ${stats.dailyword} 行、高德缓存 ${stats.amap} 行`);
      } else {
        console.log('无需写入，数据已一致');
      }
      const after = await collectShellWritersDiff();
      printShellWritersDiff(after, '迁移后复核');
      if (hasShellWritersDiff(after)) process.exitCode = 1;
    } else if (args.includes('--verify')) {
      if (hasShellWritersDiff(diff)) process.exitCode = 1;
    } else {
      console.log('dry-run：未写库。确认后加 --apply 执行迁移');
    }
  } finally {
    await getPool().end();
  }
};

/**
 * 命令行入口
 * @description --verify 用退出码标记差异；--apply 执行写入并复核；默认 dry-run
 */
const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const batchName = args.find((arg) => arg.startsWith('--batch='))?.slice('--batch='.length) ?? '';
  if (!batchName) {
    printBatches();
    return;
  }
  const batch = BATCHES.find((item) => item.name === batchName);
  if (!batch) {
    console.error(`未知批次：${batchName}`);
    printBatches();
    process.exitCode = 1;
    return;
  }
  if (batch.status === 'planned') {
    console.log(`批次 ${batch.name} 仍在计划中：${batch.note}`);
    return;
  }

  if (batch.name === 'content-library' || batch.name === 'calendar-cache' || batch.name === 'shell-writers') {
    if (batch.name === 'content-library') await runContentLibraryBatch(args);
    else if (batch.name === 'calendar-cache') await runCalendarCacheBatch(args);
    else await runShellWritersBatch(args);
    return;
  }

  const conn = await openConnection();
  try {
    if (batch.name === 'api-metadata') {
      const apiDiff = await collectApiMetadataDiff(conn);
      printApiMetadataDiff(apiDiff);
      if (args.includes('--apply')) {
        if (hasApiMetadataDiff(apiDiff)) await applyApiMetadataBatch(conn, apiDiff);
        else {
          console.log('无需补数据，直接从库重建 Webhook 镜像');
          await syncWebhookMirror(conn);
        }
        const after = await collectApiMetadataDiff(conn);
        printApiMetadataDiff(after, '迁移后复核');
        if (hasApiMetadataDiff(after)) process.exitCode = 1;
      } else if (args.includes('--verify')) {
        if (hasApiMetadataDiff(apiDiff)) process.exitCode = 1;
      } else {
        console.log('dry-run：未写库。确认后加 --apply 执行迁移');
      }
      return;
    }

    const diff = await collectDiff(conn);
    printDiff(diff);
    if (args.includes('--apply')) {
      if (hasDiff(diff)) await applyBatch(conn, diff);
      else console.log('无需写入，数据已一致');
      const after = await collectDiff(conn);
      printDiff(after, '迁移后复核');
      if (hasDiff(after)) process.exitCode = 1;
    } else if (args.includes('--verify')) {
      if (hasDiff(diff)) process.exitCode = 1;
    } else {
      console.log('dry-run：未写库。确认后加 --apply 执行迁移');
    }
  } finally {
    await conn.end();
  }
};

main().catch((err: Error) => {
  console.error(`[migrate-cache] 迁移失败：${err.message}`);
  process.exitCode = 1;
});
