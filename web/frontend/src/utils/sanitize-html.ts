import DOMPurify from 'dompurify';

/**
 * 净化 HTML（v-html 渲染前的统一入口）
 *
 * 背景：marked 新版已移除内置 sanitize 选项，渲染结果直接交给 v-html 会把
 * `<script>`、`on*` 事件、`javascript:` 协议等内容一并注入 —— AI 输出与
 * 用户编辑的富文本都不可信，因此在所有 marked 渲染出口统一过一遍 DOMPurify。
 *
 * 说明：
 *   - 使用默认配置：保留 class / data-* / style（markdown-body 样式、图片与
 *     mermaid 占位符都依赖 class），只剔除真正危险的节点与属性
 *   - DOMPurify 依赖 DOM，仅在浏览器环境可用；本项目所有渲染都在前端，后端不调用
 */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  return DOMPurify.sanitize(html);
};
