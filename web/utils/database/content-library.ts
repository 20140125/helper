/**
 * 内容库（祝福语 / 提醒寄语 / 消息模板）的查询与同步
 *
 * 设计说明：
 *   - 这三份 JSON 含库表没有的元信息（description / version / metadata），且 shell 会读、
 *     还会往 reminder_quotes.json 追加名言，因此文件仍是写入与交换真源；
 *   - 查询侧以 hp_* 表为真源，写文件后由 syncContentLibraryIfStale() 按文件 mtime 自动
 *     全量重建查询表，避免 shell 写入后库长期滞后；
 *   - 全量重建只影响查询表，不改任何 JSON 文件，也不触碰其它模块的数据。
 */
import fs from 'fs';
import path from 'path';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { CACHE_DIR } from '@/utils/paths';
import { readReminderQuotesFile, flattenReminderQuotes } from '@/utils/reminder-quotes';
import { REMINDER_QUOTES_BUCKETS } from '@/types/reminder-quotes';
import type { ReminderQuoteItem, ReminderQuotesBucket } from '@/types/reminder-quotes';
import type { GreetingItem, GreetingsFile, GreetingsGroup } from '@/types/greetings';

/** 三份内容库 JSON 的绝对路径 */
const CONTENT_FILES = {
  greetings: path.join(CACHE_DIR, 'greetings.json'),
  quotes: path.join(CACHE_DIR, 'reminder_quotes.json'),
  templates: path.join(CACHE_DIR, 'message_templates.json'),
};

/** 记录上次同步时文件 mtime 的元数据键 */
const SYNC_META_KEY = 'content_library_sync_at';

/** 内容库条目数量快照 */
interface ContentCounts {
  greetings: number;
  quotes: number;
  templates: number;
  styles: number;
  names: number;
}

/** 文件与数据库的差异报告 */
export interface ContentLibraryDiff {
  file: ContentCounts;
  db: ContentCounts;
  stale: boolean;
}

/** 模板 JSON 结构（只取入库所需字段） */
interface TemplateFile {
  version?: string;
  templates?: Record<string, Record<string, string>>;
  styles?: Record<string, { name?: string; description?: string; target?: string }>;
  template_names?: Record<string, string>;
}

/** 命名型祝福语分组（birthday 单独按模板数组处理） */
const NAMED_GROUPS: GreetingsGroup[] = [
  'solar_terms', 'holidays', 'lunar_festivals', 'special_days',
];

/** 三餐与星期（用于寄语桶 ↔ 库分类互转） */
const MEALS = ['breakfast', 'lunch', 'dinner'];

/**
 * 读取内容库 JSON
 * @param file - 文件路径
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
 * 取三份文件中最大的 mtime（毫秒整数）
 * @returns {number} 最大 mtime，文件都不存在时返回 0
 */
const maxFileMtime = (): number => Math.max(
  ...Object.values(CONTENT_FILES).map((file) =>
    (fs.existsSync(file) ? Math.trunc(fs.statSync(file).mtimeMs) : 0)),
);

/**
 * 把祝福语 JSON 展开为 hp_greetings 行
 * @returns {Array<{ category: string; name: string; content: string }>} 待入库行
 */
const readGreetingRows = (): Array<{ category: string; name: string; content: string }> => {
  const raw = readJson<Partial<GreetingsFile>>(CONTENT_FILES.greetings);
  const rows: Array<{ category: string; name: string; content: string }> = [];
  for (const group of NAMED_GROUPS) {
    for (const [name, content] of Object.entries(raw[group] ?? {})) {
      rows.push({ category: group, name, content: String(content) });
    }
  }
  (raw.birthday?.templates ?? []).forEach((content, index) => {
    rows.push({ category: 'birthday', name: `template_${index + 1}`, content: String(content) });
  });
  return rows;
};

/**
 * 把 Web 层寄语桶名转成库里的 category / weekday
 * @param bucket - 二级路径桶名
 * @returns {{ category: string; weekday: string }} 库字段
 */
const bucketToDb = (bucket: ReminderQuotesBucket): { category: string; weekday: string } => {
  if (bucket === 'weekend.messages') return { category: 'weekend', weekday: '' };
  if (bucket === 'workday_adjust.advance_reminders') return { category: 'workday_adjust_advance', weekday: '' };
  if (bucket === 'workday_adjust.today_reminders') return { category: 'workday_adjust_today', weekday: '' };
  if (bucket === 'quotes.quotes') return { category: 'quotes', weekday: '' };
  const [meal, kind, day] = bucket.split('.');
  if (kind === 'tips') return { category: `${meal}_tips`, weekday: '' };
  return { category: `${meal}_nutrition`, weekday: day ?? '' };
};

/**
 * 把库里的 category / weekday 转回 Web 层寄语桶名
 * @param category - 库分类
 * @param weekday - 库星期
 * @returns {ReminderQuotesBucket | null} 桶名，无法映射时返回 null
 */
