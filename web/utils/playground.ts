/**
 * Playground 表单模板读写
 * @description 唯一持久化落点是 hp_playground_templates；
 *   初始数据固化在 sql/playground/34_playground_templates.sql，不再读写任何 JSON 文件。
 */

import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import {
  type TemplateData,
  type PlaygroundTemplateRow,
  type PlaygroundTemplateInput,
} from '@/types/playground';

// 重导出类型以兼容既有通过 '../utils/playground' 导入 TemplateData 的调用方
export type { TemplateData };

/** 查询模板行的公共列 */
const SELECT_COLUMNS = 'SELECT id, label, category, fields, sort_order FROM hp_playground_templates';

/**
 * 把数据库行转换成接口返回的模板
 * @param {PlaygroundTemplateRow} row - 数据库行
 * @returns {TemplateData} 模板数据
 * @description JSON 列可能被 mysql2 解析为数组，也可能以字符串返回；category 为 NULL 时不输出该字段
 */
const toTemplateData = (row: PlaygroundTemplateRow): TemplateData => {
  const fields = typeof row.fields === 'string'
    ? JSON.parse(row.fields) as unknown[]
    : row.fields;
  const template: TemplateData = { id: row.id, label: row.label, fields };
  if (row.category !== null && row.category !== undefined) template.category = row.category;
  return template;
};

/**
 * 读取全部模板
 * @returns {Promise<TemplateData[]>} 按 sort_order 升序的模板列表
 * @description 数据库异常直接抛出，由路由统一转成 500
 */
export const listTemplates = async (): Promise<TemplateData[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `${SELECT_COLUMNS} ORDER BY sort_order, id`,
  );
  return (rows as PlaygroundTemplateRow[]).map(toTemplateData);
};

/**
 * 按 id 读取单个模板
 * @param {string} id - 模板唯一标识
 * @returns {Promise<TemplateData | null>} 模板数据，不存在返回 null
 */
export const getTemplateById = async (id: string): Promise<TemplateData | null> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `${SELECT_COLUMNS} WHERE id = ? LIMIT 1`,
    [id],
  );
  const row = (rows as PlaygroundTemplateRow[])[0];
  return row ? toTemplateData(row) : null;
};

/**
 * 生成模板 id（基于 label 转 kebab-case，冲突时追加数字后缀）
 * @param {string} label - 模板名称
 * @param {string[]} existingIds - 已有 id 列表
 * @returns {string} 新 id
 * @description 沿用原文件版的命名规则，保证已有 id 与前端缓存兼容
 */
const generateId = (label: string, existingIds: string[]): string => {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    || `template-${Date.now()}`;

  if (!existingIds.includes(base)) return base;

  let suffix = 2;
  while (existingIds.includes(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
};

/**
 * 新增模板
 * @param {PlaygroundTemplateInput} input - 模板内容
 * @returns {Promise<string>} 新模板 id
 * @description 沿用原文件版的 id 规则；前端传入的 id 若已存在则重新生成，新模板追加到列表末尾
 */
export const createTemplate = async (input: PlaygroundTemplateInput): Promise<string> => {
  const [idRows] = await getPool().query<RowDataPacket[]>(
    'SELECT id FROM hp_playground_templates',
  );
  const existingIds = (idRows as Pick<PlaygroundTemplateRow, 'id'>[]).map((row) => row.id);
  const id = input.id && !existingIds.includes(input.id)
    ? input.id
    : generateId(input.label, existingIds);

  const [orderRows] = await getPool().query<RowDataPacket[]>(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM hp_playground_templates',
  );
  const nextOrder = Number((orderRows as { next_order: number }[])[0].next_order);

  await getPool().execute<ResultSetHeader>(
    'INSERT INTO hp_playground_templates (id, label, category, fields, sort_order) VALUES (?, ?, ?, ?, ?)',
    [id, input.label, input.category ?? null, JSON.stringify(input.fields), nextOrder],
  );
  return id;
};

/**
 * 更新模板 fields
 * @param {string} id - 模板唯一标识
 * @param {unknown[]} fields - 新的表单 schema 数组
 * @returns {Promise<boolean>} 模板存在并已更新返回 true
 * @description 先判存在再更新：MySQL 的 affectedRows 是「变更行数」，内容不变时为 0，不能用来判断是否存在
 */
export const updateTemplateFields = async (id: string, fields: unknown[]): Promise<boolean> => {
  const exists = await getTemplateById(id);
  if (!exists) return false;
  await getPool().execute<ResultSetHeader>(
    'UPDATE hp_playground_templates SET fields = ? WHERE id = ?',
    [JSON.stringify(fields), id],
  );
  return true;
};

/**
 * 删除模板
 * @param {string} id - 模板唯一标识
 * @returns {Promise<boolean>} 删除成功返回 true
 */
export const deleteTemplateById = async (id: string): Promise<boolean> => {
  const [result] = await getPool().execute<ResultSetHeader>(
    'DELETE FROM hp_playground_templates WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
};

// ==============================
// 参数校验
// ==============================

/**
 * 解析并校验 fields 参数
 * @param {unknown} fields - 请求体中的 fields 字段
 * @returns {{ code: 0; data: unknown[] } | { code: -1; message: string }}
 */
export const parseAndValidateFields = (
  fields: unknown,
): { code: 0; data: unknown[] } | { code: -1; message: string } => {
  if (typeof fields !== 'string') {
    return { code: -1, message: '参数 fields 必须是字符串' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fields);
  } catch {
    return { code: -1, message: 'fields 不是合法的 JSON' };
  }

  if (!Array.isArray(parsed)) {
    return { code: -1, message: 'fields 必须是数组' };
  }

  return { code: 0, data: parsed };
};
