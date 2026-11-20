import fs from 'fs';
import { PLAYGROUND_TEMPLATES_FILE, type TemplateData } from '@/types/playground';

// 重导出类型以兼容既有通过 '../utils/playground' 导入 TemplateData 的调用方
export type { TemplateData };

// ==============================
// 文件读写
// ==============================

/**
 * 读取模板列表
 * @returns {{ code: 0; data: TemplateData[] } | { code: -1; message: string }}
 */
export const readTemplates = (): { code: 0; data: TemplateData[] } | { code: -1; message: string } => {
  if (!fs.existsSync(PLAYGROUND_TEMPLATES_FILE)) {
    return { code: -1, message: '找不到 playground-templates.json 文件' };
  }
  try {
    const content = fs.readFileSync(PLAYGROUND_TEMPLATES_FILE, 'utf-8');
    const data = JSON.parse(content) as TemplateData[];
    return { code: 0, data };
  } catch (err) {
    return { code: -1, message: (err as Error).message };
  }
};

/**
 * 将模板列表写入文件
 * @param {TemplateData[]} templates - 要写入的模板列表
 * @returns {{ code: 0 } | { code: -1; message: string }}
 */
export const writeTemplates = (templates: TemplateData[]): { code: 0 } | { code: -1; message: string } => {
  try {
    fs.writeFileSync(PLAYGROUND_TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    return { code: 0 };
  } catch (err) {
    return { code: -1, message: (err as Error).message };
  }
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

