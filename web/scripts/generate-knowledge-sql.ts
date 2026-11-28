/**
 * 项目知识库种子 SQL 导出脚本（hp_knowledge_docs → sql/knowledge/38_knowledge_docs.sql）
 *
 * 设计约定：
 *   1. 文档真源是数据库 hp_knowledge_docs；项目根不再保留 docs/ 与 knowledge/ Markdown 镜像；
 *   2. 从数据库全量导出种子 SQL，一个文档一条 INSERT，不回写数据库；
 *   3. 库中无文档时拒绝覆盖种子，避免把全库初始化数据清空；
 *   4. UPSERT 语义与运行时一致：系统文档按种子覆盖，用户文档只补缺失，
 *      不覆盖管理页 / 贾维斯在库里编辑过的正文；
 *   5. 正文保留可读的 Markdown 原文（真实换行），文件头固定 utf8mb4 与会话 sql_mode，
 *      保证 emoji / 反斜杠 / 引号在不同执行环境下都不会报错或改写正文。
 *
 * 用法（在 web/ 目录下）：
 *   npm run knowledge:sql
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { PROJECT_DIR } from '@/utils/paths';
import { getPool } from '@/utils/database/connection';
import { ensureKnowledgeDocSchema, listKnowledgeDocRows } from '@/utils/database/knowledge';
import {
  KNOWLEDGE_DOCS_COLUMNS,
  KNOWLEDGE_DOCS_DDL,
  KNOWLEDGE_DOCS_TABLE,
  KNOWLEDGE_DOCS_UPSERT,
  type KnowledgeDocRecord,
} from '@/types/knowledge';

dotenv.config({ path: path.join(PROJECT_DIR, 'web', '.env') });

/** 生成的种子脚本（编号紧随 37 号 AI 助手皮肤预设） */
const OUTPUT_SQL = path.join(PROJECT_DIR, 'sql/knowledge/38_knowledge_docs.sql');

/**
 * 把正文转成可读的 SQL 字符串内容（不含外层引号）
 * @param {string} value - 文档正文
 * @returns {string} 可直接放进单引号字符串的内容
 * @description 保留真实换行让 Markdown 排版可读；单引号按标准 SQL 双写、反斜杠双写，
 *   不转义双引号以避免 \" 噪声；NUL / Ctrl-Z 用 MySQL 转义序列表达
 */
const escapeContent = (value: string): string => value
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "''")
  .replace(/\x00/g, '\\0')
  .replace(/\x1a/g, '\\Z');

/**
 * 生成种子 SQL 文件全文
 * @param {KnowledgeDocRecord[]} rows - 数据库全量文档记录
 * @returns {string} 可直接由 mysql SOURCE 执行的 SQL 文本
 * @description 一个文档一条 INSERT，DDL / 列清单 / UPSERT 后缀与运行时共用同一份常量
 */
const buildSqlFile = (rows: KnowledgeDocRecord[]): string => {
  const lines = [
    '-- ============================================================',
    '-- 38. 项目知识库文档表 (hp_knowledge_docs)',
    '-- ============================================================',
    '-- 来源：hp_knowledge_docs 数据库全文；一个文档一条 INSERT，正文可直接阅读',
    '-- 由 helper_database.sql 统一加载；也可单独执行本文件',
    '-- 重新生成：cd web && npm run knowledge:sql（从数据库导出，不再依赖 docs/ 与 knowledge/ 目录）',
    '-- 正文保留 Markdown 原文（真实换行 + 标准 SQL 引号双写）；文件头固定 utf8mb4 与',
    '--       会话 sql_mode，避免 emoji / 反斜杠 / 引号在不同执行环境下报错或改写正文',
    '-- 注意：本脚本不 DROP 表，系统文档按种子覆盖、用户文档只补缺失，',
    '--       数据库里维护过的用户文档不会因初始化丢失。',
    '-- doc_path 由 source_dir + name 派生，不再单独入库；(source_dir, name) 为唯一键。',
    '-- ============================================================',
    'SET NAMES utf8mb4;',
    '-- 清空会话 sql_mode，确保反斜杠按 MySQL 默认语义解析（去掉 NO_BACKSLASH_ESCAPES）',
    'SET @old_sql_mode = @@SESSION.sql_mode;',
    "SET SESSION sql_mode = '';",
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

  for (const row of rows) {
    const values = [
      mysql.escape(row.name),
      mysql.escape(row.source_dir),
      String(row.is_system),
      `'${escapeContent(row.content)}'`,
      mysql.escape(row.content_hash),
      String(row.size_bytes),
      mysql.escape(row.file_mtime),
    ].join(', ');
    lines.push(`-- ${row.name}`);
    lines.push(`INSERT INTO \`${KNOWLEDGE_DOCS_TABLE}\` ${KNOWLEDGE_DOCS_COLUMNS} VALUES`);
    lines.push(`  (${values})`);
    lines.push(`  ${KNOWLEDGE_DOCS_UPSERT};`);
    lines.push('');
  }
  lines.push('SET SESSION sql_mode = @old_sql_mode;');
  return `${lines.join('\n').trimEnd()}\n`;
};

/**
 * 脚本入口
 * @returns {Promise<void>} 无返回值
 * @description 只从数据库导出种子；--apply 已废弃（真源即数据库，无需回灌）
 */
const main = async (): Promise<void> => {
  if (process.argv.includes('--apply')) {
    console.warn('[knowledge] --apply 已废弃：文档真源是数据库，导出无需回灌，已忽略该参数');
  }
  await ensureKnowledgeDocSchema();
  const rows = await listKnowledgeDocRows();
  if (rows.length === 0) {
    throw new Error('hp_knowledge_docs 中没有文档，拒绝覆盖种子 SQL（请先恢复数据库）');
  }
  fs.mkdirSync(path.dirname(OUTPUT_SQL), { recursive: true });
  fs.writeFileSync(OUTPUT_SQL, buildSqlFile(rows), 'utf8');

  const system = rows.filter((row) => row.is_system === 1).length;
  const sqlBytes = fs.statSync(OUTPUT_SQL).size;
  console.log(`[knowledge] 系统文档 ${system} 篇 / 用户文档 ${rows.length - system} 篇 / 合计 ${rows.length} 篇`);
  console.log(`[knowledge] 已生成 sql/knowledge/38_knowledge_docs.sql（${(sqlBytes / 1024).toFixed(1)} KB，一个文档一条 INSERT，正文可读）`);
  await getPool().end();
};

main().catch(async (err: unknown) => {
  console.error('[knowledge] 导出失败：', err);
  await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
