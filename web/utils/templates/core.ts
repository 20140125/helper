import { promises as fs } from 'fs';
import { CACHE_DIR } from '@/utils/paths';

/** 模板文件路径 */
const TEMPLATE_FILE = `${CACHE_DIR}/message_templates.json`;

/**
 * 读取模板配置对象
 * @returns {Promise<Record<string, unknown>>} 完整模板配置
 */
export const readTemplates = async (): Promise<Record<string, unknown>> => {
  const data = await fs.readFile(TEMPLATE_FILE, 'utf-8');
  return JSON.parse(data) as Record<string, unknown>;
};

/**
 * 将模板配置对象写回文件
 * @param {Record<string, unknown>} templates - 完整模板配置
 */
export const writeTemplates = async (templates: Record<string, unknown>): Promise<void> => {
  await fs.writeFile(TEMPLATE_FILE, JSON.stringify(templates, null, 2), 'utf-8');
};

/**
 * 读取模板文件的原始 JSON 字符串
 * @returns {Promise<string>} 原始 JSON 字符串
 */
export const readRawTemplates = async (): Promise<string> => {
  return fs.readFile(TEMPLATE_FILE, 'utf-8');
};

/**
 * 将原始 JSON 字符串写回模板文件（写入前校验格式）
 * @param {string} content - 完整 JSON 字符串
 * @throws {SyntaxError} JSON 格式错误时抛出
 */
export const writeRawTemplates = async (content: string): Promise<void> => {
  JSON.parse(content); // 格式校验
  await fs.writeFile(TEMPLATE_FILE, content, 'utf-8');
};

/**
 * 渲染模板：将占位符替换为实际值
 * @param {string} template - 模板字符串
 * @param {Record<string, string>} placeholders - 占位符填充数据
 * @returns {{ rendered: string; unresolved: string[] }} 渲染结果和未解析占位符列表
 */
export const renderTemplate = (
  template: string,
  placeholders: Record<string, string>,
): { rendered: string; unresolved: string[] } => {
  let rendered = template;
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    rendered = rendered.replace(regex, String(value));
  }
  const unresolved = rendered.match(/\{[^}]+\}/g) ?? [];
  return { rendered, unresolved };
};
