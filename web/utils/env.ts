import fs from 'fs';
import { ENV_FILE } from '@/types/env';

/**
 * 读取 .env 文件，解析为键值对象
 * @returns {Record<string, string>} 键值对象
 */
export const readEnvFile = (): Record<string, string> => {
  if (!fs.existsSync(ENV_FILE)) {
    return {};
  }
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const result: Record<string, string> = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  });
  return result;
};

/**
 * 更新单行 .env 内容，若该行的 key 在 updates 中则替换，并记录已更新的 key
 * @param {string} line - 原始行内容
 * @param {Record<string, string>} updates - 需要更新的键值对
 * @param {Set<string>} updatedKeys - 已更新 key 的集合（会被修改）
 * @returns {string} 更新后的行内容
 */
const updateEnvLine = (
  line: string,
  updates: Record<string, string>,
  updatedKeys: Set<string>,
): string => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return line;
  const idx = trimmed.indexOf('=');
  if (idx === -1) return line;
  const key = trimmed.slice(0, idx).trim();
  if (key in updates) {
    updatedKeys.add(key);
    return `${key}=${updates[key]}`;
  }
  return line;
};

/** 需要引号包裹的字符：空格与 shell 特殊字符 */
const NEEDS_QUOTE_RE = /[\s"'\\$|&;<>()[\]{}`!*?#~^=]/;

/**
 * 判断值是否已经被成对的引号包裹
 * @param {string} value - 原始值
 * @returns {boolean} 已包裹返回 true
 */
const isQuoted = (value: string): boolean => {
  if (value.length < 2) return false;
  const head = value[0];
  return (head === '"' || head === "'") && value.endsWith(head);
};

/**
 * 把值格式化成可安全写进 .env 的形态（含特殊字符时用引号包裹）
 * @param {string} value - 原始值
 * @returns {string} 可直接拼在 `KEY=` 后的文本
 * @description 沿用本项目既有约定：值含空格或 `|` `&` `$` 等 shell 特殊字符时自己带引号
 *   （同 .env 里的 BIRTHDAY_LIST="张三|lunar:02-03|..."）。脚本里大量用 `set -a; source .env`，
 *   不加引号时 shell 会把后半段当命令执行（如 `113.88,22.56: command not found`）。
 *   已经带引号的值原样返回，避免反复保存时引号叠加。
 *   由调用方（配置页 / update_config 工具）自行调用，读写函数本身不做隐式处理。
 */
export const formatEnvValue = (value: string): string => {
  if (isQuoted(value)) return value;
  if (!NEEDS_QUOTE_RE.test(value)) return value;
  if (!value.includes('"')) return `"${value}"`;
  return `'${value}'`;
};

/**
 * 将键值对象写回 .env 文件（保留注释行）
 * @param {Record<string, string>} updates - 需要写入的键值对
 */
export const writeEnvFile = (updates: Record<string, string>): void => {
  let content = '';
  if (fs.existsSync(ENV_FILE)) {
    content = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  const updatedKeys = new Set<string>();
  const newLines = content.split('\n').map((line) => updateEnvLine(line, updates, updatedKeys));

  // 追加新增的 key
  Object.entries(updates).forEach(([key, value]) => {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${value}`);
    }
  });

  fs.writeFileSync(ENV_FILE, newLines.join('\n'), 'utf-8');
};
