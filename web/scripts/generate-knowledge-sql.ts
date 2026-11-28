/**
 * 项目知识库文档入库脚本（docs/ + knowledge/ → hp_knowledge_docs）
 *
 * 设计约定：
 *   1. 默认只生成 sql/knowledge/38_knowledge_docs.sql，不改数据库；显式传 --apply 才写库；
 *   2. 运行时以数据库为真源，Markdown 文件是系统文档的写入真源与故障兜底；
 *      --apply 与初始化脚本都用幂等 UPSERT：系统文档按文件回灌，用户文档只在缺失时插入，
 *      不覆盖管理页 / 贾维斯在库里编辑过的正文；
 *   3. 正文按原文整篇保存（不切片），BM25 索引在运行时按标题切块；
 *   4. content_hash 保存正文 SHA-256，供启动时按文件内容增量同步系统文档；
 *   5. 文件扫描复用运行时模块，保证「入库范围」与「文件降级范围」永不漂移。
 *
 * 用法（在 web/ 目录下）：
 *   npm run knowledge:sql
 *   npm run knowledge:sql -- --apply
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { PROJECT_DIR } from '@/utils/paths';
import { getPool } from '@/utils/database/connection';
import { ensureKnowledgeDocSchema } from '@/utils/database/knowledge';
// 只依赖无数据库副作用的文件扫描模块，避免生成脚本拉起整套运行时依赖
import { scanKnowledgeFileDocs } from '@/utils/knowledge/files';
import {
  KNOWLEDGE_DOCS_COLUMNS,
  KNOWLEDGE_DOCS_DDL,
  KNOWLEDGE_DOCS_TABLE,
  KNOWLEDGE_DOCS_UPSERT,
  type KnowledgeDocSeed,
} from '@/types/knowledge';

dotenv.config({ path: path.join(PROJECT_DIR, 'web', '.env') });

/** 生成的建表脚本（编号紧随 37 号 AI 助手皮肤预设） */
const OUTPUT_SQL = path.join(PROJECT_DIR, 'sql/knowledge/38_knowledge_docs.sql');

/** 单条 INSERT 的最大正文字节数，避免语句过长 */
const INSERT_BATCH_BYTES = 64 * 1024;

/**
 * 按正文体积把记录切分为若干 INSERT 批次
 * @param {KnowledgeDocSeed[]} rows - 全量记录
 * @returns {KnowledgeDocSeed[][]} 分批结果
 */
