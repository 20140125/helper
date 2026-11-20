import fs from 'fs';
import path from 'path';
import {
  KNOWLEDGE_CONFIG_FILE,
  KNOWLEDGE_MAX_DOC_BYTES,
  KNOWLEDGE_USER_DIR,
  KNOWLEDGE_USER_DIR_ABS,
  DEFAULT_KNOWLEDGE_DIRS,
  type KnowledgeConfig,
  type KnowledgeDoc,
} from '@/types/knowledge';
import { CACHE_DIR, PROJECT_DIR } from '../paths';

/** 文档名合法格式：中文、字母、数字、下划线、横线，可带 .md 后缀 */
const DOC_NAME_PATTERN = /^[\w\u4e00-\u9fa5-]+(\.md)?$/i;

/** 文档名最大长度 */
const MAX_DOC_NAME_LENGTH = 80;

/**
 * 格式化时间为 YYYY-MM-DD HH:mm:ss
 * @param {Date} date - 时间对象
 * @returns {string} 格式化后的时间字符串
 */
const formatTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * 校验并规范化文档名
 * @param {string} raw - 原始文档名
 * @returns {string | null} 不含 .md 后缀的安全文件名；非法时返回 null
 * @description 拒绝路径分隔符、上级目录引用与控制字符，避免写文件越出知识目录
 */
export const normalizeDocName = (raw: string): string | null => {
  const name = (raw ?? '').trim();
  if (!name || name.length > MAX_DOC_NAME_LENGTH) return null;
  if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) return null;
  if (!DOC_NAME_PATTERN.test(name)) return null;
  return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name;
};

/**
 * 获取文档绝对路径
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string} 绝对路径
 */
const getDocPath = (name: string): string => path.join(KNOWLEDGE_USER_DIR_ABS, `${name}.md`);

/**
 * 列出用户维护的知识文档
 * @returns {KnowledgeDoc[]} 文档元信息列表，按更新时间倒序
 */
export const listKnowledgeDocs = (): KnowledgeDoc[] => {
  if (!fs.existsSync(KNOWLEDGE_USER_DIR_ABS)) return [];
  return fs.readdirSync(KNOWLEDGE_USER_DIR_ABS)
    .filter((file) => file.toLowerCase().endsWith('.md'))
    .map((file) => {
      const stat = fs.statSync(path.join(KNOWLEDGE_USER_DIR_ABS, file));
      return {
        name: file,
        path: `${KNOWLEDGE_USER_DIR}/${file}`,
        size: stat.size,
        updated_at: formatTimestamp(stat.mtime),
      } satisfies KnowledgeDoc;
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
};

/**
 * 读取知识文档正文
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string | null} 文档内容；不存在时返回 null
 */
export const readKnowledgeDoc = (name: string): string | null => {
  const filePath = getDocPath(name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
};

/**
 * 写入知识文档（新建或覆盖）
 * @param {string} name - 不含后缀的安全文档名
 * @param {string} content - Markdown 正文
 * @returns {void}
 * @description 目录不存在时自动创建
 */
export const writeKnowledgeDoc = (name: string, content: string): void => {
  if (!fs.existsSync(KNOWLEDGE_USER_DIR_ABS)) {
    fs.mkdirSync(KNOWLEDGE_USER_DIR_ABS, { recursive: true });
  }
  fs.writeFileSync(getDocPath(name), content, 'utf-8');
};

/**
 * 删除知识文档
 * @param {string} name - 不含后缀的安全文档名
 * @returns {boolean} 是否成功删除（不存在时返回 false）
 */
export const deleteKnowledgeDoc = (name: string): boolean => {
  const filePath = getDocPath(name);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
};

/**
 * 读取索引目录配置
 * @returns {KnowledgeConfig} 当前配置；文件缺失或损坏时返回默认配置
 */
export const readKnowledgeDirs = (): KnowledgeConfig => {
  const fallback: KnowledgeConfig = { dirs: [...DEFAULT_KNOWLEDGE_DIRS], updated_at: '' };
  if (!fs.existsSync(KNOWLEDGE_CONFIG_FILE)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(KNOWLEDGE_CONFIG_FILE, 'utf-8')) as Partial<KnowledgeConfig>;
    if (!Array.isArray(parsed.dirs) || parsed.dirs.length === 0) return fallback;
    const dirs = parsed.dirs.filter((d): d is string => typeof d === 'string' && Boolean(d.trim()));
    return dirs.length ? { dirs, updated_at: parsed.updated_at ?? '' } : fallback;
  } catch {
    return fallback;
  }
};

/**
 * 校验并规范化索引目录列表
 * @param {string[]} raw - 原始目录列表（相对项目根）
 * @returns {string[] | null} 规范化后的目录列表；非法时返回 null
 * @description 仅允许项目根内的相对路径，拒绝绝对路径与上级目录引用
 */
export const normalizeKnowledgeDirs = (raw: string[]): string[] | null => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const dir = item.trim().replace(/^\.\//, '').replace(/\/$/, '');
    if (!dir || dir.startsWith('/') || dir.includes('\\') || dir.includes('..') || dir.includes('\0')) return null;
    if (!out.includes(dir)) out.push(dir);
  }
  return out.length ? out : null;
};

/**
 * 写入索引目录配置
 * @param {string[]} dirs - 已规范化的目录列表
 * @returns {KnowledgeConfig} 写入后的配置
 */
export const writeKnowledgeDirs = (dirs: string[]): KnowledgeConfig => {
  const config: KnowledgeConfig = { dirs, updated_at: formatTimestamp(new Date()) };
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(KNOWLEDGE_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  return config;
};

/**
 * 获取文档内容字节数
 * @param {string} content - 文档正文
 * @returns {number} UTF-8 字节数
 */
export const getDocContentBytes = (content: string): number => Buffer.byteLength(content, 'utf-8');

/**
 * 获取配置的索引目录绝对路径列表
 * @returns {string[]} 绝对路径列表
 * @description 供 searchKnowledge 的索引构建使用；配置缺失时回退到默认目录
 */
export const resolveKnowledgeDirPaths = (): string[] => readKnowledgeDirs().dirs.map((d) => path.join(PROJECT_DIR, d));
