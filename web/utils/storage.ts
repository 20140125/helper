import fs from 'fs';
import type { RowDataPacket } from 'mysql2';
import { Rule, RULES_FILE } from '@/types/rule';
import { Webhook, WEBHOOKS_FILE } from '@/types/webhook';
import { CACHE_DIR } from './paths';
import { formatDate } from './script';
import { getPool } from '@/utils/database/connection';
import { toDateText, normalizeDbDateTime } from '@/utils/database/datetime';
import { syncShellWritersIfStale, readShellCacheJson } from '@/utils/database/shell-writers';

/**
 * 读取自定义规则 JSON 快照（数据库不可用时的降级数据）
 * @returns {Rule[]} 规则列表
 */
const readLegacyRules = (): Rule[] => {
  if (!fs.existsSync(RULES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8')) as Rule[];
  } catch {
    return [];
  }
};

/**
 * 读取自定义规则列表
 * @returns {Promise<Rule[]>} 规则列表
 * @description 优先读数据库查询镜像；文件写入后按 mtime 自动同步，失败时降级读文件
 */
export const readRules = async (): Promise<Rule[]> => {
  try {
    await syncShellWritersIfStale();
    const rules = await readShellCacheJson<Rule[]>('custom_rules.json');
    if (Array.isArray(rules)) return rules;
    throw new Error('查询镜像里的规则格式异常');
  } catch (err) {
    console.warn('[storage] 读取规则镜像失败，回退 JSON：', (err as Error).message);
    return readLegacyRules();
  }
};

/**
 * 写入自定义规则列表
 * @param {Rule[]} rules - 规则列表
 */
export const writeRules = (rules: Rule[]): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
};

/**
 * 读取 Webhook JSON 快照（兼容旧版驼峰字段，数据库不可用时的降级数据）
 * @returns {Webhook[]} Webhook 列表
 */
const readLegacyWebhooks = (): Webhook[] => {
  if (!fs.existsSync(WEBHOOKS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(WEBHOOKS_FILE, 'utf-8')) as Record<string, unknown>[];
    return raw.map((item) => ({
      id: (item.id as string) ?? '',
      name: (item.name as string) ?? '',
      url: (item.url as string) ?? '',
      style: (item.style as string) ?? '',
      created_at: (item.created_at as string) ?? (item.createdAt as string) ?? '',
      updated_at: (item.updated_at as string) ?? (item.updatedAt as string) ?? '',
    }));
  } catch {
    return [];
  }
};

/**
 * 写入 Webhook JSON 快照
 * @param {Webhook[]} webhooks - Webhook 列表
 * @description shell 脚本只读这份文件，因此无论数据库写入是否成功都要同步镜像
 */
const writeLegacyWebhooks = (webhooks: Webhook[]): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf-8');
};

/**
 * 从数据库读取 Webhook 列表
 * @returns {Promise<Webhook[]>} Webhook 列表
 * @description 库中唯一键为 webhook_key，映射回业务层的 id
 */
const readWebhooksFromDb = async (): Promise<Webhook[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT webhook_key, name, url, style, created_at, updated_at FROM hp_webhooks ORDER BY id',
  );
  return rows.map((row) => ({
    id: String(row.webhook_key),
    name: String(row.name),
    url: String(row.url),
    style: row.style === null ? '' : String(row.style),
    created_at: toDateText(row.created_at),
    updated_at: toDateText(row.updated_at),
  }));
};

/**
 * 把 Webhook 全量同步到数据库
 * @param {Webhook[]} webhooks - Webhook 列表
 * @returns {Promise<void>}
 * @description 与旧版整份覆盖语义一致：UPSERT 现存项并删除列表外的机器人
 */
const writeWebhooksToDb = async (webhooks: Webhook[]): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const webhook of webhooks) {
      await conn.execute(
        `INSERT INTO hp_webhooks (webhook_key, name, url, style, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), url = VALUES(url),
           style = VALUES(style), updated_at = VALUES(updated_at)`,
        [webhook.id, webhook.name, webhook.url, webhook.style ?? '',
          normalizeDbDateTime(webhook.created_at) ?? formatDate(),
          normalizeDbDateTime(webhook.updated_at) ?? formatDate()],
      );
    }
    const keys = webhooks.map((webhook) => webhook.id);
    if (keys.length === 0) {
      await conn.query('DELETE FROM hp_webhooks');
    } else {
      await conn.query('DELETE FROM hp_webhooks WHERE webhook_key NOT IN (?)', [keys]);
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
 * 读取 Webhook 列表
 * @returns {Promise<Webhook[]>} Webhook 列表
 * @description 优先查库；数据库不可用时降级读取本地 JSON 快照
 */
export const readWebhooks = async (): Promise<Webhook[]> => {
  try {
    return await readWebhooksFromDb();
  } catch (err) {
    console.warn('[storage] 读取 hp_webhooks 失败，回退 JSON：', (err as Error).message);
    return readLegacyWebhooks();
  }
};

/**
 * 写入 Webhook 列表
 * @param {Webhook[]} webhooks - Webhook 列表
 * @returns {Promise<void>}
 * @description 库为查询真源；同时保留 JSON 镜像给 shell 脚本读取，写库失败时镜像仍可用
 */
export const writeWebhooks = async (webhooks: Webhook[]): Promise<void> => {
  try {
    await writeWebhooksToDb(webhooks);
  } catch (err) {
    console.warn('[storage] 写入 hp_webhooks 失败，仅保留 JSON 镜像：', (err as Error).message);
  }
  writeLegacyWebhooks(webhooks);
};
