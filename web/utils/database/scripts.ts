import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { PROJECT_DIR } from '@/utils/paths';
import {
  DATABASE_INIT_ENTRY,
  DATABASE_INIT_MAX_BYTES,
  type DatabaseInitResult,
  type DatabaseScriptFile,
} from '@/types/database';
import { readDatabaseConfig } from './connection';
import { badRequest, notFound } from '@/utils/response';

/** 模块化建表 SQL 目录 */
const SQL_DIR = path.join(PROJECT_DIR, 'sql');

/**
 * 把项目相对路径解析为白名单内的 SQL 文件绝对路径
 * @param relPath - 相对项目根的路径（helper_database.sql 或 sql/**）
 */
const resolveSqlFile = (relPath: string): string => {
  if (relPath !== DATABASE_INIT_ENTRY && !relPath.startsWith('sql/')) {
    throw badRequest('只允许访问 helper_database.sql 与 sql/ 目录下的脚本');
  }
  const abs = path.resolve(PROJECT_DIR, relPath);
  if (!abs.startsWith(PROJECT_DIR + path.sep) || path.extname(abs) !== '.sql') {
    throw badRequest('SQL 脚本路径不合法');
  }
  return abs;
};

/**
 * 递归收集 sql/ 下的脚本文件
 */
const collectSqlFiles = (dir: string, prefix: string): DatabaseScriptFile[] => {
  const files: DatabaseScriptFile[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = `${prefix}/${entry.name}`;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSqlFiles(abs, rel));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.sql')) continue;
    files.push({
      path: rel,
      module: prefix === 'sql' ? 'root' : prefix.replace(/^sql\//, ''),
      size: fs.statSync(abs).size,
    });
  }
  return files;
};

/**
 * 列出项目内的建表 SQL 脚本
 * @description 入口聚合器排在最前，其余按模块目录分组展示
 */
export const listSqlScripts = (): DatabaseScriptFile[] => {
  const entryAbs = path.join(PROJECT_DIR, DATABASE_INIT_ENTRY);
  const entryFiles: DatabaseScriptFile[] = fs.existsSync(entryAbs)
    ? [{ path: DATABASE_INIT_ENTRY, module: 'entry', size: fs.statSync(entryAbs).size }]
    : [];
  if (!fs.existsSync(SQL_DIR)) return entryFiles;
  return [...entryFiles, ...collectSqlFiles(SQL_DIR, 'sql')];
};

/**
 * 读取单个 SQL 脚本内容
 * @param relPath - 相对项目根的路径
 */
export const readSqlScript = (relPath: string): string => {
  const abs = resolveSqlFile(relPath);
  if (!fs.existsSync(abs)) throw notFound(`SQL 脚本不存在：${relPath}`);
  return fs.readFileSync(abs, 'utf8');
};

/**
 * 展开聚合器里的 SOURCE 指令（支持 sql/cache_data.sql 这类二级聚合）
 * @param entryRel - 入口文件相对路径
 * @description mysql2 不认识 SOURCE（mysql 客户端命令），因此在 Node 侧递归展开为纯 SQL
 */
export const expandInitScript = (entryRel: string): { content: string; files: string[] } => {
  const files: string[] = [];
  const visited = new Set<string>();
  const expand = (rel: string): string => {
    const abs = resolveSqlFile(rel);
    if (visited.has(abs)) throw new Error(`检测到循环 SOURCE 引用：${rel}`);
    visited.add(abs);
    files.push(rel);
    if (!fs.existsSync(abs)) throw new Error(`SQL 脚本不存在：${rel}`);
    const content = fs.readFileSync(abs, 'utf8');
    return content
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(/^\s*SOURCE\s+['"]?([^;\s'"]+)['"]?\s*;?\s*$/i);
        if (!match) return line;
        // SOURCE 路径以项目根为基准（与 mysql 客户端在项目根执行时一致）
        return expand(match[1]);
      })
      .join('\n');
  };
  const content = expand(entryRel);
  if (Buffer.byteLength(content, 'utf8') > DATABASE_INIT_MAX_BYTES) {
    throw new Error('初始化脚本展开后超过 4MB，已取消执行');
  }
  return { content, files };
};

/**
 * 用项目 SQL 资产初始化数据库
 * @param confirmName - 前端二次确认输入的库名，必须与 DB_NAME 完全一致
 * @description 入口脚本会 DROP 并重建全部表，属高危操作；DDL 无法整体回滚
 */
export const initializeDatabase = async (confirmName: string): Promise<DatabaseInitResult> => {
  const config = readDatabaseConfig();
  if (!config) throw new Error('数据库未配置');
  if (confirmName !== config.database) {
    throw badRequest(`确认名称与当前数据库「${config.database}」不一致，初始化已取消`);
  }
  const { content, files } = expandInitScript(DATABASE_INIT_ENTRY);
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    multipleStatements: true,
  });
  try {
    // 各模块 SQL 自带 DROP TABLE IF EXISTS；关闭外键检查避免重复初始化时
    // 父表（如 hp_ai_conversations）被子表外键约束挡住
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    const started = Date.now();
    await connection.query(content);
    return { entry: DATABASE_INIT_ENTRY, files: files.length, elapsedMs: Date.now() - started };
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined);
    await connection.end();
  }
};
