import path from 'path';

/**
 * playground-templates.json 文件的绝对路径
 */
export const PLAYGROUND_TEMPLATES_FILE = path.resolve(
  __dirname,
  '../data/playground-templates.json',
);

/** 模板数据类型 */
export interface TemplateData {
  id: string;
  label: string;
  fields: unknown[];
  category?: string;
}
