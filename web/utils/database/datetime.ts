/**
 * 文件快照 ↔ MySQL DATETIME 的时间文本转换
 * @description 供已迁库模块与迁移脚本共用，避免每个模块各写一份日期解析逻辑
 */
import { formatDate } from '@/utils/script';

/**
 * 把数据库 DATETIME 转成统一的时间文本
 * @param {unknown} value - 数据库返回的单元格值（Date / 字符串 / null）
 * @returns {string} yyyy-MM-dd HH:mm:ss 格式文本，空值返回空串
 */
export const toDateText = (value: unknown): string => {
  if (value instanceof Date) return formatDate(value);
  if (value === null || value === undefined) return '';
  return String(value);
};

/**
 * 把业务层时间文本规范化为 MySQL DATETIME 文本
 * @param {unknown} value - created_at / updated_at / resolvedAt 等时间文本
 * @returns {string | null} YYYY-MM-DD HH:mm:ss 或 null
 * @description 兼容历史 JSON 里的 2026/5/6 10:26:27 与 ISO 8601 文本
 */
export const normalizeDbDateTime = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const pad = (part: string): string => part.padStart(2, '0');
  const matched = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})/);
  if (matched) {
    return `${matched[1]}-${pad(matched[2])}-${pad(matched[3])} ${pad(matched[4])}:${matched[5]}:${matched[6]}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : formatDate(parsed);
};
