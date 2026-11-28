/**
 * 前端 i18n 数据导出脚本（数据库 → 种子 SQL + 静态 Locale 类型）
 *
 * 设计约定：
 *   1. hp_i18n_messages 是文案唯一真源，脚本只读库，不再读取任何 TS 语言包文件；
 *   2. 输出 35 号种子 SQL：CREATE TABLE IF NOT EXISTS + INSERT ... ON DUPLICATE KEY UPDATE，
 *      只补缺失 key 与结构列，不覆盖已有 value / value_type，重复初始化安全；
 *   3. 同时输出 frontend/src/types/locale.ts：由库里的 path_json 结构生成静态 Locale 接口，
 *      让所有 t.xxx.yyy 仍有类型检查；动态字典字段由 DYNAMIC_NODE_TYPES 清单补充；
 *   4. 默认只生成文件，传 --apply 时额外把种子 SQL 回灌当前库（幂等）。
 *
 * 用法（在 web/ 目录下）：
 *   npm run i18n:sql
 *   npm run i18n:sql -- --apply
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { PROJECT_DIR } from '@/utils/paths';

dotenv.config({ path: path.join(PROJECT_DIR, 'web', '.env') });

/** 语言代码 */
type Lang = 'zh' | 'en';

/** 展平后的一条语言包记录 */
interface I18nRow {
  /** 语言代码 */
  lang: Lang;
  /** 点号拼接的键路径 */
  keyPath: string;
  /** 一级命名空间 */
  namespace: string;
  /** 精确层级路径（JSON 数组文本） */
  pathJson: string;
  /** 静态文案或函数源码 */
  value: string;
  /** 值类型 */
  valueType: 'text' | 'function';
  /** 出现顺序 */
  sortOrder: number;
}

/** 类型树节点 */
interface TypeNode {
  /** 子节点 */
  children: Map<string, TypeNode>;
  /** 叶子类型（string 或函数签名） */
  leaf?: string;
}

/** 种子 SQL 输出路径 */
const OUTPUT_SQL = path.join(PROJECT_DIR, 'sql/i18n/35_i18n_messages.sql');

/** 静态类型输出路径 */
const OUTPUT_TYPES = path.join(PROJECT_DIR, 'web/frontend/src/types/locale.ts');

/** 语言代码白名单 */
const LANGS: Lang[] = ['zh', 'en'];

/** 单条 INSERT 的最大行数 */
const INSERT_BATCH_SIZE = 200;

/** 写入列 */
const COLUMNS = '(`lang`, `key_path`, `namespace`, `path_json`, `value`, `value_type`, `sort_order`)';

/** 动态字典与数组字段：库里是展平的行，无法表达索引签名/数组元素结构，按原 TS 断言固化 */
const DYNAMIC_NODE_TYPES: Record<string, string> = {
  'logs.labels': 'Record<string, string>',
  'reminderQuotes.bucketLabels': 'Record<string, string>',
  'skillMap.skills': 'Record<string, { label: string; desc: string }>',
  'skillMap.categories': 'Record<string, string>',
  'messageTemplates.templateNames': 'Record<string, string>',
  'messageTemplates.styleNames': 'Record<string, string>',
  'aiChat.welcomeCapabilities': 'Array<{ icon: string; title: string; desc: string; prompt: string }>',
  'aiChat.examples': 'string[]',
  'rules.weekdays': 'string[]',
  'rules.lunarMonths': 'string[]',
  'rules.lunarDays': 'string[]',
  'trigger.scripts': 'Record<string, { label: string; desc: string }>',
  menu: 'Record<string, string>',
};

/** 建表语句（与初始化入口保持一致） */
const TABLE_DDL = `CREATE TABLE IF NOT EXISTS \`hp_i18n_messages\` (
  \`id\`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键 ID（数据库管理页预览按 ID 倒序）',
  \`lang\`        VARCHAR(8)   NOT NULL COMMENT '语言代码（zh / en）',
  \`key_path\`    VARCHAR(191) NOT NULL COMMENT '点号拼接的键路径；键名含点号时以 path_json 为准',
  \`namespace\`   VARCHAR(64)  NOT NULL COMMENT '一级命名空间',
  \`path_json\`   JSON         NOT NULL COMMENT '精确层级路径数组，可无歧义还原嵌套结构',
  \`value\`       TEXT         NOT NULL COMMENT '文案；函数型条目存 JS 箭头函数源码（含插值表达式）',
  \`value_type\`  VARCHAR(16)  NOT NULL DEFAULT 'text' COMMENT 'text=静态文案 / function=插值函数',
  \`sort_order\`  INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '在语言包中的出现顺序',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_lang_key\` (\`lang\`, \`key_path\`),
  KEY \`idx_ns_order\` (\`lang\`, \`namespace\`, \`sort_order\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='前端 i18n 语言包全量镜像';`;

