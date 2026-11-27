import { DATABASE_QUERY_ROWS_LIMIT, DATABASE_ROWS_LIMIT, DATABASE_TABLES_LIMIT, type DatabaseColumn, type DatabaseIndex, type DatabaseTable, type DatabaseTableSchema, type SqlExecution } from '@/types/database';
import { executeSql, readDatabaseConfig } from './connection';

/** 合法表名：仅字母、数字、下划线，避免拼接 SQL 时注入 */
const TABLE_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

/**
 * 校验并转义表名标识符
 * @param name - 前端传入的表名
 */
const quoteIdentifier = (name: string): string => {
  if (typeof name !== 'string' || !TABLE_NAME_PATTERN.test(name)) {
    throw new Error('表名不合法：仅支持字母、数字与下划线');
  }
  return `\`${name}\``;
};

/**
 * 确认表确实位于当前连接的数据库内
 * @description 防止通过表名访问其他 schema 的数据
 */
const assertTableExists = async (name: string): Promise<void> => {
  const config = readDatabaseConfig();
  if (!config) throw new Error('数据库未配置');
  const result = await executeSql(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [config.database, name],
    1,
  );
  if (result.rows.length === 0) throw new Error(`表或视图不存在：${name}`);
};

/**
 * 列出当前库的所有表与视图
 * @description 从 information_schema 读取，行数与大表体积仅作参考展示
 */
export const listTables = async (): Promise<DatabaseTable[]> => {
  const config = readDatabaseConfig();
  if (!config) throw new Error('数据库未配置');
  const result = await executeSql(
    `SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, TABLE_COLLATION,
            TABLE_COMMENT, DATA_LENGTH, INDEX_LENGTH
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [config.database],
    DATABASE_TABLES_LIMIT,
  );
  return result.rows.map((row) => ({
    name: String(row[0] ?? ''),
    type: row[1] === 'VIEW' ? 'view' : 'table',
    engine: String(row[2] ?? ''),
    rows: Number(row[3] ?? 0),
    collation: String(row[4] ?? ''),
    comment: String(row[5] ?? ''),
    dataSize: Number(row[6] ?? 0),
    indexSize: Number(row[7] ?? 0),
  }));
};

/**
 * 读取单张表的结构（字段、索引、建表语句）
 * @param name - 表名或视图名
 */
export const describeTable = async (name: string): Promise<DatabaseTableSchema> => {
  const quoted = quoteIdentifier(name);
  await assertTableExists(name);
  const columnsResult = await executeSql(`SHOW FULL COLUMNS FROM ${quoted}`, [], DATABASE_QUERY_ROWS_LIMIT);
  const indexesResult = await executeSql(`SHOW INDEX FROM ${quoted}`, [], DATABASE_QUERY_ROWS_LIMIT);
  const createResult = await executeSql(`SHOW CREATE TABLE ${quoted}`, [], 1);

  const columns: DatabaseColumn[] = columnsResult.rows.map((row) => ({
    field: String(row[0] ?? ''),
    type: String(row[1] ?? ''),
    nullable: String(row[3] ?? ''),
    key: String(row[4] ?? ''),
    default: row[5],
    extra: String(row[6] ?? ''),
    comment: String(row[8] ?? ''),
  }));
  const indexes: DatabaseIndex[] = indexesResult.rows.map((row) => ({
    name: String(row[2] ?? ''),
    column: String(row[4] ?? ''),
    unique: Number(row[1] ?? 1) === 0,
    seq: Number(row[3] ?? 0),
  }));
  return {
    name,
    columns,
    indexes,
    createSql: createResult.rows[0]?.[1] ?? '',
  };
};

/**
 * 预览表数据（强制 LIMIT，禁止全表拉取）
 * @param name - 表名或视图名
 * @param limit - 期望行数，超过 DATABASE_ROWS_LIMIT 时自动收敛
 * @param offset - 偏移量
 */
export const previewTableRows = async (
  name: string,
  limit: number,
  offset: number,
): Promise<SqlExecution> => {
  const quoted = quoteIdentifier(name);
  await assertTableExists(name);
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || DATABASE_ROWS_LIMIT, 1), DATABASE_ROWS_LIMIT);
  const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
  return executeSql(`SELECT * FROM ${quoted} LIMIT ${safeLimit} OFFSET ${safeOffset}`, [], safeLimit);
};
