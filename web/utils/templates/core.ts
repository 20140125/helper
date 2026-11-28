import { readCacheJson, writeCacheJson, readCacheBody, writeCacheBody } from '@/utils/database/cache-store';

/** 模板配置缓存键（相对 .cache 的路径，真源为 已有业务表） */
const TEMPLATES_KEY = 'message_templates.json';

/**
 * 读取模板配置对象
 * @returns {Promise<Record<string, unknown>>} 完整模板配置；缓存缺失或格式错误时抛出异常交由路由转 500
 * @description 真源为缓存 KV，不再触碰磁盘文件
 */
export const readTemplates = async (): Promise<Record<string, unknown>> => {
  const data = await readCacheJson<Record<string, unknown>>(TEMPLATES_KEY);
  if (data === null) throw new Error('模板配置不存在或格式错误');
  return data;
};

/**
 * 将模板配置对象写回缓存
 * @param {Record<string, unknown>} templates - 完整模板配置
 * @returns {Promise<void>}
 * @description 序列化格式与旧版一致（2 空格缩进）
 */
export const writeTemplates = async (templates: Record<string, unknown>): Promise<void> => {
  await writeCacheJson(TEMPLATES_KEY, templates);
};

/**
 * 读取模板条目的原始 JSON 字符串
 * @returns {Promise<string>} 原始 JSON 字符串；缓存缺失时抛出异常交由路由转 500
 * @description 供前端 JSON 编辑器展示，保留原始全文（含缩进与换行）
 */
export const readRawTemplates = async (): Promise<string> => {
  const data = await readCacheBody(TEMPLATES_KEY);
  if (data === null) throw new Error('模板配置不存在');
  return data;
};

/**
 * 将原始 JSON 字符串写回缓存（写入前校验格式）
 * @param {string} content - 完整 JSON 字符串
 * @returns {Promise<void>}
 * @throws {SyntaxError} JSON 格式错误时抛出
 * @description 直接保存原始全文，不做二次序列化，保证前端编辑器内容原样落库
 */
export const writeRawTemplates = async (content: string): Promise<void> => {
  JSON.parse(content); // 格式校验
  await writeCacheBody(TEMPLATES_KEY, content);
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
