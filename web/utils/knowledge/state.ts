// ==============================
// 知识库运行时状态（数据库快照）
// @description 启动时从 hp_knowledge_docs 全量加载内存快照；数据库异常直接向上返回
// ==============================
import {
  KNOWLEDGE_USER_DIR,
  type KnowledgeDoc,
  type KnowledgeDocEntry,
  type KnowledgeDocRecord,
} from '@/types/knowledge';
import { ensureKnowledgeDocSchema, listKnowledgeDocRows } from '@/utils/database';
import { readKnowledgeDirs } from './dirs';
import { normalizeKnowledgeDocPath } from './files';

/** 从数据库加载的知识文档快照 */
let snapshot: KnowledgeDocRecord[] = [];

/**
 * 判断文档路径是否落在指定索引目录内
 * @param {string} docPath - 相对项目根的文档路径
 * @param {string[]} dirs - 索引目录列表
 * @returns {boolean} 在目录内返回 true
 */
const isUnderDirs = (docPath: string, dirs: string[]): boolean =>
  dirs.some((dir) => docPath === dir || docPath.startsWith(`${dir}/`));

/**
 * 把数据库记录转换为管理页展示的文档元信息
 * @param {KnowledgeDocRecord} row - 数据库记录
 * @returns {KnowledgeDoc} 文档元信息
 */
const toKnowledgeDoc = (row: KnowledgeDocRecord): KnowledgeDoc => ({
  name: row.name,
  path: row.doc_path,
  source_dir: row.source_dir,
  readonly: row.is_system === 1,
  size: row.size_bytes,
  updated_at: row.updated_at,
});

/**
 * 初始化知识库：建表 → 加载数据库快照
 * @returns {Promise<number>} 载入的文档数；数据库不可用时错误直接向上抛出
 * @description 文档真源是 hp_knowledge_docs，项目根不再保留 Markdown 镜像，
 *   因此不再扫描文件回灌；全新库由 sql/knowledge/38_knowledge_docs.sql 导入种子
 */
export const initKnowledgeDocs = async (): Promise<number> => {
  await ensureKnowledgeDocSchema();
  snapshot = await listKnowledgeDocRows();
  return snapshot.length;
};

/**
 * 刷新知识库快照（重建索引前调用）
 * @returns {Promise<number>} 载入的文档数
 * @description 兼顾外部直接改库与数据库恢复后的快照刷新
 */
export const refreshKnowledgeDocs = async (): Promise<number> => initKnowledgeDocs();

/**
 * 获取参与 BM25 索引的文档条目
 * @param {string[]} dirs - 调用方解析出的索引目录；缺省用管理页配置
 * @returns {Promise<KnowledgeDocEntry[]>} 文档路径与全文
 * @description 由调用方传入最终目录（兼容环境变量 KNOWLEDGE_DIRS 覆盖），此处按该目录过滤
 */
export const getKnowledgeDocEntries = async (dirs?: string[]): Promise<KnowledgeDocEntry[]> => {
  const scope = dirs ?? (await readKnowledgeDirs()).dirs;
  return snapshot
    .filter((row) => isUnderDirs(row.doc_path, scope))
    .map((row) => ({ path: row.doc_path, content: row.content }));
};

/**
 * 列出知识文档
 * @returns {Promise<KnowledgeDoc[]>} 用户文档在前、系统文档在后，各自按路径排序
 * @description 数据全部来自数据库快照
 */
export const listKnowledgeDocs = async (): Promise<KnowledgeDoc[]> => {
  const dirs = (await readKnowledgeDirs()).dirs;
  return snapshot
    .filter((row) => isUnderDirs(row.doc_path, dirs))
    .map(toKnowledgeDoc)
    .sort((a, b) => {
      if (a.readonly !== b.readonly) return a.readonly ? 1 : -1;
      return a.path.localeCompare(b.path);
    });
};

/**
 * 按相对路径读取文档正文
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {Promise<string | null>} 文档内容；路径非法或不存在时返回 null
 * @description 只查数据库快照，文件是否存在不再影响读取结果
 */
export const readDocByPath = async (relativePath: string): Promise<string | null> => {
  const normalized = await normalizeKnowledgeDocPath(relativePath);
  if (!normalized) return null;
  return snapshot.find((row) => row.doc_path === normalized)?.content ?? null;
};

/**
 * 读取用户文档正文
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string | null} 文档内容；不存在时返回 null
 */
export const readKnowledgeDoc = (name: string): string | null => {
  const docPath = `${KNOWLEDGE_USER_DIR}/${name}.md`;
  return snapshot.find((row) => row.doc_path === docPath)?.content ?? null;
};

/**
 * 写操作后立即更新内存快照
 * @param {KnowledgeDocRecord} row - 已写入数据库的记录
 * @returns {void}
 */
export const setSnapshotRow = (row: KnowledgeDocRecord): void => {
  const index = snapshot.findIndex((item) => item.doc_path === row.doc_path);
  if (index >= 0) snapshot[index] = row;
  else snapshot.push(row);
};

/**
 * 删除操作后立即更新内存快照
 * @param {string} docPath - 相对项目根的文档路径
 * @returns {void}
 */
export const removeSnapshotRow = (docPath: string): void => {
  snapshot = snapshot.filter((row) => row.doc_path !== docPath);
};
