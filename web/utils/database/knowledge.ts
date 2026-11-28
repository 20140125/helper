// ==============================
// 项目知识库文档读写（hp_knowledge_docs）
// @description 数据库是知识库真源；系统文档由文件按 hash 回灌，用户文档由管理页 / 贾维斯写库
// ==============================
import type { RowDataPacket } from 'mysql2';
import { getPool } from './connection';
import {
  KNOWLEDGE_DOCS_COLUMNS,
  KNOWLEDGE_DOCS_DDL,
  KNOWLEDGE_DOCS_TABLE,
  KNOWLEDGE_DOCS_UPSERT,
  type KnowledgeDocRecord,
  type KnowledgeDocSeed,
} from '@/types/knowledge';

/** hp_knowledge_docs 查询结果行（时间列由 DATE_FORMAT 转为文本） */
interface KnowledgeDocDbRow extends RowDataPacket {
  /** 相对项目根的文档路径 */
  doc_path: string;
  /** 文件名（含 .md） */
  name: string;
  /** 所属索引目录 */
  source_dir: string;
  /** 1=系统文档 / 0=用户文档 */
  is_system: number;
  /** Markdown 全文 */
  content: string;
  /** 正文 SHA-256 */
  content_hash: string;
  /** 正文 UTF-8 字节数 */
  size_bytes: number;
  /** 源文件修改时间 */
  file_mtime: string | null;
  /** 数据库更新时间 */
  updated_at: string;
}

/** 单批 UPSERT 的正文字节上限，避免长文档撑爆单条语句 */
const BATCH_BYTES = 64 * 1024;

/** 单条记录的占位符（doc_path 由 source_dir + name 派生，不入库） */
const ROW_PLACEHOLDER = '(?, ?, ?, ?, ?, ?, ?)';

/**
 * 把记录转换为参数数组
 * @param {KnowledgeDocSeed | KnowledgeDocRecord} row - 文档记录
 * @returns {Array<string | number | null>} 参数化查询的值
 */
const toParams = (row: KnowledgeDocSeed | KnowledgeDocRecord): Array<string | number | null> => [
  row.name,
  row.source_dir,
  row.is_system,
  row.content,
  row.content_hash,
  row.size_bytes,
  row.file_mtime,
];

/**
 * 按正文体积切分 UPSERT 批次
 * @param {KnowledgeDocSeed[]} rows - 待写入记录
 * @returns {KnowledgeDocSeed[][]} 分批结果
 */
const splitBatches = (rows: KnowledgeDocSeed[]): KnowledgeDocSeed[][] => {
  const batches: KnowledgeDocSeed[][] = [];
  let current: KnowledgeDocSeed[] = [];
  let bytes = 0;
  for (const row of rows) {
    if (current.length > 0 && bytes + row.size_bytes > BATCH_BYTES) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += row.size_bytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
};

/**
 * 确保知识文档表结构就绪
 * @returns {Promise<void>} 无返回值
 * @description 与 38 号建表脚本共用 DDL；旧库若仍保留派生列 doc_path 则就地迁移（可重复执行）
 */
export const ensureKnowledgeDocSchema = async (): Promise<void> => {
  const pool = getPool();
  await pool.query(KNOWLEDGE_DOCS_DDL);
  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'doc_path'`,
    [KNOWLEDGE_DOCS_TABLE],
  );
  if (columns.length === 0) return;
  await pool.query(
    `ALTER TABLE \`${KNOWLEDGE_DOCS_TABLE}\`
       DROP INDEX \`uk_doc_path\`,
       DROP COLUMN \`doc_path\`,
       ADD UNIQUE KEY \`uk_doc\` (\`source_dir\`, \`name\`)`,
  );
};

/**
 * 读取全部知识文档
 * @returns {Promise<KnowledgeDocRecord[]>} 按路径排序的数据库记录
 * @description 直接查连接池，不走 executeSql 的预览行数上限；doc_path 由目录名与文件名派生
 */
