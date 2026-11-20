import { Marked, Renderer, type Tokens, type RendererObject } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize-html';
import { internalLinkAttrs, linkifyInternalPaths } from './internal-link';

// ============================================================
// Markdown 渲染（AI 聊天气泡专用）
// ============================================================

/** 视频占位符（使用 NUL 字符避免与正常文本冲突） */
const PLACEHOLDER_VIDEO_PREFIX = '\u0000VIDEO';
const PLACEHOLDER_END = '\u0000';

/**
 * 转义 HTML 属性中的特殊字符（仅用于 src/href/alt 等属性值的兜底处理）
 * @param {string} s - 原始字符串
 * @returns {string} 转义后的字符串
 */
const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * 构建视频 HTML 标签（含 URL 安全校验）
 * @param {string} url - 视频地址
 * @param {string} poster - 封面图地址（可选）
 * @returns {string} 渲染后的 HTML
 * @description 仅允许 http/https 协议的视频源；preload=metadata 避免自动加载完整视频
 */
const buildVideoHtml = (url: string, poster: string): string => {
  const isSafeUrl = /^https?:\/\//.test(url);
  if (!isSafeUrl) return `[视频链接无效](${escapeAttr(url)})`;
  const isSafePoster = poster && /^https?:\/\//.test(poster);
  const posterAttr = isSafePoster ? ` poster="${escapeAttr(poster)}"` : '';
  return (
    `<video src="${escapeAttr(url)}"${posterAttr} controls preload="metadata" `
    + `class="msg__video">您的浏览器不支持视频播放，<a href="${escapeAttr(url)}" target="_blank" rel="noopener">点击查看</a></video>`
  );
};

/**
 * 升级旧格式的视频 Markdown 为新语法，以兼容历史会话
 * @param {string} text - 原始文本
 * @returns {string} 处理后的文本
 * @description 旧语法：`![cover](cover_url)\n[点击查看视频](video_url)`
 */
const upgradeLegacyVideoMarkdown = (text: string): string => {
  const pattern = /!\[cover\]\(([^)]+)\)\s*\n\s*\[(点击查看视频[^\]]*)\]\(([^)]+)\)/g;
  return text.replace(pattern, (_full, cover: string, label: string, video: string) =>
    `@[video](${video}){poster=${cover}}\n[${label}](${video})`,
  );
};

/**
 * 抽取视频自定义语法 `@[video](url){poster=cover}` 为占位符
 * @param {string} text - 原始文本（已升级旧视频语法）
 * @returns {{ text: string; videos: string[] }} 处理结果
 * @description 视频语法：`@[video](url){poster=cover}`，其中 url 和 cover 均为可选参数，poster 默认为空字符串
 */
const extractVideos = (text: string): { text: string; videos: string[] } => {
  const videos: string[] = [];
  const pattern = /@\[video\]\(([^)]+)\)(?:\{poster=([^}]*)\})?/g;
  const replaced = text.replace(pattern, (_m, url: string, poster?: string) => {
    const idx = videos.length;
    videos.push(buildVideoHtml(url, poster ?? ''));
    return `${PLACEHOLDER_VIDEO_PREFIX}${idx}${PLACEHOLDER_END}`;
  });
  return { text: replaced, videos };
};

/**
 * 还原视频占位符为真实 HTML
 * @param {string} html - 已经过 marked 渲染的 HTML
 * @param {string[]} videos - 视频 HTML 映射表
 * @returns {string} 还原后的 HTML
 * @description marked 会把占位符当普通文本输出，包裹在 <p> 内；这里直接做字符串替换即可
 */
const restoreVideos = (html: string, videos: string[]): string =>
  // eslint-disable-next-line no-control-regex -- \u0000 是自造的占位符边界，需按控制字符匹配
  html.replace(/\u0000VIDEO(\d+)\u0000/g, (_m, idx: string) => videos[Number(idx)] ?? '');

/**
 * URL 协议白名单校验
 * @param {string} url - 待校验的 URL
 * @param {RegExp} allow - 允许的协议正则
 * @returns {boolean} 是否合法
 */
const isAllowedUrl = (url: string, allow: RegExp): boolean => allow.test(url);

/**
 * 判断代码块内容是否像 mermaid 图源码
 * @param {string} text - 代码块原文
 * @returns {boolean} 首个有效行是 mermaid 图声明时返回 true
 * @description 模型偶尔用无语言围栏或 text / plain 围栏包图表，只认 lang=mermaid 会原样输出；
 *   这里按首行兜底，且要求首行只有图类型（可带方向），避免把普通代码误判成图
 */
const looksLikeMermaid = (text: string): boolean => {
  const firstLine = text.trim().split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('%%')) ?? '';
  return /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|sankey-beta|xychart-beta|block-beta)(?:\s+(?:TB|TD|BT|RL|LR|beta))?\s*$/i.test(firstLine);
};

