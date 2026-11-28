import type { RowDataPacket } from 'mysql2';
import { Rule } from '@/types/rule';
import { Webhook } from '@/types/webhook';
import { formatDate } from './script';
import { getPool } from '@/utils/database/connection';
import { toDateText, normalizeDbDateTime } from '@/utils/database/datetime';
import { readCacheJson, writeCacheJson } from '@/utils/database/cache-store';

/** 自定义规则缓存键（真源为 已有业务表） */
const RULES_KEY = 'custom_rules.json';

/** Webhook JSON 镜像缓存键（供 shell 脚本读取） */
const WEBHOOKS_KEY = 'webhooks.json';

/**
 * 读取自定义规则列表
 * @returns {Promise<Rule[]>} 规则列表；缓存不存在时返回空数组
 * @description 直接读取缓存 KV，不再降级读磁盘文件
 */
export const readRules = async (): Promise<Rule[]> => {
  const rules = await readCacheJson<Rule[]>(RULES_KEY);
  return Array.isArray(rules) ? rules : [];
};

/**
 * 写入自定义规则列表
 * @param {Rule[]} rules - 规则列表
 * @returns {Promise<void>}
 * @description 通过缓存 KV 全量覆盖，序列化格式与旧版一致（2 空格缩进）
 */
export const writeRules = async (rules: Rule[]): Promise<void> => {
  await writeCacheJson(RULES_KEY, rules);
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
 * @description 直接查库；数据库异常由路由层捕获并转成 500
 */
export const readWebhooks = async (): Promise<Webhook[]> => readWebhooksFromDb();

/**
 * 写入 Webhook JSON 镜像（缓存 KV）
 * @param {Webhook[]} webhooks - Webhook 列表
 * @returns {Promise<void>}
 * @description shell 脚本只读这份 KV，因此无论数据库写入是否成功都要同步镜像；不再写磁盘
 */
const writeLegacyWebhooks = async (webhooks: Webhook[]): Promise<void> => {
  await writeCacheJson(WEBHOOKS_KEY, webhooks);
};

/**
 * 写入 Webhook 列表
 * @param {Webhook[]} webhooks - Webhook 列表
 * @returns {Promise<void>}
 * @description 库为查询真源；写库无论成败都同步写一份 KV 镜像供 shell 读取
 */
export const writeWebhooks = async (webhooks: Webhook[]): Promise<void> => {
  try {
    await writeWebhooksToDb(webhooks);
  } catch (err) {
    console.warn('[storage] 写入 hp_webhooks 失败，仍同步 KV 镜像：', (err as Error).message);
  }
  await writeLegacyWebhooks(webhooks);
};