const dbToBucket = (category: string, weekday: string): ReminderQuotesBucket | null => {
  if (category === 'weekend') return 'weekend.messages';
  if (category === 'workday_adjust_advance') return 'workday_adjust.advance_reminders';
  if (category === 'workday_adjust_today') return 'workday_adjust.today_reminders';
  if (category === 'quotes') return 'quotes.quotes';
  const meal = MEALS.find((item) => category.startsWith(`${item}_`));
  if (!meal) return null;
  if (category === `${meal}_tips`) return `${meal}.tips` as ReminderQuotesBucket;
  if (category === `${meal}_nutrition`) {
    const bucket = `${meal}.nutrition_advice.${weekday}` as ReminderQuotesBucket;
    return REMINDER_QUOTES_BUCKETS.includes(bucket) ? bucket : null;
  }
  return null;
};

/**
 * 把寄语 JSON 展开为 hp_reminder_quotes 行
 * @returns {Array<{ category: string; weekday: string; content: string }>} 待入库行
 */
const readQuoteRows = (): Array<{ category: string; weekday: string; content: string }> =>
  flattenReminderQuotes(readReminderQuotesFile()).map((item) => ({
    ...bucketToDb(item.bucket),
    content: item.content,
  }));

/**
 * 把消息模板 JSON 展开为三张模板表的行
 * @returns 模板正文 / 风格 / 显示名三组行
 */
const readTemplateRows = (): {
  templates: Array<{ template_key: string; style: string; content: string; version: string }>;
  styles: Array<{ style_key: string; name: string; description: string; target: string }>;
  names: Array<{ template_key: string; display_name: string }>;
} => {
  const raw = readJson<TemplateFile>(CONTENT_FILES.templates);
  const version = String(raw.version ?? '1.0.0');
  const templates = Object.entries(raw.templates ?? {}).flatMap(([templateKey, styles]) =>
    Object.entries(styles ?? {}).map(([style, content]) => ({
      template_key: templateKey,
      style,
      content: String(content),
      version,
    })));
  const styleRows = Object.entries(raw.styles ?? {}).map(([styleKey, value]) => ({
    style_key: styleKey,
    name: String(value?.name ?? ''),
    description: String(value?.description ?? ''),
    target: String(value?.target ?? ''),
  }));
  const nameRows = Object.entries(raw.template_names ?? {}).map(([templateKey, displayName]) => ({
    template_key: templateKey,
    display_name: String(displayName),
  }));
  return { templates, styles: styleRows, names: nameRows };
};

/**
 * 从文件全量重建内容库查询表
 * @returns {Promise<ContentCounts>} 各类入库条数
 * @description 单事务内 DELETE + INSERT；顺序由自增 id 承载，与文件数组顺序一致
 */