export const listKnowledgeDocRows = async (): Promise<KnowledgeDocRecord[]> => {
  const [rows] = await getPool().query<KnowledgeDocDbRow[]>(
    `SELECT CONCAT(\`source_dir\`, '/', \`name\`) AS \`doc_path\`,
            \`name\`, \`source_dir\`, \`is_system\`, \`content\`,
            \`content_hash\`, \`size_bytes\`,
            DATE_FORMAT(\`file_mtime\`, '%Y-%m-%d %H:%i:%s') AS \`file_mtime\`,
            DATE_FORMAT(\`updated_at\`, '%Y-%m-%d %H:%i:%s') AS \`updated_at\`
     FROM \`${KNOWLEDGE_DOCS_TABLE}\` ORDER BY \`source_dir\`, \`name\``,
  );
  return rows.map((row) => ({
    doc_path: String(row.doc_path),
    name: String(row.name),
    source_dir: String(row.source_dir),
    is_system: Number(row.is_system),
    content: String(row.content ?? ''),
    content_hash: String(row.content_hash ?? ''),
    size_bytes: Number(row.size_bytes ?? 0),
    file_mtime: row.file_mtime === null ? null : String(row.file_mtime),
    updated_at: String(row.updated_at ?? ''),
  }));
};

/**
 * 按文件批量同步文档
 * @param {KnowledgeDocSeed[]} rows - 需要回灌 / 补种的记录
 * @returns {Promise<number>} 实际提交的记录数
 * @description 复用种子 SQL 的幂等 UPSERT：系统文档按文件覆盖，用户文档仅补缺失、不覆盖库内编辑
 */
export const upsertKnowledgeDocRows = async (rows: KnowledgeDocSeed[]): Promise<number> => {
  const pool = getPool();
  for (const batch of splitBatches(rows)) {
    const placeholders = batch.map(() => ROW_PLACEHOLDER).join(', ');
    await pool.query(
      `INSERT INTO \`${KNOWLEDGE_DOCS_TABLE}\` ${KNOWLEDGE_DOCS_COLUMNS} VALUES ${placeholders} ${KNOWLEDGE_DOCS_UPSERT}`,
      batch.flatMap(toParams),
    );
  }
  return rows.length;
};

/**
 * 保存用户文档（写操作专用，强制覆盖正文）
 * @param {KnowledgeDocRecord} row - 用户文档记录
 * @returns {Promise<void>} 无返回值
 * @description 与文件同步不同：管理页 / 贾维斯的编辑必须覆盖库中已有正文
 */
export const saveUserKnowledgeDoc = async (row: KnowledgeDocRecord): Promise<void> => {
  await getPool().query(
    `INSERT INTO \`${KNOWLEDGE_DOCS_TABLE}\` ${KNOWLEDGE_DOCS_COLUMNS} VALUES ${ROW_PLACEHOLDER}
     ON DUPLICATE KEY UPDATE
       \`name\` = VALUES(\`name\`), \`source_dir\` = VALUES(\`source_dir\`),
       \`is_system\` = VALUES(\`is_system\`), \`content\` = VALUES(\`content\`),
       \`content_hash\` = VALUES(\`content_hash\`), \`size_bytes\` = VALUES(\`size_bytes\`),
       \`file_mtime\` = VALUES(\`file_mtime\`)`,
    toParams(row),
  );
};

/**
 * 删除知识文档
 * @param {string} docPath - 相对项目根的文档路径
 * @returns {Promise<void>} 无返回值
 */
export const deleteKnowledgeDocRow = async (docPath: string): Promise<void> => {
  await getPool().query(
    `DELETE FROM \`${KNOWLEDGE_DOCS_TABLE}\` WHERE CONCAT(\`source_dir\`, '/', \`name\`) = ?`,
    [docPath],
  );
};
