import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize-html';

/**
 * 取 Markdown 内容的第一行非空文本并渲染为 HTML（用于表格预览列单行展示）
 * @description 先用 marked.parse 解析块级语法（如 ## 标题），再剥掉最外层块级标签
 *              （h1~h6、p、ul/ol、blockquote 等）只保留 innerHTML，这样 `## 标题`
 *              能被正确解析，同时保留 strong/em/code 等行内样式。
 * @param content - 原始 Markdown 内容
 * @param maxLength - 截断的原始字符预算（默认 60），实际按 maxLength*3 截断以保护 HTML 标签
 */
export const buildMarkdownPreviewHtml = (content: string, maxLength: number = 60): string => {
  if (!content) return '';
  const firstLine = content.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0) ?? '';
  if (!firstLine) return '';
  // 先净化再剥标签/截断：截断可能切出不闭合标签，但片断本身已无危险内容
  const fullHtml = sanitizeHtml(marked.parse(firstLine, { breaks: false }) as string);
  const stripped = fullHtml
    .replace(/^\s*<(h[1-6]|p|ul|ol|li|blockquote|pre)[^>]*>/i, '')
    .replace(/<\/(h[1-6]|p|ul|ol|li|blockquote|pre)>\s*$/i, '')
    .trim();
  if (stripped.length > maxLength * 3) {
    return `${stripped.slice(0, maxLength * 3)}...`;
  }
  return stripped;
};

/**
 * 将完整 Markdown 内容渲染为 HTML（用于悬浮 tooltip 展示全部内容）
 * @param content - 原始 Markdown 内容
 */
export const buildMarkdownFullHtml = (content: string): string => {
  if (!content) return '';
  return sanitizeHtml(marked.parse(content, { breaks: true }) as string);
};
