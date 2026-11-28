/**
 * 缓存数据管理页的展示工具
 * @description 只放纯函数：大小/时间格式化、粒度标签与 JSON 转 Markdown
 */
import type { Locale } from '@/types/locale';
import type { CacheAdminPeriod } from '@/types/cache-admin';

/**
 * 字节数转可读大小
 * @param {number} size - 字节数
 * @returns {string} 带单位的大小文本
 */
export const formatCacheSize = (size: number): string =>
  (size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`);

/**
 * 毫秒时间戳转本地时间
 * @param {number} value - 毫秒时间戳
 * @returns {string} 本地时间文本，0 时返回占位符
 */
export const formatCacheTime = (value: number): string =>
  (value ? new Date(value).toLocaleString() : '—');

/**
 * 时间粒度标签
 * @param {CacheAdminPeriod} period - 粒度值
 * @param {Locale} t - 当前语言包
 * @returns {string} 本地化标签
 */
export const cachePeriodLabel = (period: CacheAdminPeriod, t: Locale): string => {
  const labels: Record<CacheAdminPeriod, string> = {
    day: t.cacheAdmin.periodDay,
    month: t.cacheAdmin.periodMonth,
    year: t.cacheAdmin.periodYear,
    static: t.cacheAdmin.periodStatic,
  };
  return labels[period] ?? period;
};

/** JSON 转 Markdown 的可选参数 */
interface JsonToMarkdownOptions {
  /** 一级标题 */
  title?: string;
  /** 输出上限（字符），避免大 JSON 把预览撑爆 */
  maxLength?: number;
  /** 截断提示文案 */
  truncatedLabel?: string;
}

/**
 * 把 JSON 正文转换成易读的 Markdown
 * @param {string} body - 原始正文
 * @param {JsonToMarkdownOptions} options - 标题、长度上限与截断提示
 * @returns {string | null} Markdown 文本；正文不是合法 JSON 时返回 null
 * @description 对象渲染成键值列表，结构一致的数组渲染成表格，超过上限时截断
 */
export const jsonToMarkdown = (body: string, options: JsonToMarkdownOptions = {}): string | null => {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  const maxLength = options.maxLength ?? 20000;
  const lines: string[] = [];
  let size = 0;
  let truncated = false;
  const push = (line: string): void => {
    if (truncated) return;
    const remaining = maxLength - size - 1;
    if (remaining <= 0) {
      truncated = true;
      return;
    }
    if (line.length > remaining) {
      lines.push(`${line.slice(0, Math.max(0, remaining - 1))}…`);
      truncated = true;
      return;
    }
    lines.push(line);
    size += line.length + 1;
  };
  const escapeInline = (value: string): string =>
    value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, '\\`').replace(/\r?\n/g, ' ').trim();
  const isPlain = (value: unknown): boolean => value === null || typeof value !== 'object';
  const primitive = (value: unknown): string => {
    if (value === null) return '`null`';
    if (typeof value === 'number' || typeof value === 'boolean') return `\`${String(value)}\``;
    const text = escapeInline(String(value));
    return text ? `\`${text}\`` : '`""`';
  };
  const renderTable = (items: Array<Record<string, unknown>>, indent: string): string[] => {
    const keys = Array.from(new Set(items.flatMap((item) => Object.keys(item)))).slice(0, 8);
    const cell = (value: unknown): string => (isPlain(value)
      ? primitive(value)
      : `\`${escapeInline(JSON.stringify(value))}\``);
    return [
      `${indent}| ${keys.map(escapeInline).join(' | ')} |`,
      `${indent}| ${keys.map(() => '---').join(' | ')} |`,
      ...items.slice(0, 50).map((item) => `${indent}| ${keys.map((key) => cell(item[key])).join(' | ')} |`),
    ];
  };
  const render = (value: unknown, depth: number): void => {
    if (truncated) return;
    const indent = '  '.repeat(depth);
    if (depth > 6) {
      push(`${indent}- \`…\``);
      return;
    }
    if (isPlain(value)) {
      push(`${indent}- ${primitive(value)}`);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        push(`${indent}- \`[]\``);
        return;
      }
      const objects = value.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
      if (objects.length === value.length && depth < 3) {
        renderTable(objects as Array<Record<string, unknown>>, indent).forEach(push);
        return;
      }
      value.forEach((item, index) => {
        if (truncated) return;
        if (isPlain(item)) push(`${indent}- **${index + 1}**: ${primitive(item)}`);
        else {
          push(`${indent}- **${index + 1}**`);
          render(item, depth + 1);
        }
      });
      return;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      push(`${indent}- \`{}\``);
      return;
    }
    for (const [key, val] of entries) {
      if (truncated) return;
      if (isPlain(val)) push(`${indent}- **${escapeInline(key)}**: ${primitive(val)}`);
      else {
        push(`${indent}- **${escapeInline(key)}**`);
        render(val, depth + 1);
      }
    }
  };
  if (options.title) push(`## ${options.title}`);
  render(data, 0);
  if (truncated && options.truncatedLabel) lines.push(`> ${options.truncatedLabel}`);
  return lines.length > 0 ? lines.join('\n') : '`{}`';
};