/** 图片占位符的 CSS 选择器 / 类名，供组件层挂载真实预览组件时定位 */
export const IMAGE_PLACEHOLDER_CLASS = 'md-image-placeholder';

/** mermaid 代码块占位符的 CSS 类名，供组件层把源码渲染成真实图形时定位 */
export const MERMAID_PLACEHOLDER_CLASS = 'md-mermaid';

/**
 * 自定义 marked Renderer：覆盖 image / link，确保 URL 白名单校验，
 * 并强制外链 target="_blank"
 * @description image 仅允许 http/https/data:image 协议，link 仅允许 http/https/mailto 协议；
 *   image 不直接吐 <img>，而是吐一个占位 <span>，由组件层挂载 <ImagePreviewer> 实现弹出预览
 */
const customRenderer: RendererObject = {
  image({ href, title, text }: Tokens.Image): string {
    // 同源相对路径（/skill-images/... 等）与 http(s)、data:image 一并放行；
    // 协议相对路径（//host）不放行，避免被当成协议混淆
    const safeAllow = /^(https?:|data:image\/|\/(?!\/))/i;
    if (!isAllowedUrl(href, safeAllow)) {
      return escapeAttr(text || href);
    }
    const titleAttr = title ? ` data-title="${escapeAttr(title)}"` : '';
    // 占位元素：组件层会读取 data-src/data-alt 然后挂载 ImagePreviewer 替换
    return `<span class="${IMAGE_PLACEHOLDER_CLASS}" data-src="${escapeAttr(href)}" data-alt="${escapeAttr(text || '')}"${titleAttr}></span>`;
  },
  code({ text, lang }: Tokens.Code): string {
    const language = (lang ?? '').trim().toLowerCase();
    // 显式 mermaid 围栏，或模型漏标语言 / 标成 text 但内容首行是图声明时，都按 mermaid 处理
    const isMermaid = language === 'mermaid'
      || (['', 'text', 'plain', 'plaintext', 'txt', 'flowchart', 'mermaidjs'].includes(language) && looksLikeMermaid(text));
    // 非 mermaid：自行拼默认代码块（不依赖 renderer 返回 false 的兜底行为）
    if (!isMermaid) {
      const cls = lang ? ` class="language-${escapeAttr(lang)}"` : '';
      return `<pre><code${cls}>${escapeAttr(text)}</code></pre>\n`;
    }
    // mermaid：外层 div 打占位标记，源码只放在 <pre><code> 里（流式期间也能看到内容），
    // 由组件层在回答结束后从 code.textContent 读取并渲染成 SVG 整体替换。
    // 不要把源码再复制进 data-* 属性：DOMPurify 的 _isUnsafeAttributeValue 会因 mermaid
    // 的 "-->" 判定属性值不安全而删除整个属性，组件层将取不到图源码
    return `<div class="${MERMAID_PLACEHOLDER_CLASS}">`
      + `<pre><code class="language-mermaid">${escapeAttr(text)}</code></pre></div>`;
  },
  link(this: Renderer, { href, title, tokens }: Tokens.Link): string {
    // 与图片一致：放行同源相对路径，贾维斯给出的站内页面链接（如 /approvals）才能点开
    const safeAllow = /^(https?:|mailto:|\/(?!\/))/i;
    const innerHtml = this.parser.parseInline(tokens);
    if (!isAllowedUrl(href, safeAllow)) {
      return innerHtml;
    }
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    // 站内路由：不新开标签（整页刷新会丢会话上下文），由气泡层拦截后走 vue-router
    if (href.startsWith('/')) {
      return `<a href="${escapeAttr(href)}"${titleAttr}${internalLinkAttrs()}>${innerHtml}</a>`;
    }
    return `<a href="${escapeAttr(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${innerHtml}</a>`;
  },
};

// 聊天渲染专用实例：用独立 Marked 实例装载自定义 renderer，而不是 marked.use 全局注册，
const CHAT_MARKED = new Marked({
  gfm: true,
  breaks: true,
  renderer: customRenderer,
});

/**
 * 把 AI 聊天 Markdown 文本渲染为安全的 HTML 字符串
 * @param {string} text - 原始 Markdown 文本
 * @param {string[]} [internalPaths] - 前端路由表里的站内路径，用于把裸路由补成链接（不传则不补）
 * @returns {string} 渲染后的 HTML
 * @description 流程：升级旧视频语法 → 补站内路由链接 → 抽取视频占位符 → marked 渲染 → 还原视频占位符
 */
export const renderChatMarkdown = (text: string, internalPaths: string[] = []): string => {
  const upgraded = upgradeLegacyVideoMarkdown(text);
  const linkified = linkifyInternalPaths(upgraded, internalPaths);
  const { text: afterVideo, videos } = extractVideos(linkified);
  const html = CHAT_MARKED.parse(afterVideo) as string;
  // AI 输出不可信：还原视频标签后统一净化，再交给 v-html 渲染
  return sanitizeHtml(restoreVideos(html, videos));
};
