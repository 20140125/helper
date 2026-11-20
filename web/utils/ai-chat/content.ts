import type { ChatContentPart } from '@/types/ai-chat';

// ==============================
// 多模态消息内容工具
// ==============================

/**
 * 判断一个内容片段是否为图片片段
 * @param {unknown} part - 待判定的内容片段
 * @returns {boolean} 是图片片段返回 true
 */
export const isImageContentPart = (part: unknown): part is Extract<ChatContentPart, { type: 'image_url' }> => {
  if (!part || typeof part !== 'object') return false;
  const p = part as { type?: unknown; image_url?: { url?: unknown } };
  return p.type === 'image_url' && typeof p.image_url?.url === 'string';
};

/**
 * 判断消息内容是否为多模态内容片段数组
 * @param {unknown} raw - 消息内容
 * @returns {boolean} 是内容片段数组返回 true
 * @description 与历史「文生图」遗留格式 [{ url }] 区分：那种数组没有 type 字段
 */
export const isContentPartArray = (raw: unknown): raw is ChatContentPart[] => {
  return Array.isArray(raw)
    && raw.length > 0
    && raw.every((item) => item && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string');
};

/**
 * 从消息内容中取出纯文本
 * @param {string | ChatContentPart[] | undefined} content - 消息内容
 * @returns {string} 文本内容；多模态数组取所有 text 片段拼接，取不到返回空串
 * @description 规划 / 反思等辅助调用只需要文本，图片片段对它们无意义
 */
export const extractMessageText = (content: string | ChatContentPart[] | undefined): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (part && typeof part === 'object' && part.type === 'text' ? (part as { text?: string }).text ?? '' : ''))
    .filter(Boolean)
    .join('\n');
};

/**
 * 从消息内容中取出图片 URL 列表
 * @param {string | ChatContentPart[] | undefined} content - 消息内容
 * @returns {string[]} 图片 URL 列表（按原顺序）
 */
export const extractMessageImages = (content: string | ChatContentPart[] | undefined): string[] => {
  if (!Array.isArray(content)) return [];
  return content.filter(isImageContentPart).map((part) => part.image_url.url);
};

/**
 * 校验并清洗前端上传的图片 Data URL
 * @param {unknown} images - 前端传入的 images 字段
 * @returns {string[]} 合法的 data:image/... 图片 URL 列表（非法项被丢弃）
 */
export const sanitizeImageDataUrls = (images: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images.filter(
    (item): item is string => typeof item === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(item),
  );
};

/**
 * 组装用户消息内容（纯文本 / 多模态）
 * @param {string} text - 用户输入的文本
 * @param {string[]} images - 随消息上传的图片 Data URL 列表
 * @returns {string | ChatContentPart[]} 无图片时直接返回文本字符串；有图片时返回内容片段数组
 */
export const buildUserContent = (text: string, images: string[]): string | ChatContentPart[] => {
  if (images.length === 0) return text;
  const parts: ChatContentPart[] = [{ type: 'text', text }];
  for (const url of images) {
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return parts;
};
