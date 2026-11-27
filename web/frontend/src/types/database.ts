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

/** SQL 执行结果 */
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

/** 初始化结果 */
export interface DatabaseInitResult {
  entry: string;
  files: number;
  elapsedMs: number;
}

/** 连接状态响应 */
export interface DatabaseStatusResponse {
  code: number;
  data: { status: DatabaseStatus };
  message: string;
}

/** 表清单响应 */
export interface DatabaseTablesResponse {
  code: number;
  data: { tables: DatabaseTable[] };
  message: string;
}

/** 表结构响应 */
export interface DatabaseSchemaResponse {
  code: number;
  data: { schema: DatabaseTableSchema };
  message: string;
}

/** 数据预览 / SQL 执行响应 */
export interface DatabaseSqlResponse {
  code: number;
  data: { result: SqlExecution };
  message: string;
}

/** 脚本清单响应 */
export interface DatabaseScriptsResponse {
  code: number;
  data: { scripts: DatabaseScriptFile[] };
  message: string;
}

/** 脚本内容响应 */
export interface DatabaseScriptResponse {
  code: number;
  data: { path: string; content: string };
  message: string;
}

/** 初始化响应 */
export interface DatabaseInitResponse {
  code: number;
  data: { result: DatabaseInitResult };
  message: string;
}
