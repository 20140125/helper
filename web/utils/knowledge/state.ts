// ==============================
// 知识库运行时状态（数据库快照 + 文件降级）
// @description 启动时把文件同步进库并加载内存快照；库不可用时所有读操作回退到文件
// ==============================
import {
  KNOWLEDGE_USER_DIR,
  type KnowledgeDoc,
  type KnowledgeDocEntry,
  type KnowledgeDocRecord,
} from '@/types/knowledge';
import {
  ensureKnowledgeDocSchema,
  listKnowledgeDocRows,
  upsertKnowledgeDocRows,
} from '@/utils/database';
import { readKnowledgeDirs } from './dirs';
import {
  listKnowledgeDocsFromFiles,
  readDocByPathFromFile,
  readKnowledgeDocFile,
  scanKnowledgeFileDocs,
} from './files';

/** 从数据库加载的知识文档快照；null 表示当前处于文件降级模式 */
let snapshot: KnowledgeDocRecord[] | null = null;

/**
 * 判断文档路径是否落在指定索引目录内
 * @param {string} docPath - 相对项目根的文档路径
 * @param {string[]} dirs - 索引目录列表
 * @returns {boolean} 在目录内返回 true
 */
const isUnderDirs = (docPath: string, dirs: string[]): boolean =>
  dirs.some((dir) => docPath === dir || docPath.startsWith(`${dir}/`));

/**
 * 规范化文档相对路径，拒绝越界与非 Markdown 路径
 * @param {string} raw - 原始路径
 * @returns {string | null} 合法时返回相对路径
 */
const normalizeRelativePath = (raw: string): string | null => {
  const value = (raw ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!value || value.startsWith('/') || value.includes('..') || value.includes('\0')) return null;
  if (!value.toLowerCase().endsWith('.md')) return null;
  return value;
};

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
 * 初始化知识库：建表 → 按文件增量同步 → 加载数据库快照
 * @returns {Promise<number>} 载入的文档数；数据库不可用时返回 0 并保持文件降级
 * @description 系统文档按 content_hash 差异回灌，用户文档只在库中缺失时补种，
 *   不会覆盖管理页 / 贾维斯编辑过的用户文档正文
 */
export const initKnowledgeDocs = async (): Promise<number> => {
  try {
    await ensureKnowledgeDocSchema();
    const existing = await listKnowledgeDocRows();
    const existingByPath = new Map(existing.map((row) => [row.doc_path, row]));
    const files = scanKnowledgeFileDocs((await readKnowledgeDirs()).dirs);
    const stale = files.filter((seed) => {
      const current = existingByPath.get(seed.doc_path);
      if (!current) return true;
      return seed.is_system === 1 && current.content_hash !== seed.content_hash;
    });
    if (stale.length > 0) await upsertKnowledgeDocRows(stale);
    snapshot = stale.length > 0 ? await listKnowledgeDocRows() : existing;
    return snapshot.length;
  } catch {
    snapshot = null;
    return 0;
  }
};

/**
 * 刷新知识库快照（重建索引前调用）
 * @returns {Promise<number>} 载入的文档数
 * @description 兼顾外部直接改库与数据库从故障中恢复的场景
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
  if (snapshot) {
    return snapshot
      .filter((row) => isUnderDirs(row.doc_path, scope))
      .map((row) => ({ path: row.doc_path, content: row.content }));
  }
  return scanKnowledgeFileDocs(scope).map((seed) => ({ path: seed.doc_path, content: seed.content }));
};

/**
 * 列出知识文档
 * @returns {Promise<KnowledgeDoc[]>} 用户文档在前、系统文档在后，各自按路径排序
 * @description 库可用时按快照生成；库不可用时降级扫描文件
 */
export const listKnowledgeDocs = async (): Promise<KnowledgeDoc[]> => {
  if (!snapshot) return await listKnowledgeDocsFromFiles();
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
 * @description 库快照优先，文件是否存在不再影响已入库文档的读取
 */
export const readDocByPath = async (relativePath: string): Promise<string | null> => {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || !isUnderDirs(normalized, (await readKnowledgeDirs()).dirs)) return null;
  if (snapshot) return snapshot.find((row) => row.doc_path === normalized)?.content ?? null;
  return await readDocByPathFromFile(normalized);
};

/**
 * 读取用户文档正文
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string | null} 文档内容；不存在时返回 null
 */
export const readKnowledgeDoc = (name: string): string | null => {
  const docPath = `${KNOWLEDGE_USER_DIR}/${name}.md`;
  if (snapshot) return snapshot.find((row) => row.doc_path === docPath)?.content ?? null;
  return readKnowledgeDocFile(name);
};

/**
 * 写操作后立即更新内存快照
 * @param {KnowledgeDocRecord} row - 已写入数据库的记录
 * @returns {void}
 */
export const setSnapshotRow = (row: KnowledgeDocRecord): void => {
  if (!snapshot) return;
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
  if (!snapshot) return;
  snapshot = snapshot.filter((row) => row.doc_path !== docPath);
};
