// ==============================
// 知识库写操作（新建 / 编辑 / 删除 / 导入）
// @description 库为唯一真源：写入成功后更新内存快照；数据库异常直接向上返回
// ==============================
import crypto from 'crypto';
import path from 'path';
import {
  KNOWLEDGE_USER_DIR,
  type KnowledgeDoc,
  type KnowledgeDocRecord,
} from '@/types/knowledge';
import { deleteKnowledgeDocRow, saveUserKnowledgeDoc } from '@/utils/database';
import { formatTimestamp } from './time';
import {
  isUserDocPath,
  normalizeDocName,
  normalizeKnowledgeDocPath,
} from './files';
import {
  listKnowledgeDocs,
  readDocByPath,
  readKnowledgeDoc,
  removeSnapshotRow,
  setSnapshotRow,
} from './state';

/**
 * 构造用户文档数据库记录
 * @param {string} name - 不含后缀的安全文档名
 * @param {string} content - Markdown 正文
 * @returns {KnowledgeDocRecord} 待写入记录
 */
const buildUserRow = (name: string, content: string): KnowledgeDocRecord => {
  const now = formatTimestamp(new Date());
  return {
    doc_path: `${KNOWLEDGE_USER_DIR}/${name}.md`,
    name: `${name}.md`,
    source_dir: KNOWLEDGE_USER_DIR,
    is_system: 0,
    content,
    content_hash: crypto.createHash('sha256').update(content, 'utf-8').digest('hex'),
    size_bytes: Buffer.byteLength(content, 'utf-8'),
    file_mtime: now,
    updated_at: now,
  };
};

/**
 * 写入用户文档（新建或覆盖）
 * @param {string} name - 不含后缀的安全文档名
 * @param {string} content - Markdown 正文
 * @returns {Promise<void>} 无返回值
 * @description 先写库再更新内存快照，写库失败不会改动快照
 */
export const writeKnowledgeDoc = async (name: string, content: string): Promise<void> => {
  const row = buildUserRow(name, content);
  await saveUserKnowledgeDoc(row);
  setSnapshotRow(row);
};

/**
 * 删除用户文档
 * @param {string} name - 不含后缀的安全文档名
 * @returns {Promise<boolean>} 文档存在并已删除时返回 true
 */
export const deleteKnowledgeDoc = async (name: string): Promise<boolean> => {
  const docPath = `${KNOWLEDGE_USER_DIR}/${name}.md`;
  if (readKnowledgeDoc(name) === null) return false;
  await deleteKnowledgeDocRow(docPath);
  removeSnapshotRow(docPath);
  return true;
};

/**
 * 导入系统文档为用户文档副本
 * @param {string} relativePath - 系统文档的相对路径
 * @returns {Promise<KnowledgeDoc | null>} 导入后的用户文档元信息；失败时返回 null
 * @description 正文来自数据库快照；目标同名时拒绝覆盖，原系统文档保持不变
 */
export const importSystemDoc = async (relativePath: string): Promise<KnowledgeDoc | null> => {
  const normalized = await normalizeKnowledgeDocPath(relativePath);
  if (!normalized || isUserDocPath(normalized)) return null;

  const rawName = path.basename(normalized, path.extname(normalized));
  const safeName = normalizeDocName(rawName.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, ''));
  if (!safeName || readKnowledgeDoc(safeName) !== null) return null;

  const content = await readDocByPath(normalized);
  if (content === null) return null;
  await writeKnowledgeDoc(safeName, content);
  return (await listKnowledgeDocs()).find((doc) => doc.path === `${KNOWLEDGE_USER_DIR}/${safeName}.md`) ?? null;
};