/**
 * 读取数据库连接配置
 * @returns {mysql.ConnectionOptions} 连接参数
 * @description 复用 web/.env 的 DB_* 配置，缺失时明确报错而不是静默降级
 */
const readConnectionOptions = (): mysql.ConnectionOptions => {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) throw new Error('数据库未配置：请检查 web/.env 的 DB_* 配置');
  return {
    host: DB_HOST,
    port: Number(DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD ?? '',
    database: DB_NAME,
    charset: 'utf8mb4',
  };
};

/**
 * 从数据库读取全量语言包记录
 * @returns {Promise<I18nRow[]>} 按语言与出现顺序排列的记录
 * @description JSON 列可能被 mysql2 解析为数组或原始字符串，统一转成 JSON 文本
 */
const readRowsFromDatabase = async (): Promise<I18nRow[]> => {
  const conn = await mysql.createConnection(readConnectionOptions());
  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT `lang`, `key_path`, `namespace`, `path_json`, `value`, `value_type`, `sort_order` '
      + 'FROM `hp_i18n_messages` ORDER BY `lang`, `sort_order`',
    );
    return rows.map((row) => {
      const rawPath = row.path_json;
      const segments: string[] = Array.isArray(rawPath)
        ? rawPath.map(String)
        : (() => {
          try {
            const parsed: unknown = JSON.parse(String(rawPath));
            return Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            return [];
          }
        })();
      const lang = String(row.lang) as Lang;
      if (!LANGS.includes(lang)) throw new Error(`未知语言代码：${String(row.lang)}`);
      return {
        lang,
        keyPath: String(row.key_path),
        namespace: String(row.namespace),
        pathJson: JSON.stringify(segments),
        value: String(row.value ?? ''),
        valueType: row.value_type === 'function' ? 'function' : 'text',
        sortOrder: Number(row.sort_order),
      };
    });
  } finally {
    await conn.end();
  }
};

/**
 * 生成建表种子 SQL
 * @param {I18nRow[]} rows - 库内全量记录
 * @returns {string} 可由 mysql SOURCE / mysql2 多语句执行的 SQL 文本
 * @description 字面量统一走 mysql2 的 escape；UPSERT 只更新结构列，不覆盖库中维护过的文案
 */
const buildSqlFile = (rows: I18nRow[]): string => {
  const lines = [
    '-- ============================================================',
    '-- 35. 前端 i18n 语言包表 (hp_i18n_messages)',
    '-- ============================================================',
    '-- 来源：hp_i18n_messages（由 npm run i18n:sql 从数据库导出）',
    '-- 由 helper_database.sql 统一加载；也可单独执行本文件',
    '-- 同时生成 web/frontend/src/types/locale.ts（静态 Locale 类型）',
    '-- 注意：本脚本不 DROP 表，只建表并补齐缺失 key；已存在条目的 value / value_type 保持不变。',
    '-- ============================================================',
    'SET NAMES utf8mb4;',
    '',
    TABLE_DDL,
    '',
  ];
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    const chunk = rows.slice(start, start + INSERT_BATCH_SIZE);
    lines.push(`INSERT INTO \`hp_i18n_messages\` ${COLUMNS} VALUES`);
    chunk.forEach((row, index) => {
      const tail = index === chunk.length - 1 ? '' : ',';
      const values = [
        mysql.escape(row.lang),
        mysql.escape(row.keyPath),
        mysql.escape(row.namespace),
        mysql.escape(row.pathJson),
        mysql.escape(row.value),
        mysql.escape(row.valueType),
        String(row.sortOrder),
      ].join(', ');
      lines.push(`  (${values})${tail}`);
    });
    lines.push('  ON DUPLICATE KEY UPDATE `namespace` = VALUES(`namespace`),');
    lines.push('    `path_json` = VALUES(`path_json`), `sort_order` = VALUES(`sort_order`);');
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
};

/**
 * 由函数源码推导参数个数，生成精确的静态函数签名
 * @param {string} source - 库内的箭头函数源码
 * @returns {string} TypeScript 函数类型
 * @description 参数统一为 unknown，既允许任意实参，也能赋给带具体参数类型的回调签名
 */
