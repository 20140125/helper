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

/**
 * 把 JSON 字符串排版成可读文本
 * @param {string | null | undefined} text - 工具参数或结果原文
 * @returns {string} 格式化后的文本；非 JSON 时原样返回
 */
export const prettifyAiText = (text?: string | null): string => {
  const raw = text ?? '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};
