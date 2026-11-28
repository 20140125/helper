import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from './connection';
import {
  I18N_LANGS,
  I18N_MESSAGES_MAX_PAGE_SIZE,
  I18N_MESSAGES_PAGE_SIZE,
  I18N_VALUE_MAX_LENGTH,
  type I18nLang,
  type I18nMessage,
  type I18nMessageList,
  type I18nMessageQuery,
  type I18nTranslationsMap,
  type I18nValueType,
} from '@/types/i18n';

/** hp_i18n_messages 的原始行 */
interface I18nDbRow extends RowDataPacket {
  /** 自增主键 */
  id: number;
  /** 点号拼接的键路径 */
  key_path: string;
  /** 一级命名空间 */
  namespace: string;
  /** JSON 列，mysql2 可能返回数组或字符串 */
  path_json: unknown;
  /** 文案或函数源码 */
  value: string;
  /** 值类型 */
  value_type: string;
  /** 出现顺序 */
  sort_order: number;
}

/** 计数查询行 */
interface CountRow extends RowDataPacket {
  /** 总条数 */
  total: number;
}

/** 命名空间查询行 */
interface NamespaceRow extends RowDataPacket {
  /** 命名空间 */
  namespace: string;
}

/**
 * 判断是否为受支持的语言代码
 * @param {string} value - 待校验的值
 * @returns {boolean} 是否属于 zh / en
 * @description 公开接口的路径参数必须走白名单，避免拼接进 SQL 或返回任意数据
 */
export const isI18nLang = (value: string): value is I18nLang =>
  I18N_LANGS.includes(value as I18nLang);

/**
 * 解析 path_json 单元格
 * @param {unknown} raw - mysql2 返回的 JSON 列值
 * @returns {string[]} 层级路径数组
 * @description 兼容 JSON 列被解析为数组或原始字符串两种情况，异常时回退空数组
 */
const parsePath = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** 运行时语言包查询行 */
interface I18nTranslationDbRow extends RowDataPacket {
  /** 语言代码 */
  lang: string;
  /** JSON 列，mysql2 可能返回数组或字符串 */
  path_json: unknown;
  /** 文案或函数源码 */
  value: string;
  /** 值类型 */
  value_type: string;
}

/**
 * 一次读取全部语言的完整文案（前端运行时用）
 * @returns {Promise<I18nTranslationsMap>} 按语言分组、按语言包顺序排列的扁平记录
 * @description 单条 SQL 取回 zh / en，避免前端分别请求两种语言；函数型条目保留 JS 源码
 */
export const readAllI18nTranslations = async (): Promise<I18nTranslationsMap> => {
  const [rows] = await getPool().query<I18nTranslationDbRow[]>(
    'SELECT `lang`, `path_json`, `value`, `value_type` FROM `hp_i18n_messages` WHERE `lang` IN (?, ?) ORDER BY `sort_order`',
    [...I18N_LANGS],
  );
  const translations: I18nTranslationsMap = { zh: [], en: [] };
  for (const row of rows) {
    if (!isI18nLang(row.lang)) continue;
    translations[row.lang].push({
      path: parsePath(row.path_json),
      value: String(row.value ?? ''),
      valueType: (row.value_type === 'function' ? 'function' : 'text') as I18nValueType,
    });
  }
  return translations;
};

/**
 * 读取语言管理页的命名空间清单
 * @param {I18nLang} lang - 语言代码
 * @returns {Promise<string[]>} 去重排序后的命名空间
 * @description 供管理页下拉筛选，避免前端硬编码命名空间
 */
const readI18nNamespaces = async (lang: I18nLang): Promise<string[]> => {
  const [rows] = await getPool().query<NamespaceRow[]>(
    'SELECT DISTINCT `namespace` FROM `hp_i18n_messages` WHERE `lang` = ? ORDER BY `namespace`',
    [lang],
  );
  return rows.map((row) => String(row.namespace));
};

/**
 * 分页查询语言包条目
 * @param {I18nMessageQuery} query - 语言、命名空间、关键字与分页参数
 * @returns {Promise<I18nMessageList>} 当前页记录、总数与命名空间清单
 * @description 条件全部参数化；每页条数收敛到上限，关键字同时匹配键路径与文案
 */
export const listI18nMessages = async (query: I18nMessageQuery): Promise<I18nMessageList> => {
  const lang = isI18nLang(query.lang ?? '') ? (query.lang as I18nLang) : 'zh';
  const where: string[] = ['`lang` = ?'];
  const params: Array<string | number> = [lang];

  if (query.namespace) {
    where.push('`namespace` = ?');
    params.push(query.namespace);
  }
  if (query.keyword) {
    where.push('(`key_path` LIKE ? OR `value` LIKE ?)');
    params.push(`%${query.keyword}%`, `%${query.keyword}%`);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const limit = Math.min(
    Math.max(Math.trunc(query.limit ?? 0) || I18N_MESSAGES_PAGE_SIZE, 1),
    I18N_MESSAGES_MAX_PAGE_SIZE,
  );
  const offset = Math.max(Math.trunc(query.offset ?? 0) || 0, 0);

  const pool = getPool();
  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM \`hp_i18n_messages\` ${whereSql}`,
    params,
  );
  const [rows] = await pool.query<I18nDbRow[]>(
    `SELECT \`id\`, \`key_path\`, \`namespace\`, \`value\`, \`value_type\`, \`sort_order\`
     FROM \`hp_i18n_messages\` ${whereSql} ORDER BY \`sort_order\` LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const items: I18nMessage[] = rows.map((row) => ({
    id: Number(row.id),
    lang,
    keyPath: String(row.key_path),
    namespace: String(row.namespace),
    value: String(row.value ?? ''),
    valueType: (row.value_type === 'function' ? 'function' : 'text') as I18nValueType,
    sortOrder: Number(row.sort_order),
  }));
  return {
    items,
    total: Number(countRows[0]?.total ?? 0),
    namespaces: await readI18nNamespaces(lang),
  };
};

/**
 * 更新一条静态文案
 * @param {number} id - 自增主键
 * @param {string} value - 新文案
 * @returns {Promise<void>} 无返回值
 * @description 仅允许修改 text 条目；函数型文案仍由 TS 语言包源码维护，避免前端执行任意代码
 */
export const updateI18nMessage = async (id: number, value: string): Promise<void> => {
  if (value.length > I18N_VALUE_MAX_LENGTH) throw new Error(`文案超长（最多 ${I18N_VALUE_MAX_LENGTH} 字符）`);
  const [result] = await getPool().query<ResultSetHeader>(
    'UPDATE `hp_i18n_messages` SET `value` = ? WHERE `id` = ? AND `value_type` = \'text\'',
    [value, id],
  );
  if (result.affectedRows === 0) throw new Error('文案不存在，或该条目为插值函数（请在语言包源码中维护）');
};
