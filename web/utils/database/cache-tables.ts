/**
 * 已有业务表访问层
 * @description 缓存键按 sql/ 里既有的业务表读写：JSON 展开成行、读取时按结构还原全文；
 *   api_responses/*.json 走 hp_cache_res_* 分类表，其它无业务表的键走 hp_cache_res_other。
 *   不新建任何表；分类表写入时同步 period_type / period_key，显式记录按天 / 按月 / 按年粒度。
 */
import type { RowDataPacket } from 'mysql2';
import { getPool } from './connection';
import {
  buildCacheUnionSql,
  ensureCacheTables,
  isApiResponseKey,
  resolveCachePeriod,
  resolveCacheTarget,
} from './cache-routing';

/** 无对应业务表时的已有兜底表（asset_key 存完整缓存键） */
const OTHER_TABLE = 'hp_cache_res_other';
/** 有业务表维护的静态缓存键 */
const BUSINESS_KEYS = [
  'greetings.json', 'reminder_quotes.json', 'message_templates.json', 'custom_rules.json',
  'dailyword_library.json', 'amap_geocode.json', 'holiday_data.json', 'month_config.json',
  'daemon_sent_state.json', 'webhooks.json', 'ai-model-configs.json',
];
/** 祝福语命名分组 */
const GREETING_GROUPS = ['solar_terms', 'holidays', 'lunar_festivals', 'special_days'];
/** 寄语三餐与星期 */
const MEALS = ['breakfast', 'lunch', 'dinner'];
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend'];

/** 通用数据行 */
type Row = Record<string, unknown>;

/** 执行查询并返回行 */
const query = async (sql: string, params: unknown[] = []): Promise<RowDataPacket[]> =>
  (await getPool().query<RowDataPacket[]>(sql, params))[0];

/** 把值规范化为 mysql2 可绑定的标量 */
const toSqlValue = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return Number(value);
  return JSON.stringify(value);
};

