import { formatServerTime } from '@/utils/format';

/**
 * 格式化时间戳
 * @param {number} timestamp - 毫秒时间戳
 * @returns {string} 服务器时区时间；0 值显示占位符
 */
export const formatAiTime = (timestamp: number): string => timestamp ? formatServerTime(timestamp) : '-';

/**
 * 格式化耗时
 * @param {number} ms - 毫秒数
 * @returns {string} 毫秒或秒文本
 */
export const formatAiDuration = (ms: number): string => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

/**
 * 格式化 token 数
 * @param {number} value - token 数
 * @returns {string} 带千分位的文本
 */
export const formatAiTokens = (value: number): string => Number(value ?? 0).toLocaleString();

/**
 * 格式化百分比
 * @param {number} rate - 0~1 的比率
 * @returns {string} 百分比文本
 */
export const formatAiPercent = (rate: number): string => `${(Number(rate ?? 0) * 100).toFixed(1)}%`;

/** 工具结果协议包装（后端 wrapToolResult 产出：<tool_result name="x">…JSON…</tool_result>） */
const TOOL_RESULT_SOURCE = '<tool_result\\s+name="([^"]*)">([\\s\\S]*?)<\\/tool_result>';

/**
 * 把整段文本解析成 JSON 并缩进排版
 * @param {string} text - 待解析文本
 * @returns {string | null} 排版后的 JSON；不是合法 JSON 时返回 null
 */
const formatJsonText = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
};

/**
 * 找到与起始括号匹配的结束位置
 * @param {string} text - 原始文本
 * @param {number} start - JSON 起始下标（字符为 { 或 [）
 * @returns {number} 结束下标（不含）；括号不配对时返回 -1
 * @description 跳过字符串内的括号与转义字符，避免把文本里的引号误当结构边界
 */
const findJsonEnd = (text: string, start: number): number => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
};

/**
 * 兜底排版：无法解析的压缩 JSON 也按字段边界断行
 * @param {string} text - 原始文本
 * @returns {string} 断行后的文本；看起来不是 JSON 时原样返回
 * @description 历史数据可能被截断而解析失败，至少不让所有字段挤在同一行
 */
const breakDenseJson = (text: string): string => {
  if (!/[{[]/.test(text) || !/"[^"]+"\s*:/.test(text)) return text;
  return text
    .replace(/,(?="[^"]{1,120}"\s*:)/g, ',\n')
    .replace(/([{[])(?=")/g, '$1\n')
    .replace(/([}\]])(?=[{[])/g, '$1\n');
};

/**
 * 提取工具结果包装里的工具名
 * @param {string | null | undefined} text - 消息正文
 * @returns {string} 工具名；无包装时返回空串
 * @description 老消息的 hp_ai_messages.name 为空，可从协议包装里补出工具名
 */
export const extractToolResultName = (text?: string | null): string => {
  const match = new RegExp(TOOL_RESULT_SOURCE).exec(text ?? '');
  return match?.[1] ?? '';
};

/**
 * 判断内容是否过长（需要提供折叠控件）
 * @param {string | null | undefined} text - 消息正文
 * @returns {boolean} 超长或包含工具结果包装时为 true
 */
export const isLongAiText = (text?: string | null): boolean => {
  const raw = text ?? '';
  return raw.length > 400 || raw.includes('<tool_result');
};

/**
 * 把消息正文 / 工具参数 / 工具结果排版成可读文本
 * @param {string | null | undefined} text - 原始文本
 * @returns {string} 格式化后的文本
 * @description 依次处理：纯 JSON → <tool_result> 协议包装 → 混合文本内嵌 JSON → 压缩 JSON 断行兜底；
 *   协议标签会替换成「▸ 工具名」，不再把标签和大坨压缩 JSON 原样输出。
 */
export const prettifyAiText = (text?: string | null): string => {
  const raw = (text ?? '').trim();
  if (!raw) return '';

  const json = formatJsonText(raw);
  if (json) return json;

  const blocks = [...raw.matchAll(new RegExp(TOOL_RESULT_SOURCE, 'g'))];
  if (blocks.length > 0) {
    const parts: string[] = [];
    let cursor = 0;
    for (const block of blocks) {
      const start = block.index ?? 0;
      const before = raw.slice(cursor, start).trim();
      if (before) parts.push(prettifyAiText(before));
      const body = formatJsonText(block[2]) ?? breakDenseJson(block[2].trim());
      parts.push(`▸ ${block[1]}\n${body}`);
      cursor = start + block[0].length;
    }
    const after = raw.slice(cursor).trim();
    if (after) parts.push(prettifyAiText(after));
    return parts.join('\n\n');
  }

  let attempts = 0;
  for (let index = 0; index < raw.length && attempts < 8; index += 1) {
    if (raw[index] !== '{' && raw[index] !== '[') continue;
    attempts += 1;
    const end = findJsonEnd(raw, index);
    if (end < 0) continue;
    const formatted = formatJsonText(raw.slice(index, end));
    if (!formatted) continue;
    const prefix = raw.slice(0, index).trimEnd();
    const suffix = raw.slice(end).trimStart();
    return [prefix, formatted, suffix].filter(Boolean).join('\n\n');
  }

  return breakDenseJson(raw);
};