const splitBatches = (rows: KnowledgeDocSeed[]): KnowledgeDocSeed[][] => {
  const batches: KnowledgeDocSeed[][] = [];
  let current: KnowledgeDocSeed[] = [];
  let bytes = 0;
  for (const row of rows) {
    if (current.length > 0 && bytes + row.size_bytes > INSERT_BATCH_BYTES) {
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
 * 生成建表 SQL 文件全文
 * @param {KnowledgeDocSeed[]} rows - 全量文档记录
 * @returns {string} 可直接由 mysql SOURCE 执行的 SQL 文本
 * @description 字面量统一走 mysql2 的 escape，保证引号、换行、反斜杠与 emoji 无损
 */
const buildSqlFile = (rows: KnowledgeDocSeed[]): string => {
  const lines = [
    '-- ============================================================',
    '-- 38. 项目知识库文档表 (hp_knowledge_docs)',
    '-- ============================================================',
    '-- 来源：docs/ 与 knowledge/ 下的 Markdown 全文（由生成脚本导出，勿手工编辑正文）',
    '-- 由 helper_database.sql 统一加载；也可单独执行本文件',
    '-- 重新生成：cd web && npm run knowledge:sql（改完文档务必重跑）',
    '-- 现有库增量同步：cd web && npm run knowledge:sql -- --apply',
    '-- 注意：本脚本不 DROP 表，系统文档按文件回灌、用户文档只补缺失，',
    '--       数据库里维护过的用户文档不会因初始化丢失。',
    '-- doc_path 由 source_dir + name 派生，不再单独入库；(source_dir, name) 为唯一键。',
    '-- ============================================================',
    'SET NAMES utf8mb4;',
    '',
    KNOWLEDGE_DOCS_DDL,
    '',
    '-- 兼容旧库：删除已派生的 doc_path 列并补上复合唯一键（可重复执行）',
    "SET @migrate_doc_path = (SELECT IF(COUNT(*) > 0, 'ALTER TABLE `hp_knowledge_docs` DROP INDEX `uk_doc_path`, DROP COLUMN `doc_path`, ADD UNIQUE KEY `uk_doc` (`source_dir`, `name`)', 'DO 0') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hp_knowledge_docs' AND COLUMN_NAME = 'doc_path');",
    'PREPARE stmt_migrate_doc_path FROM @migrate_doc_path;',
    'EXECUTE stmt_migrate_doc_path;',
    'DEALLOCATE PREPARE stmt_migrate_doc_path;',
    '',
  ];

  for (const batch of splitBatches(rows)) {
    lines.push(`INSERT INTO \`${KNOWLEDGE_DOCS_TABLE}\` ${KNOWLEDGE_DOCS_COLUMNS} VALUES`);
    batch.forEach((row, index) => {
      const tail = index === batch.length - 1 ? '' : ',';
      const values = [
        mysql.escape(row.name),
        mysql.escape(row.source_dir),
        String(row.is_system),
        mysql.escape(row.content),
        mysql.escape(row.content_hash),
        String(row.size_bytes),
        mysql.escape(row.file_mtime),
      ].join(', ');
      lines.push(`  (${values})${tail}`);
    });
    lines.push(`  ${KNOWLEDGE_DOCS_UPSERT};`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
};

/**
 * 把文档记录同步到现有数据库
 * @param {KnowledgeDocSeed[]} rows - 全量文档记录
 * @returns {Promise<void>} 无返回值
 * @description 先确保表结构就绪（含旧库派生列迁移），再在事务内分批参数化 UPSERT；
 *   SQL 语义与种子文件完全一致，复用同一份 DDL / 列清单 / UPSERT 后缀
 */
const applyToDatabase = async (rows: KnowledgeDocSeed[]): Promise<void> => {
  await ensureKnowledgeDocSchema();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    try {
      for (const batch of splitBatches(rows)) {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = batch.flatMap((row) => [
          row.name,
          row.source_dir,
          row.is_system,
          row.content,
          row.content_hash,
          row.size_bytes,
          row.file_mtime,
        ]);
        await conn.query(
          `INSERT INTO \`${KNOWLEDGE_DOCS_TABLE}\` ${KNOWLEDGE_DOCS_COLUMNS} VALUES ${placeholders} ${KNOWLEDGE_DOCS_UPSERT}`,
          params,
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
    await pool.end();
  }
};

/**
 * 脚本入口
 * @returns {Promise<void>} 无返回值
 * @description 默认 dry-run 只生成 SQL 文件；传 --apply 时额外同步现有数据库
 */
const main = async (): Promise<void> => {
  const rows = scanKnowledgeFileDocs();
  fs.mkdirSync(path.dirname(OUTPUT_SQL), { recursive: true });
  fs.writeFileSync(OUTPUT_SQL, buildSqlFile(rows), 'utf8');

  const system = rows.filter((row) => row.is_system === 1).length;
  const user = rows.length - system;
  const sqlBytes = fs.statSync(OUTPUT_SQL).size;
  console.log(`[knowledge] 系统文档 ${system} 篇 / 用户文档 ${user} 篇 / 合计 ${rows.length} 篇`);
  console.log(`[knowledge] 已生成 sql/knowledge/38_knowledge_docs.sql（${(sqlBytes / 1024).toFixed(1)} KB）`);

  if (process.argv.includes('--apply')) {
    await applyToDatabase(rows);
    console.log('[knowledge] 已同步到数据库 hp_knowledge_docs');
  } else {
    console.log('[knowledge] dry-run：如需写入现有数据库，执行 npm run knowledge:sql -- --apply');
  }
};

main().catch((err: unknown) => {
  console.error('[knowledge] 生成失败：', err);
  process.exitCode = 1;
});
