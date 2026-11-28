/**
 * Playground 表单模板类型
 * @description hp_playground_templates 是模板数据的唯一持久化落点；
 *   初始 21 条模板固化在 sql/playground/34_playground_templates.sql，原 JSON 数据文件已删除。
 */

/** 模板数据类型（与前端 TemplateItem 对齐） */
export interface TemplateData {
  /** 模板唯一标识 */
  id: string;
  /** 展示名称（可为 $t: i18n 键） */
  label: string;
  /** 表单 schema 数组 */
  fields: unknown[];
  /** 分组 */
  category?: string;
}

/** 从 hp_playground_templates 读出的一行 */
export interface PlaygroundTemplateRow {
  /** 模板唯一标识 */
  id: string;
  /** 展示名称 */
  label: string;
  /** 分组（可为 NULL） */
  category: string | null;
  /** JSON 列：mysql2 通常已解析为数组，兼容字符串形态 */
  fields: unknown[] | string;
  /** 展示顺序 */
  sort_order: number;
}

/** 新增模板的入参 */
export interface PlaygroundTemplateInput {
  /** 展示名称 */
  label: string;
  /** 表单 schema 数组 */
  fields: unknown[];
  /** 自定义 id（可选，冲突时自动生成） */
  id?: string;
  /** 分组 */
  category?: string;
}
