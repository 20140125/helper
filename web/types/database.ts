// ==============================
// 数据库管理模块：类型与常量
// @description 只放接口契约与常量，运行时逻辑放 web/utils/database/
// ==============================

/** 数据库连接配置（来自 web/.env 的 DB_* 变量） */
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** 数据库连接状态 */
export interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
  host: string;
  port: number;
  database: string;
  version: string;
  error: string;
}

/** 库表概要信息 */
export interface DatabaseTable {
  name: string;
  type: 'table' | 'view';
  engine: string;
  rows: number;
  collation: string;
  comment: string;
  dataSize: number;
  indexSize: number;
}

/** 表字段信息 */
export interface DatabaseColumn {
  field: string;
  type: string;
  nullable: string;
  key: string;
  default: string | null;
  extra: string;
  comment: string;
}

/** 表索引信息 */
export interface DatabaseIndex {
  name: string;
  column: string;
  unique: boolean;
  seq: number;
}

/** 表结构详情 */
export interface DatabaseTableSchema {
  name: string;
  columns: DatabaseColumn[];
  indexes: DatabaseIndex[];
  createSql: string;
}

/** SQL 执行结果（单元格统一序列化为字符串，避免二进制/大整数破坏 JSON） */
export interface SqlExecution {
  columns: string[];
  rows: Array<Array<string | null>>;
  affectedRows: number;
  insertId: number;
  elapsedMs: number;
  truncated: boolean;
}

/** 建表 SQL 脚本文件 */
export interface DatabaseScriptFile {
  path: string;
  module: string;
  size: number;
}

/** 数据库初始化结果 */
export interface DatabaseInitResult {
  entry: string;
  files: number;
  elapsedMs: number;
}

/** 查询 / 执行 SQL 请求体 */
export interface DatabaseSqlBody {
  sql: string;
}

/** 初始化数据库请求体 */
export interface InitDatabaseBody {
  confirmName: string;
}

/** 数据预览默认及最大行数 */
export const DATABASE_ROWS_LIMIT = 100;

/** SQL 执行结果最大返回行数 */
export const DATABASE_QUERY_ROWS_LIMIT = 500;

/** 表清单最大数量 */
export const DATABASE_TABLES_LIMIT = 500;

/** 单条 SQL 最大字节数 */
export const DATABASE_SQL_MAX_BYTES = 64 * 1024;

/** 初始化脚本展开后最大字节数 */
export const DATABASE_INIT_MAX_BYTES = 4 * 1024 * 1024;

/** 数据库初始化入口文件（相对项目根） */
export const DATABASE_INIT_ENTRY = 'helper_database.sql';
