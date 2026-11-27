import { DATABASE_QUERY_ROWS_LIMIT, DATABASE_SQL_MAX_BYTES, type SqlExecution } from '@/types/database';
import { executeSql } from './connection';

/** 只读查询允许的起始关键字 */
const READ_STATEMENTS = new Set(['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH']);

/** 只读查询中禁止出现的写入动作与危险函数 */
const FORBIDDEN_READ_PATTERN = /\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|into\s+outfile|into\s+dumpfile|load_file|sleep|benchmark|lock\s+tables|set\s+global)\b/i;

/**
 * 校验并规整单条 SQL
 * @param raw - 前端提交的 SQL 原文
 * @description 去掉行尾分号，剥离注释后检查是否含多条语句；执行时用剥离注释的版本，
 *   避免行注释把子查询包装的右括号吞掉
 */
const normalizeSql = (raw: string): string => {
  if (typeof raw !== 'string') throw new Error('SQL 内容不合法');
  if (Buffer.byteLength(raw, 'utf8') > DATABASE_SQL_MAX_BYTES) throw new Error('SQL 超过 64KB 限制');
  const sql = raw.trim().replace(/;+\s*$/, '');
  if (!sql) throw new Error('SQL 不能为空');
  const bare = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
    .replace(/#[^\n]*/g, '')
    .trim();
  if (!bare) throw new Error('SQL 不能为空');
  if (bare.includes(';')) throw new Error('一次只能执行一条 SQL 语句');
  return bare;
};

/**
 * 执行只读查询
 * @param raw - SELECT / SHOW / DESCRIBE / EXPLAIN / WITH 语句
 * @description 无 LIMIT 的 SELECT 会被包一层 LIMIT，避免大表全量拉取；结果统一截断
 */
export const runReadOnlyQuery = async (raw: string): Promise<SqlExecution> => {
  const sql = normalizeSql(raw);
  const keyword = sql.split(/\s+/)[0]?.toUpperCase() ?? '';
  if (!READ_STATEMENTS.has(keyword)) {
    throw new Error('只读查询仅支持 SELECT / SHOW / DESCRIBE / EXPLAIN / WITH');
  }
  if (FORBIDDEN_READ_PATTERN.test(sql)) {
    throw new Error('只读查询不允许包含写入语句或危险函数');
  }
  const limit = DATABASE_QUERY_ROWS_LIMIT;
  const needsWrapper = keyword === 'SELECT' && !/\blimit\s+\d+/i.test(sql);
  const statement = needsWrapper
    ? `SELECT * FROM (${sql}) AS \`__helper_db_query\` LIMIT ${limit + 1}`
    : sql;
  return executeSql(statement, [], limit);
};

/**
 * 执行写 SQL（DDL / DML）
 * @param raw - 单条 SQL 语句，调用方需确保已通过超级管理员与 edit 权限校验
 */
export const runWriteQuery = async (raw: string): Promise<SqlExecution> => {
  const sql = normalizeSql(raw);
  return executeSql(sql, [], DATABASE_QUERY_ROWS_LIMIT);
};