export const syncContentLibraryFromFiles = async (): Promise<ContentCounts> => {
  const greetings = readGreetingRows();
  const quotes = readQuoteRows();
  const { templates, styles, names } = readTemplateRows();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM hp_greetings');
    for (const row of greetings) {
      await conn.execute(
        'INSERT INTO hp_greetings (category, name, content) VALUES (?, ?, ?)',
        [row.category, row.name, row.content],
      );
    }
    await conn.query('DELETE FROM hp_reminder_quotes');
    for (const row of quotes) {
      await conn.execute(
        'INSERT INTO hp_reminder_quotes (category, weekday, content) VALUES (?, ?, ?)',
        [row.category, row.weekday, row.content],
      );
    }
    await conn.query('DELETE FROM hp_message_templates');
    for (const row of templates) {
      await conn.execute(
        'INSERT INTO hp_message_templates (template_key, style, content, version) VALUES (?, ?, ?, ?)',
        [row.template_key, row.style, row.content, row.version],
      );
    }
    await conn.query('DELETE FROM hp_template_styles');
    for (const row of styles) {
      await conn.execute(
        'INSERT INTO hp_template_styles (style_key, name, description, target) VALUES (?, ?, ?, ?)',
        [row.style_key, row.name, row.description, row.target],
      );
    }
    await conn.query('DELETE FROM hp_template_names');
    for (const row of names) {
      await conn.execute(
        'INSERT INTO hp_template_names (template_key, display_name) VALUES (?, ?)',
        [row.template_key, row.display_name],
      );
    }
    await conn.execute(
      `INSERT INTO hp_cache_meta (meta_key, meta_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
      [SYNC_META_KEY, String(maxFileMtime())],
    );
    await conn.commit();
    return {
      greetings: greetings.length,
      quotes: quotes.length,
      templates: templates.length,
      styles: styles.length,
      names: names.length,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** 正在进行的同步（避免并发查询重复重建） */
let pendingSync: Promise<void> | null = null;

/**
 * 文件有更新时自动同步查询表
 * @returns {Promise<void>}
 * @description 以 hp_cache_meta 里的 mtime 为水位；数据库不可用时由调用方降级读文件
 */
export const syncContentLibraryIfStale = async (): Promise<void> => {
  if (pendingSync) return pendingSync;
  pendingSync = (async () => {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT meta_value FROM hp_cache_meta WHERE meta_key = ?', [SYNC_META_KEY],
    );
    const stored = Number(rows[0]?.meta_value ?? 0);
    if (maxFileMtime() > stored) await syncContentLibraryFromFiles();
  })().finally(() => {
    pendingSync = null;
  });
  return pendingSync;
};

/**
 * 统计文件与数据库的条目数差异
 * @returns {Promise<ContentLibraryDiff>} 差异报告
 */
export const collectContentLibraryDiff = async (): Promise<ContentLibraryDiff> => {
  const { templates, styles, names } = readTemplateRows();
  const pool = getPool();
  const [gRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_greetings');
  const [qRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_reminder_quotes');
  const [tRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_message_templates');
  const [sRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_template_styles');
  const [nRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hp_template_names');
  const [metaRows] = await pool.query<RowDataPacket[]>(
    'SELECT meta_value FROM hp_cache_meta WHERE meta_key = ?', [SYNC_META_KEY],
  );
  return {
    file: {
      greetings: readGreetingRows().length,
      quotes: readQuoteRows().length,
      templates: templates.length,
      styles: styles.length,
      names: names.length,
    },
    db: {
      greetings: Number(gRows[0]?.n ?? 0),
      quotes: Number(qRows[0]?.n ?? 0),
      templates: Number(tRows[0]?.n ?? 0),
      styles: Number(sRows[0]?.n ?? 0),
      names: Number(nRows[0]?.n ?? 0),
    },
    stale: maxFileMtime() > Number(metaRows[0]?.meta_value ?? 0),
  };
};

/**
 * 判断内容库是否需要同步
 * @param diff - 差异报告
 * @returns {boolean} 任一数量不一致或文件比水位新时返回 true
 */
export const hasContentLibraryDiff = (diff: ContentLibraryDiff): boolean =>
  diff.stale
  || (Object.keys(diff.file) as Array<keyof ContentCounts>).some((key) => diff.file[key] !== diff.db[key]);

/**
 * 从数据库读取扁平化祝福语条目
 * @returns {Promise<GreetingItem[]>} 祝福语列表
 */
export const readGreetingsFromDb = async (): Promise<GreetingItem[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT category, name, content FROM hp_greetings ORDER BY id',
  );
  return rows.map((row) => {
    const group = String(row.category) as GreetingsGroup;
    const name = group === 'birthday' ? '' : String(row.name);
    return {
      id: `${group}::${row.name}`,
      group,
      name,
      content: String(row.content),
    };
  });
};

/**
 * 从数据库读取扁平化提醒寄语条目
 * @returns {Promise<ReminderQuoteItem[]>} 寄语列表
 */
export const readReminderQuotesFromDb = async (): Promise<ReminderQuoteItem[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT category, weekday, content FROM hp_reminder_quotes ORDER BY id',
  );
  const items: ReminderQuoteItem[] = [];
  rows.forEach((row, index) => {
    const bucket = dbToBucket(String(row.category), String(row.weekday ?? ''));
    if (!bucket) return;
    items.push({ id: `${bucket}::${index}`, bucket, content: String(row.content) });
  });
  return items;
};

/**
 * 从数据库读取消息模板配置
 * @returns {Promise<Record<string, unknown>>} 含 templates / styles / template_names / version
 */
export const readTemplatesFromDb = async (): Promise<Record<string, unknown>> => {
  const pool = getPool();
  const [templateRows] = await pool.query<RowDataPacket[]>(
    'SELECT template_key, style, content, version FROM hp_message_templates ORDER BY id',
  );
  const [styleRows] = await pool.query<RowDataPacket[]>(
    'SELECT style_key, name, description, target FROM hp_template_styles ORDER BY id',
  );
  const [nameRows] = await pool.query<RowDataPacket[]>(
    'SELECT template_key, display_name FROM hp_template_names ORDER BY id',
  );
  const templates: Record<string, Record<string, string>> = {};
  for (const row of templateRows) {
    const key = String(row.template_key);
    templates[key] = templates[key] ?? {};
    templates[key][String(row.style)] = String(row.content);
  }
  const styles = Object.fromEntries(styleRows.map((row) => [String(row.style_key), {
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    target: String(row.target ?? ''),
  }]));
  const templateNames = Object.fromEntries(
    nameRows.map((row) => [String(row.template_key), String(row.display_name)]),
  );
  return {
    version: templateRows[0]?.version ? String(templateRows[0].version) : '1.0.0',
    templates,
    styles,
    template_names: templateNames,
  };
};