const buildFunctionType = (source: string): string => {
  const match = /^\(([^)]*)\)/.exec(source.trim());
  const count = match ? match[1].split(',').filter((item) => item.trim()).length : 1;
  const args = Array.from({ length: Math.max(count, 1) }, (_item, index) => `arg${index}: unknown`).join(', ');
  return `(${args}) => string`;
};

/**
 * 渲染类型树节点
 * @param {TypeNode} node - 当前节点
 * @param {string} nodePath - 点号拼接的节点路径
 * @param {number} indent - 缩进层级
 * @returns {string} TypeScript 类型文本
 * @description 动态字典优先用清单类型；纯数字子节点识别为 string[]；特殊键名加引号
 */
const renderTypeNode = (node: TypeNode, nodePath: string, indent: number): string => {
  if (nodePath && DYNAMIC_NODE_TYPES[nodePath]) return DYNAMIC_NODE_TYPES[nodePath];
  const keys = [...node.children.keys()];
  if (keys.length === 0) return node.leaf ?? 'string';
  if (keys.every((key) => /^\d+$/.test(key)) && keys.every((key) => node.children.get(key)?.children.size === 0)) {
    return 'string[]';
  }
  const pad = '  '.repeat(indent);
  const fields = keys.map((key) => {
    const child = node.children.get(key) as TypeNode;
    const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    const childPath = nodePath ? `${nodePath}.${key}` : key;
    return `${pad}  ${safeKey}: ${renderTypeNode(child, childPath, indent + 1)};`;
  });
  return `{\n${fields.join('\n')}\n${pad}}`;
};

/**
 * 生成静态 Locale 类型声明
 * @param {I18nRow[]} rows - 库内全量记录
 * @returns {string} frontend/src/types/locale.ts 文件全文
 * @description 按 path_json 合并 zh / en 的键结构，函数型叶子生成精确参数签名
 */
const buildLocaleTypes = (rows: I18nRow[]): string => {
  const root: TypeNode = { children: new Map() };
  for (const row of rows) {
    const segments: string[] = JSON.parse(row.pathJson);
    if (segments.length === 0) continue;
    let node = root;
    for (const segment of segments) {
      if (!node.children.has(segment)) node.children.set(segment, { children: new Map() });
      node = node.children.get(segment) as TypeNode;
    }
    const leaf = row.valueType === 'function' ? buildFunctionType(row.value) : 'string';
    if (!node.leaf || node.leaf === 'string') node.leaf = leaf;
  }
  return [
    '// 由 npm run i18n:sql 从 hp_i18n_messages 导出，请勿手工编辑',
    '// 动态字典/数组字段的类型清单见 web/scripts/generate-i18n-sql.ts 的 DYNAMIC_NODE_TYPES',
    '/** 前端运行时语言包结构（数据库 hp_i18n_messages 的静态类型镜像） */',
    `export interface Locale ${renderTypeNode(root, '', 0)};`,
    '',
  ].join('\n');
};

/**
 * 把种子 SQL 回灌当前库
 * @param {string} sql - 生成的 SQL 文本
 * @returns {Promise<void>} 无返回值
 * @description 用于表被部分清空时恢复；幂等，不覆盖已有 value
 */
const applyToDatabase = async (sql: string): Promise<void> => {
  const conn = await mysql.createConnection({ ...readConnectionOptions(), multipleStatements: true });
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
};

/**
 * 脚本入口
 * @returns {Promise<void>} 无返回值
 * @description 默认只生成种子 SQL 与静态类型；传 --apply 时额外回灌当前库
 */
const main = async (): Promise<void> => {
  const rows = await readRowsFromDatabase();
  const sql = buildSqlFile(rows);
  fs.mkdirSync(path.dirname(OUTPUT_SQL), { recursive: true });
  fs.writeFileSync(OUTPUT_SQL, sql, 'utf8');
  fs.writeFileSync(OUTPUT_TYPES, buildLocaleTypes(rows), 'utf8');
  for (const lang of LANGS) {
    const count = rows.filter((row) => row.lang === lang).length;
    console.log(`[i18n] ${lang}：${count} 条`);
  }
  console.log(`[i18n] 已导出 sql/i18n/35_i18n_messages.sql 与 frontend/src/types/locale.ts（共 ${rows.length} 条）`);
  if (process.argv.includes('--apply')) {
    await applyToDatabase(sql);
    console.log('[i18n] 种子 SQL 已回灌当前库');
  } else {
    console.log('[i18n] dry-run：如需回灌当前库，执行 npm run i18n:sql -- --apply');
  }
};

main().catch((err: unknown) => {
  console.error('[i18n] 导出失败：', err);
  process.exitCode = 1;
});
