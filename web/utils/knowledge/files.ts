import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';
import {
  DEFAULT_KNOWLEDGE_DIRS,
  KNOWLEDGE_USER_DIR,
  type KnowledgeDocSeed,
} from '@/types/knowledge';
import { readKnowledgeDirs } from './dirs';
import { formatTimestamp } from './time';

/** 文档名合法格式：中文、字母、数字、下划线、横线，可带 .md 后缀 */
const DOC_NAME_PATTERN = /^[\w\u4e00-\u9fa5-]+(\.md)?$/i;

/** 文档名最大长度 */
const MAX_DOC_NAME_LENGTH = 80;

/** 索引目录保持扁平：doc_path 由 source_dir + '/' + name 派生，不再单独入库 */

/**
 * 校验并规范化文档名
 * @param {string} raw - 原始文档名
 * @returns {string | null} 不含 .md 后缀的安全文件名；非法时返回 null
 * @description 拒绝路径分隔符、上级目录引用与控制字符
 */
export const normalizeDocName = (raw: string): string | null => {
  const name = (raw ?? '').trim();
  if (!name || name.length > MAX_DOC_NAME_LENGTH) return null;
  if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) return null;
  if (!DOC_NAME_PATTERN.test(name)) return null;
  return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name;
};

/**
 * 判断文档相对路径是否属于用户维护目录
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {boolean} 位于 knowledge/ 目录时返回 true
 */
export const isUserDocPath = (relativePath: string): boolean =>
  relativePath.replace(/\\/g, '/').startsWith(`${KNOWLEDGE_USER_DIR}/`);

/**
 * 扫描索引目录下的一级 Markdown 文档
 * @param {string[]} dirs - 相对项目根的索引目录列表
 * @returns {KnowledgeDocSeed[]} 按路径排序的待入库记录
 * @description 供系统文档增量回灌与种子 SQL 生成使用；只收录一级目录下的文件，
 *   保证 doc_path 始终可由 source_dir + '/' + name 还原
 */
export const scanKnowledgeFileDocs = (dirs: string[] = DEFAULT_KNOWLEDGE_DIRS): KnowledgeDocSeed[] => {
  const rows: KnowledgeDocSeed[] = [];
  const seen = new Set<string>();

  const walk = (root: string, sourceDir: string): void => {
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const abs = path.join(root, item.name);
      if (!item.isFile() || !item.name.toLowerCase().endsWith('.md')) continue;

      const docPath = `${sourceDir}/${item.name}`;
      if (seen.has(docPath)) continue;
      seen.add(docPath);
      const content = fs.readFileSync(abs, 'utf-8');
      rows.push({
        doc_path: docPath,
        name: item.name,
        source_dir: sourceDir,
        is_system: docPath.startsWith(`${KNOWLEDGE_USER_DIR}/`) ? 0 : 1,
        content,
        content_hash: crypto.createHash('sha256').update(content, 'utf-8').digest('hex'),
        size_bytes: Buffer.byteLength(content, 'utf-8'),
        file_mtime: formatTimestamp(fs.statSync(abs).mtime),
      });
    }
  };

  for (const sourceDir of dirs) {
    const root = path.join(PROJECT_DIR, sourceDir);
    if (fs.existsSync(root)) walk(root, sourceDir);
  }
  return rows.sort((a, b) => a.doc_path.localeCompare(b.doc_path));
};

/**
 * 校验并规范化知识文档相对路径
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {Promise<string | null>} 规范化后的相对路径；越界、非 Markdown 或不在索引目录内时返回 null
 * @description 正文统一从数据库快照读取，此处只做路径白名单校验，不访问文件系统
 */
export const normalizeKnowledgeDocPath = async (relativePath: string): Promise<string | null> => {
  const normalized = (relativePath ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!normalized || path.isAbsolute(normalized) || normalized.includes('..') || normalized.includes('\0')) return null;
  if (!normalized.toLowerCase().endsWith('.md')) return null;

  const dirs = (await readKnowledgeDirs()).dirs;
  if (!dirs.some((dir) => normalized === dir || normalized.startsWith(`${dir}/`))) return null;
  return normalized;
};

/**
 * 获取文档内容字节数
 * @param {string} content - 文档正文
 * @returns {number} UTF-8 字节数
 */
export const getDocContentBytes = (content: string): number => Buffer.byteLength(content, 'utf-8');