/** 全量替换一张业务表 */
const replace = async (table: string, columns: string[], rows: Row[]): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM \`${table}\``);
    const cols = columns.map((name) => `\`${name}\``).join(', ');
    for (let start = 0; start < rows.length; start += 40) {
      const chunk = rows.slice(start, start + 40);
      const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      const values = chunk.flatMap((row) => columns.map((name) => toSqlValue(row[name])));
      await conn.execute(`INSERT INTO \`${table}\` (${cols}) VALUES ${placeholders}`, values);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** 时间文本转毫秒 */
const toMillis = (value: unknown): number => {
  if (typeof value === 'number') return Math.trunc(value);
  const text = String(value ?? '');
  const parsed = Date.parse(text.replace(' ', 'T'));
  return Number.isNaN(parsed) ? 0 : parsed;
};

/** 寄语桶名 → 库字段 */
const bucketToDb = (bucket: string): { category: string; weekday: string } => {
  if (bucket === 'weekend.messages') return { category: 'weekend', weekday: '' };
  if (bucket === 'workday_adjust.advance_reminders') return { category: 'workday_adjust_advance', weekday: '' };
  if (bucket === 'workday_adjust.today_reminders') return { category: 'workday_adjust_today', weekday: '' };
  if (bucket === 'quotes.quotes') return { category: 'quotes', weekday: '' };
  const [meal, kind, day] = bucket.split('.');
  return kind === 'tips'
    ? { category: `${meal}_tips`, weekday: '' }
    : { category: `${meal}_nutrition`, weekday: day ?? '' };
};

/** 库字段 → 寄语桶名 */
const dbToBucket = (category: string, weekday: string): string | null => {
  if (category === 'weekend') return 'weekend.messages';
  if (category === 'workday_adjust_advance') return 'workday_adjust.advance_reminders';
  if (category === 'workday_adjust_today') return 'workday_adjust.today_reminders';
  if (category === 'quotes') return 'quotes.quotes';
  const meal = MEALS.find((item) => category.startsWith(`${item}_`));
  if (!meal) return null;
  if (category === `${meal}_tips`) return `${meal}.tips`;
  return `${meal}.nutrition_advice.${weekday}`;
};

/** 把嵌套文档展开成 section / row_key / data 行 */
const flatten = (doc: Row): Row[] => {
  const rows: Row[] = [];
  for (const [section, value] of Object.entries(doc)) {
    if (value === null || typeof value !== 'object') {
      rows.push({ section, row_key: '', data: typeof value === 'string' ? value : JSON.stringify(value) });
    } else {
      for (const [rowKey, item] of Object.entries(value as Row)) {
        rows.push({ section, row_key: rowKey, data: typeof item === 'string' ? item : JSON.stringify(item) });
      }
    }
  }
  return rows;
};

/** 把 section / row_key / data 行还原成文档 */
const unflatten = (rows: RowDataPacket[]): Row => {
  const doc: Row = {};
  for (const row of rows) {
    const section = String(row.section);
    const rowKey = String(row.row_key);
    const data = String(row.data ?? '');
    if (!rowKey) {
      try { doc[section] = JSON.parse(data); } catch { doc[section] = data; }
    } else {
      const bucket = (doc[section] as Row) ?? {};
      try { bucket[rowKey] = JSON.parse(data); } catch { bucket[rowKey] = data; }
      doc[section] = bucket;
    }
  }
  return doc;
};

/** 判断是否为动态业务键 */
const isDailyKey = (key: string): boolean => /^daily_data_\d{4}-\d{2}-\d{2}\.json$/.test(key);
const isConversationKey = (key: string): boolean => key.startsWith('ai-conversations/') && key.endsWith('.json');
const isMemoryKey = (key: string): boolean => key.startsWith('ai-memory/') && key.endsWith('.json');
/** 是否有对应业务表 */
const hasBusinessTable = (key: string): boolean =>
  BUSINESS_KEYS.includes(key) || isDailyKey(key) || isConversationKey(key) || isMemoryKey(key);

/**
 * 从已有业务表读取并还原缓存 JSON
 * @param {string} key - 缓存键
 * @returns {Promise<string | null>} 全文，不存在时返回 null
 */
const readBusiness = async (key: string): Promise<string | null> => {
  let doc: unknown;
  switch (key) {
    case 'greetings.json': {
      const rows = await query('SELECT category, name, content FROM hp_greetings ORDER BY id');
      const result: Row = { solar_terms: {}, holidays: {}, lunar_festivals: {}, special_days: {}, birthday: { templates: [] } };
      for (const row of rows) {
        const category = String(row.category);
        const content = String(row.content ?? '');
        if (category === 'birthday') (result.birthday as { templates: string[] }).templates.push(content);
        else if (result[category]) (result[category] as Row)[String(row.name)] = content;
      }
      doc = result;
      break;
    }
    case 'reminder_quotes.json': {
      const rows = await query('SELECT category, weekday, content FROM hp_reminder_quotes ORDER BY id');
      const result: Row = {};
      for (const meal of MEALS) {
        result[meal] = { tips: [], nutrition_advice: Object.fromEntries(WEEKDAYS.map((day) => [day, []])) };
      }
      result.weekend = { messages: [] };
      result.workday_adjust = { advance_reminders: [], today_reminders: [] };
      result.quotes = { quotes: [] };
      for (const row of rows) {
        const bucket = dbToBucket(String(row.category), String(row.weekday ?? ''));
        if (!bucket) continue;
        const parts = bucket.split('.');
        let target: Row = result;
        for (const part of parts.slice(0, -1)) target = (target[part] as Row) ?? {};
        const list = target[parts[parts.length - 1]];
        if (Array.isArray(list)) list.push(String(row.content ?? ''));
      }
      doc = result;
      break;
    }
    case 'message_templates.json': {
      const templates = await query('SELECT template_key, style, content, version FROM hp_message_templates ORDER BY id');
      const styles = await query('SELECT style_key, name, description, target FROM hp_template_styles ORDER BY id');
      const names = await query('SELECT template_key, display_name FROM hp_template_names ORDER BY id');
      const body: Row = {};
      for (const row of templates) {
        const group = (body[String(row.template_key)] as Row) ?? {};
        group[String(row.style)] = String(row.content ?? '');
        body[String(row.template_key)] = group;
      }
      const styleMap: Row = {};
      for (const row of styles) {
        styleMap[String(row.style_key)] = {
          name: String(row.name ?? ''), description: String(row.description ?? ''), target: String(row.target ?? ''),
        };
      }
      const nameMap: Row = {};
      for (const row of names) nameMap[String(row.template_key)] = String(row.display_name ?? '');
      doc = {
        version: templates[0] ? String(templates[0].version ?? '1.0.0') : '1.0.0',
        description: 'Helper 智能提醒系统消息模板配置',
        templates: body, styles: styleMap, template_names: nameMap,
        metadata: { author: 'helper', version: '1.0.0' },
      };
      break;
    }
    case 'custom_rules.json': {
      const rules = await query(
        `SELECT r.*, (SELECT GROUP_CONCAT(w.webhook_id) FROM hp_rule_webhooks w WHERE w.rule_id = r.id) AS webhook_ids
         FROM hp_custom_rules r ORDER BY r.id`,
      );
      doc = rules.map((row) => ({
        id: String(row.rule_key), name: String(row.name ?? ''), type: String(row.type),
        condition: String(row.condition_value ?? ''), time: String(row.time ?? ''),
        message: String(row.message ?? ''), template_id: row.template_id ?? null,
        enabled: Number(row.enabled) === 1,
        custom_content: '', output_mode: '',
        webhookIds: String(row.webhook_ids ?? '').split(',').filter(Boolean),
        created_at: row.created_at ? String(row.created_at) : '',
        updated_at: row.updated_at ? String(row.updated_at) : '',
        lastTriggeredAt: row.last_triggered_at ? String(row.last_triggered_at) : null,
      }));
      break;
    }
    case 'dailyword_library.json':
      doc = unflatten(await query('SELECT section, row_key, data FROM hp_cache_dailyword_library'));
      break;
    case 'amap_geocode.json':
      doc = unflatten(await query('SELECT section, row_key, data FROM hp_cache_amap_geocode'));
      break;
    case 'holiday_data.json': {
      const rows = await query('SELECT date_key, date, name, is_holiday, wage, rest, is_after, target FROM hp_holiday_data ORDER BY id');
      const holiday: Row = {};
      for (const row of rows) {
        holiday[String(row.date_key)] = {
          holiday: Number(row.is_holiday) === 1, name: String(row.name ?? ''),
          wage: Number(row.wage ?? 1), date: String(row.date ?? ''), rest: Number(row.rest ?? 0),
          after: Number(row.is_after) === 1, target: row.target ?? null,
        };
      }
      doc = { code: 0, holiday };
      break;
    }
    case 'month_config.json': {
      const rows = await query('SELECT month, name, name_cn, days, description, is_leap_year, year FROM hp_month_config ORDER BY month');
      const months: Row = {};
      for (const row of rows) {
        months[String(row.month)] = {
          name: String(row.name ?? ''), name_cn: String(row.name_cn ?? ''),
          days: Number(row.days ?? 30), description: String(row.description ?? ''),
        };
      }
      doc = {
        months,
        config: {
          version: '1.0', current_year: rows[0] ? String(rows[0].year) : '2026',
          is_leap_year: rows.some((row) => Number(row.is_leap_year) === 1),
        },
      };
      break;
    }
    case 'daemon_sent_state.json': {
      const rows = await query('SELECT state_key, state_value, updated_at FROM hp_daemon_sent_state');
      const docRow: Row = {};
      for (const row of rows) docRow[String(row.state_key)] = String(row.state_value ?? '');
      if (rows[0]?.updated_at) docRow.updated_at = String(rows[0].updated_at);
      doc = docRow;
      break;
    }
    case 'webhooks.json': {
      const rows = await query('SELECT webhook_key, name, url, style, created_at, updated_at FROM hp_webhooks ORDER BY id');
      doc = rows.map((row) => ({
        id: String(row.webhook_key), name: String(row.name ?? ''), url: String(row.url ?? ''),
        style: String(row.style ?? ''), created_at: String(row.created_at ?? ''), updated_at: String(row.updated_at ?? ''),
      }));
      break;
    }
    case 'ai-model-configs.json': {
      const rows = await query('SELECT * FROM hp_ai_model_configs ORDER BY id');
      doc = rows.map((row) => ({
        id: String(row.id), name: String(row.name ?? ''), baseUrl: String(row.base_url ?? ''),
        apiKey: String(row.api_key ?? ''), maxTokens: Number(row.max_tokens ?? 0),
        models: row.models ? JSON.parse(String(row.models)) : [],
        memoryEnabled: Number(row.memory_enabled) === 1,
        pricing: row.pricing ? JSON.parse(String(row.pricing)) : {},
        created_at: String(row.created_at ?? ''), updated_at: String(row.updated_at ?? ''),
      }));
      break;
    }
    default:
      if (isDailyKey(key)) {
        const date = key.slice('daily_data_'.length, -5);
        const rows = await query('SELECT * FROM hp_daily_data WHERE date = ?', [date]);
        if (rows.length === 0) return null;
        const row = rows[0];
        doc = {
          date: String(row.date), fetch_time: String(row.fetch_time ?? ''),
          weather: String(row.weather ?? ''), history: String(row.history ?? ''),
          almanac: String(row.almanac ?? ''), horoscope: String(row.horoscope ?? ''),
          inspirational_quote: String(row.inspirational_quote ?? ''),
        };
      } else if (isConversationKey(key)) {
        const id = key.slice(key.lastIndexOf('/') + 1, -5);
        const conv = await query('SELECT * FROM hp_ai_conversations WHERE id = ?', [id]);
        if (conv.length === 0) return null;
        const messages = await query('SELECT * FROM hp_ai_messages WHERE conversation_id = ? ORDER BY seq', [id]);
        doc = {
          id: String(conv[0].id), title: String(conv[0].title ?? ''), user: String(conv[0].user ?? ''),
          messages: messages.map((row) => ({
            role: String(row.role ?? ''), content: String(row.content ?? ''),
            tool_calls: row.tool_calls ? JSON.parse(String(row.tool_calls)) : null,
            tool_call_id: row.tool_call_id ?? null, name: row.name ?? null,
            created_at: Number(row.created_at ?? 0),
          })),
          created_at: Number(conv[0].created_at ?? 0), updated_at: Number(conv[0].updated_at ?? 0),
        };
      } else if (isMemoryKey(key)) {
        const user = key.slice('ai-memory/'.length, -5);
        const rows = await query('SELECT * FROM hp_ai_memory_items WHERE user = ? ORDER BY id', [user]);
        doc = {
          user,
          items: rows.map((row) => ({
            id: String(row.memory_id), content: String(row.content ?? ''), source: String(row.source ?? ''),
            created_at: Number(row.created_at ?? 0), updated_at: Number(row.updated_at ?? 0), hits: Number(row.hits ?? 0),
          })),
          updated_at: rows.length ? Math.max(...rows.map((row) => Number(row.updated_at ?? 0))) : 0,
        };
      } else {
        return null;
      }
  }
  return JSON.stringify(doc);
};

/**
 * 把缓存 JSON 展开写入已有业务表
 * @param {string} key - 缓存键
 * @param {string} body - 全文
 * @returns {Promise<void>}
 */
const writeBusiness = async (key: string, body: string): Promise<void> => {
  let doc: any;
  try { doc = JSON.parse(body); } catch { doc = {}; }
  const now = Date.now();
  switch (key) {
    case 'greetings.json': {
      const rows: Row[] = [];
      for (const group of GREETING_GROUPS) {
        for (const [name, content] of Object.entries(doc[group] ?? {})) {
          rows.push({ category: group, name, content: String(content) });
        }
      }
      (doc.birthday?.templates ?? []).forEach((content: unknown, index: number) => {
        rows.push({ category: 'birthday', name: `template_${index + 1}`, content: String(content) });
      });
      await replace('hp_greetings', ['category', 'name', 'content'], rows);
      break;
    }
    case 'reminder_quotes.json': {
      const rows: Row[] = [];
      const push = (bucket: string, list: unknown): void => {
        if (!Array.isArray(list)) return;
        for (const content of list) rows.push({ ...bucketToDb(bucket), content: String(content) });
      };
      push('weekend.messages', doc.weekend?.messages);
      push('workday_adjust.advance_reminders', doc.workday_adjust?.advance_reminders);
      push('workday_adjust.today_reminders', doc.workday_adjust?.today_reminders);
      push('quotes.quotes', doc.quotes?.quotes);
      for (const meal of MEALS) {
        push(`${meal}.tips`, doc[meal]?.tips);
        for (const day of WEEKDAYS) push(`${meal}.nutrition_advice.${day}`, doc[meal]?.nutrition_advice?.[day]);
      }
      await replace('hp_reminder_quotes', ['category', 'weekday', 'content'], rows);
      break;
    }
    case 'message_templates.json': {
      const version = String(doc.version ?? '1.0.0');
      const templates: Row[] = Object.entries(doc.templates ?? {}).flatMap(([templateKey, styles]) =>
        Object.entries(styles as Row ?? {}).map(([style, content]) => ({
          template_key: templateKey, style, content: String(content), version,
        })));
      const styles: Row[] = Object.entries(doc.styles ?? {}).map(([styleKey, value]: [string, any]) => ({
        style_key: styleKey, name: String(value?.name ?? ''),
        description: String(value?.description ?? ''), target: String(value?.target ?? ''),
      }));
      const names: Row[] = Object.entries(doc.template_names ?? {}).map(([templateKey, displayName]) => ({
        template_key: templateKey, display_name: String(displayName),
      }));
      await replace('hp_message_templates', ['template_key', 'style', 'content', 'version'], templates);
      await replace('hp_template_styles', ['style_key', 'name', 'description', 'target'], styles);
      await replace('hp_template_names', ['template_key', 'display_name'], names);
      break;
    }
    case 'custom_rules.json': {
      const rules = Array.isArray(doc) ? doc : [];
      const conn = await getPool().getConnection();
      try {
        await conn.beginTransaction();
        for (const rule of rules) {
          if (!rule?.id) continue;
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
            [String(rule.id), String(rule.name ?? ''), String(rule.type ?? 'daily'),
              String(rule.condition ?? ''), String(rule.time ?? '09:00'), String(rule.message ?? ''),
              rule.template_id ?? null, rule.enabled === false ? 0 : 1,
              String(rule.created_at ?? new Date().toISOString().slice(0, 19).replace('T', ' ')),
              String(rule.updated_at ?? new Date().toISOString().slice(0, 19).replace('T', ' ')),
              rule.lastTriggeredAt ?? null],
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
      break;
    }
    case 'dailyword_library.json':
      await replace('hp_cache_dailyword_library', ['section', 'row_key', 'data', 'cache_updated_at'],
        flatten(doc).map((row) => ({ ...row, cache_updated_at: now })));
      break;
    case 'amap_geocode.json':
      await replace('hp_cache_amap_geocode', ['section', 'row_key', 'data', 'cache_updated_at'],
        flatten(doc).map((row) => ({ ...row, cache_updated_at: now })));
      break;
    case 'holiday_data.json': {
      const rows: Row[] = Object.entries(doc.holiday ?? {}).map(([dateKey, value]: [string, any]) => ({
        date_key: dateKey, date: String(value?.date ?? ''), name: String(value?.name ?? ''),
        is_holiday: value?.holiday ? 1 : 0, wage: Number(value?.wage ?? 1),
        rest: value?.rest ?? null, is_after: value?.after ? 1 : 0, target: value?.target ?? null,
        year: Number(String(value?.date ?? '').slice(0, 4)) || new Date().getFullYear(),
      }));
      await replace('hp_holiday_data', ['date_key', 'date', 'name', 'is_holiday', 'wage', 'rest', 'is_after', 'target', 'year'], rows);
      break;
    }
    case 'month_config.json': {
      const year = Number(doc.config?.current_year ?? new Date().getFullYear());
      const leap = doc.config?.is_leap_year ? 1 : 0;
      const rows: Row[] = Object.entries(doc.months ?? {}).map(([month, value]: [string, any]) => ({
        month, name: String(value?.name ?? ''), name_cn: String(value?.name_cn ?? ''),
        days: Number(value?.days ?? 30), description: value?.description ?? null,
        is_leap_year: month === '02' ? leap : null, year,
      }));
      await replace('hp_month_config', ['month', 'name', 'name_cn', 'days', 'description', 'is_leap_year', 'year'], rows);
      break;
    }
    case 'daemon_sent_state.json': {
      const rows: Row[] = Object.entries(doc).filter(([name]) => name !== 'updated_at')
        .map(([stateKey, value]) => ({ state_key: stateKey, state_value: String(value ?? '') }));
      await replace('hp_daemon_sent_state', ['state_key', 'state_value'], rows);
      break;
    }
    case 'webhooks.json': {
      // hp_rule_webhooks 有外键引用本表，只做 UPSERT，不整表删除
      for (const hook of (Array.isArray(doc) ? doc : [])) {
        await getPool().execute(
          `INSERT INTO hp_webhooks (webhook_key, name, url, style, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), url = VALUES(url),
             style = VALUES(style), updated_at = VALUES(updated_at)`,
          [String(hook.id ?? ''), String(hook.name ?? ''), String(hook.url ?? ''),
            String(hook.style ?? ''), hook.created_at ?? null, hook.updated_at ?? null],
        );
      }
      break;
    }
    case 'ai-model-configs.json': {
      const rows: Row[] = (Array.isArray(doc) ? doc : []).map((cfg: any) => ({
        id: String(cfg.id ?? ''), name: String(cfg.name ?? ''), base_url: String(cfg.baseUrl ?? ''),
        api_key: String(cfg.apiKey ?? ''), max_tokens: Number(cfg.maxTokens ?? 0),
        models: JSON.stringify(cfg.models ?? []), memory_enabled: cfg.memoryEnabled ? 1 : 0,
        pricing: JSON.stringify(cfg.pricing ?? {}), created_at: cfg.created_at ?? '',
        updated_at: cfg.updated_at ?? '',
      }));
      await replace('hp_ai_model_configs', ['id', 'name', 'base_url', 'api_key', 'max_tokens', 'models',
        'memory_enabled', 'pricing', 'created_at', 'updated_at'], rows);
      break;
    }
    default:
      if (isDailyKey(key)) {
        const date = key.slice('daily_data_'.length, -5);
        await getPool().execute('DELETE FROM hp_daily_data WHERE date = ?', [date]);
        await getPool().execute(
          `INSERT INTO hp_daily_data
           (date, fetch_time, weather, history, almanac, horoscope, inspirational_quote)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [String(doc.date ?? date), String(doc.fetch_time ?? ''), String(doc.weather ?? ''),
            String(doc.history ?? ''), String(doc.almanac ?? ''), String(doc.horoscope ?? ''),
            String(doc.inspirational_quote ?? '')],
        );
      } else if (isConversationKey(key)) {
        const id = key.slice(key.lastIndexOf('/') + 1, -5);
        const messages = Array.isArray(doc.messages) ? doc.messages : [];
        const conn = await getPool().getConnection();
        try {
          await conn.beginTransaction();
          await conn.execute('DELETE FROM hp_ai_messages WHERE conversation_id = ?', [id]);
          await conn.execute(
            `INSERT INTO hp_ai_conversations (id, user, title, message_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), message_count = VALUES(message_count),
               updated_at = VALUES(updated_at)`,
            [id, String(doc.user ?? ''), String(doc.title ?? ''), messages.length,
              Number(doc.created_at ?? 0), Number(doc.updated_at ?? 0)],
          );
          for (let index = 0; index < messages.length; index += 40) {
            const chunk = messages.slice(index, index + 40);
            const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
            const values = chunk.flatMap((msg: any, i: number) => [
              id, index + i, String(msg.role ?? ''), String(msg.content ?? ''), Number(msg.created_at ?? 0),
            ]);
            await conn.execute(
              `INSERT INTO hp_ai_messages (conversation_id, seq, role, content, created_at) VALUES ${placeholders}`,
              values,
            );
          }
          await conn.commit();
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      } else if (isMemoryKey(key)) {
        const user = key.slice('ai-memory/'.length, -5);
        const items = Array.isArray(doc.items) ? doc.items : [];
        await getPool().execute('DELETE FROM hp_ai_memory_items WHERE user = ?', [user]);
        for (const item of items) {
          await getPool().execute(
            `INSERT INTO hp_ai_memory_items
             (memory_id, user, content, source, created_at, updated_at, hits) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [String(item.id ?? ''), user, String(item.content ?? ''), String(item.source ?? ''),
              Number(item.created_at ?? 0), Number(item.updated_at ?? 0), Number(item.hits ?? 0)],
          );
        }
      }
  }
};

/** 读取 API 响应分类表或兜底表条目 */
const readOther = async (key: string): Promise<string | null> => {
  await ensureCacheTables();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT body FROM \`${OTHER_TABLE}\` WHERE asset_key = ?`, [key],
  );
  return rows.length === 0 ? null : String(rows[0].body ?? '');
};

/** 写入兜底表（完整键） */
const writeOther = async (key: string, body: string): Promise<void> => {
  await ensureCacheTables();
  const { periodType, periodKey } = resolveCachePeriod(key);
  await getPool().execute(
    `INSERT INTO \`${OTHER_TABLE}\` (asset_key, body, cache_updated_at, period_type, period_key)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE body = VALUES(body), cache_updated_at = VALUES(cache_updated_at),
       period_type = VALUES(period_type), period_key = VALUES(period_key)`,
    [key, body, Date.now(), periodType, periodKey],
  );
};

/**
 * 读取缓存键全文
 * @param {string} key - 缓存键
 * @returns {Promise<string | null>} 全文
 */
export const readTableBody = async (key: string): Promise<string | null> => {
  if (isApiResponseKey(key)) {
    await ensureCacheTables();
    const target = resolveCacheTarget(key);
    const rows = await query(
      `SELECT \`${target.bodyColumn}\` AS body FROM \`${target.table}\` WHERE \`${target.keyColumn}\` = ?`,
      [target.storedKey],
    );
    return rows.length === 0 ? null : String(rows[0].body ?? '');
  }
  if (hasBusinessTable(key)) return readBusiness(key);
  return readOther(key);
};

/**
 * 写入缓存键全文
 * @param {string} key - 缓存键
 * @param {string} body - 全文
 * @returns {Promise<void>}
 */
export const writeTableBody = async (key: string, body: string): Promise<void> => {
  if (isApiResponseKey(key)) {
    await ensureCacheTables();
    const target = resolveCacheTarget(key);
    await getPool().execute(
      `INSERT INTO \`${target.table}\` (\`${target.keyColumn}\`, \`${target.bodyColumn}\`, \`${target.timeColumn}\`,
         \`period_type\`, \`period_key\`)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE \`${target.bodyColumn}\` = VALUES(\`${target.bodyColumn}\`),
         \`${target.timeColumn}\` = VALUES(\`${target.timeColumn}\`),
         \`period_type\` = VALUES(\`period_type\`), \`period_key\` = VALUES(\`period_key\`)`,
      [target.storedKey, body, Date.now(), target.periodType, target.periodKey],
    );
    return;
  }
  if (hasBusinessTable(key)) await writeBusiness(key, body);
  else await writeOther(key, body);
};

/**
 * 判断缓存键是否存在
 * @param {string} key - 缓存键
 * @returns {Promise<boolean>} 存在返回 true
 */
export const tableKeyExists = async (key: string): Promise<boolean> =>
  (await readTableBody(key)) !== null;

/**
 * 删除缓存键
 * @param {string} key - 缓存键
 * @returns {Promise<void>}
 */
export const deleteTableKey = async (key: string): Promise<void> => {
  if (isApiResponseKey(key)) {
    await ensureCacheTables();
    const target = resolveCacheTarget(key);
    await getPool().execute(
      `DELETE FROM \`${target.table}\` WHERE \`${target.keyColumn}\` = ?`, [target.storedKey],
    );
    return;
  }
  if (!hasBusinessTable(key)) {
    await ensureCacheTables();
    await getPool().execute(`DELETE FROM \`${OTHER_TABLE}\` WHERE asset_key = ?`, [key]);
    return;
  }
  await writeTableBody(key, Array.isArray(JSON.parse((await readTableBody(key)) ?? '{}')) ? '[]' : '{}');
};

/**
 * 列出全部缓存键信息
 * @returns {Promise<Array<{ key: string; size: number; updatedAt: number }>>} 条目清单
 */
export const listTableEntries = async (): Promise<Array<{ key: string; size: number; updatedAt: number }>> => {
  await ensureCacheTables();
  const rows = await query(
    `SELECT file_key, size, updated_at FROM (${buildCacheUnionSql()}) AS api_entries`,
  );
  const entries: Array<{ key: string; size: number; updatedAt: number }> = rows.map((row) => ({
    key: String(row.file_key), size: Number(row.size ?? 0), updatedAt: Number(row.updated_at ?? 0),
  }));
  const dynamic: string[] = [];
  for (const row of await query('SELECT date FROM hp_daily_data')) dynamic.push(`daily_data_${String(row.date)}.json`);
  for (const row of await query('SELECT id, user FROM hp_ai_conversations')) {
    dynamic.push(`ai-conversations/${String(row.user)}/${String(row.id)}.json`);
  }
  for (const row of await query('SELECT DISTINCT user FROM hp_ai_memory_items')) {
    dynamic.push(`ai-memory/${String(row.user)}.json`);
  }
  for (const key of [...BUSINESS_KEYS, ...dynamic]) {
    const body = await readTableBody(key);
    if (body === null) continue;
    entries.push({ key, size: body.length, updatedAt: 0 });
  }
  const seen = new Set<string>();
  return entries.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

/**
 * 读取缓存键的更新时间（毫秒）
 * @param {string} key - 缓存键
 * @returns {Promise<number>} 时间戳
 */
export const tableKeyMtime = async (key: string): Promise<number> => {
  if (isDailyKey(key)) {
    const date = key.slice('daily_data_'.length, -5);
    const rows = await query('SELECT fetch_time FROM hp_daily_data WHERE date = ?', [date]);
    return rows.length ? toMillis(rows[0].fetch_time) : 0;
  }
  const entry = (await listTableEntries()).find((item) => item.key === key);
  return entry?.updatedAt ?? 0;
};
