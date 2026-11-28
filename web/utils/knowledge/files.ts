import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';
import {
  DEFAULT_KNOWLEDGE_DIRS,
  KNOWLEDGE_USER_DIR,
  KNOWLEDGE_USER_DIR_ABS,
  type KnowledgeDoc,
  type KnowledgeDocSeed,
} from '@/types/knowledge';
import { readKnowledgeDirs, resolveKnowledgeDirPaths } from './dirs';
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
 * 获取用户文档绝对路径
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string} 绝对路径
 */
const getDocPath = (name: string): string => path.join(KNOWLEDGE_USER_DIR_ABS, `${name}.md`);

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
 * @description 入库范围与文件降级共用同一份扫描逻辑；只收录一级目录下的文件，
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
 * 从文件列出知识文档（数据库不可用时的降级路径）
 * @returns {Promise<KnowledgeDoc[]>} 文档元信息列表，用户文档在前、系统文档在后
 */
export const listKnowledgeDocsFromFiles = async (): Promise<KnowledgeDoc[]> =>
  scanKnowledgeFileDocs((await readKnowledgeDirs()).dirs)
    .map((seed) => ({
      name: seed.name,
      path: seed.doc_path,
      source_dir: seed.source_dir,
      readonly: seed.is_system === 1,
      size: seed.size_bytes,
      updated_at: seed.file_mtime,
    } satisfies KnowledgeDoc))
    .sort((a, b) => {
      if (a.readonly !== b.readonly) return a.readonly ? 1 : -1;
      return a.path.localeCompare(b.path);
    });

/**
 * 解析文档相对路径为绝对路径（仅限已配置索引目录内的 .md 文件）
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {Promise<string | null>} 绝对路径；越界、非 Markdown 或不存在时返回 null
 * @description 防止路径穿越，确保只能访问知识库索引范围内的文件
 */
export const resolveDocPath = async (relativePath: string): Promise<string | null> => {
  const normalized = (relativePath ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!normalized || path.isAbsolute(normalized) || normalized.includes('..') || normalized.includes('\0')) return null;
  if (!normalized.toLowerCase().endsWith('.md')) return null;

  const abs = path.resolve(PROJECT_DIR, normalized);
  const allowed = (await resolveKnowledgeDirPaths()).some((dir) => abs === dir || abs.startsWith(`${dir}${path.sep}`));
  if (!allowed) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
};

/**
 * 从文件读取文档正文（数据库降级路径）
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {Promise<string | null>} 文档内容；路径非法或不存在时返回 null
 */
export const readDocByPathFromFile = async (relativePath: string): Promise<string | null> => {
  const abs = await resolveDocPath(relativePath);
  return abs ? fs.readFileSync(abs, 'utf-8') : null;
};

/**
 * 从文件读取用户文档正文
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string | null} 文档内容；不存在时返回 null
 */
export const readKnowledgeDocFile = (name: string): string | null => {
  const filePath = getDocPath(name);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
};

/**
 * 写入用户文档文件镜像
 * @param {string} name - 不含后缀的安全文档名
 * @param {string} content - Markdown 正文
 * @returns {void}
 * @description 数据库为真源，文件镜像保留供人工查看与数据库故障降级
 */
export const writeKnowledgeDocFile = (name: string, content: string): void => {
  if (!fs.existsSync(KNOWLEDGE_USER_DIR_ABS)) fs.mkdirSync(KNOWLEDGE_USER_DIR_ABS, { recursive: true });
  fs.writeFileSync(getDocPath(name), content, 'utf-8');
};

/**
 * 删除用户文档文件镜像
 * @param {string} name - 不含后缀的安全文档名
 * @returns {boolean} 文件是否存在并已删除
 */
export const deleteKnowledgeDocFile = (name: string): boolean => {
  const filePath = getDocPath(name);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
};

/**
 * 获取文档内容字节数
 * @param {string} content - 文档正文
 * @returns {number} UTF-8 字节数
 */
export const getDocContentBytes = (content: string): number => Buffer.byteLength(content, 'utf-8');
