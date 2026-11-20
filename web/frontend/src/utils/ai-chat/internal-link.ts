// ============================================================
// 站内路由链接：把 AI 回答里的裸路由（如 /approvals）补成可点击链接
// ============================================================

import { INTERNAL_LINK_ATTR, INTERNAL_LINK_CLASS } from '@/constants/ai-chat';

/**
 * 代码段占位符前缀（使用 NUL 字符避免与正常文本冲突）
 * @description 自动补链接前先把代码块换成占位符，避免把示例代码里的路径字符串也变成链接
 */
const CODE_PLACEHOLDER_PREFIX = '\u0000CODE';

/** 代码段占位符结束标记 */
const CODE_PLACEHOLDER_END = '\u0000';

/** 代码段占位符匹配正则（用于还原） */
// eslint-disable-next-line no-control-regex -- \u0000 是自造的占位符边界，需按控制字符匹配
const CODE_PLACEHOLDER_RE = /\u0000CODE(\d+)\u0000/g;

/**
 * 转义正则元字符
 * @param {string} s - 原始字符串
 * @returns {string} 转义后的字符串
 */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 构造占位符
 * @param {number} idx - 代码段下标
 * @returns {string} 占位符文本
 */
const placeholder = (idx: number): string => `${CODE_PLACEHOLDER_PREFIX}${idx}${CODE_PLACEHOLDER_END}`;

/**
 * 把代码段（围栏块 + 行内代码）替换为占位符
 * @param {string} text - 原始文本
 * @returns {{ text: string; codes: string[] }} 保护后的文本与代码段原文列表
 */
const protectCode = (text: string): { text: string; codes: string[] } => {
  const codes: string[] = [];
  const collect = (m: string): string => {
    codes.push(m);
    return placeholder(codes.length - 1);
  };
  // 先围栏块（可跨行），再行内代码（此时围栏内容已是占位符，不会误匹配）
  const withoutFence = text.replace(/```[\s\S]*?```/g, collect);
  return { text: withoutFence.replace(/`[^`\n]+`/g, collect), codes };
};

/**
 * 还原代码段占位符为原文
 * @param {string} text - 含占位符的文本
 * @param {string[]} codes - 代码段原文列表
 * @returns {string} 还原后的文本
 */
const restoreCode = (text: string, codes: string[]): string =>
  text.replace(CODE_PLACEHOLDER_RE, (_m, idx: string) => codes[Number(idx)] ?? '');

/**
 * 把文本里出现的站内路由补成 Markdown 链接
 * @param {string} text - 原始 Markdown 文本
 * @param {string[]} paths - 前端路由表里可直达的路径（如 /approvals、/rbac/users）
 * @returns {string} 补完链接的文本；paths 为空时原样返回
 * @description 模型不一定记得把路径写成 `[页面名](/path)`，这里做四层兜底（保证用户能点）：
 *   ① 行内代码整体就是路径（`` `/approvals` ``）→ 包成链接，显示保持代码样式；
 *   ② 行内代码整体是自拼完整 URL（`` `http://<IP>:9527/approvals` ``）→ 展示保留原文，点击跳站内相对路径；
 *   ③ 普通文本里的完整 URL → 同上；
 *   ④ 裸路径（"去 /approvals 页"）→ 直接包成 Markdown 链接。
 *   已经在链接里的 `](...)`、代码块里的路径、以及更长路径的一部分都不会被重复处理。
 */
export const linkifyInternalPaths = (text: string, paths: string[]): string => {
  const valid = paths.filter((p) => p.startsWith('/') && p.length > 1);
  if (valid.length === 0) return text;

  // 长的在前，避免 /rbac 抢先匹配掉 /rbac/users
  const alt = [...valid].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');

  // ① 行内代码整体就是站内路径：`/approvals` → [`/approvals`](/approvals)
  const codeLinkPattern = new RegExp('`(' + alt + ')`', 'g');
  const withCodeLinks = text.replace(codeLinkPattern, (m, p) => `[${m}](${p})`);

  // ② 行内代码整体是自拼完整 URL（host 任意）：`http://<IP>:9527/approvals` → [`原文`](/approvals)
  const codeUrlPattern = new RegExp('`(https?://[^\\s`]+?(' + alt + '))(?![\\w/-])`', 'g');
  const withCodeUrls = withCodeLinks.replace(codeUrlPattern, (m, _url, p) => `[${m}](${p})`);

  const { text: protectedText, codes } = protectCode(withCodeUrls);

  // ③ 普通文本里的自拼完整 URL（host 任意，pathname 命中已知路由）：展示保留原文，点击跳站内
  const urlPattern = new RegExp(`(?<![(\\[])https?:\\/\\/[^\\s\`\\]]+?(${alt})(?![\\w/-])`, 'g');
  const withUrls = protectedText.replace(urlPattern, (m, p) => `[${m}](${p})`);

  // ④ 裸路径：前面不允许是单词字符 / 路径字符 / 链接与代码语法字符，避免重复包一层
  const pathPattern = new RegExp(`(?<![\\w/.(\`\\]])(?:${alt})(?![\\w/-])`, 'g');
  const linked = withUrls.replace(pathPattern, (m) => `[${m}](${m})`);
  return restoreCode(linked, codes);
};

/**
 * 站内路由链接的 HTML 属性片段（由 Markdown renderer 打在 <a> 上）
 * @returns {string} class 与 data 属性拼成的属性串
 */
export const internalLinkAttrs = (): string =>
  ` class="${INTERNAL_LINK_CLASS}" ${INTERNAL_LINK_ATTR}="1"`;
