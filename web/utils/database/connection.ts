import mysql from 'mysql2/promise';
import type { FieldPacket, ResultSetHeader, RowDataPacket } from 'mysql2';
import {
  DATABASE_QUERY_ROWS_LIMIT,
  type DatabaseConfig,
  type DatabaseStatus,
  type SqlExecution,
} from '@/types/database';

/** 连接池单例（按配置快照复用，.env 变更后自动重建） */
let cachedPool: ReturnType<typeof mysql.createPool> | null = null;
let cachedConfigKey = '';

/**
 * 读取数据库连接配置
 * @description 依赖 server.ts 启动时加载的 dotenv；缺少必要变量时返回 null，功能降级而非报错
 */
export const readDatabaseConfig = (): DatabaseConfig | null => {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) return null;
  return {
    host: DB_HOST,
    port: Number(DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD ?? '',
    database: DB_NAME,
  };
};

/**
 * 获取数据库连接池
 * @description 普通查询禁止多语句，避免只读/写接口绕过语句白名单；初始化使用独立连接
 */
export const getPool = (): ReturnType<typeof mysql.createPool> => {
  const config = readDatabaseConfig();
  if (!config) {
    throw new Error('数据库未配置：请在 web/.env 中填写 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME');
  }
  const key = JSON.stringify(config);
  if (!cachedPool || cachedConfigKey !== key) {
    if (cachedPool) cachedPool.end().catch(() => undefined);
    cachedPool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 4,
      multipleStatements: false,
    });
    cachedConfigKey = key;
  }
  return cachedPool;
};

/**
 * 把数据库单元格序列化为可安全 JSON 化的文本
 * @description 覆盖 Buffer / Date / BigInt / JSON 等 mysql2 特殊返回类型
 */
const serializeCell = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * 执行一条 SQL 并把结果规整为统一结构
 * @param sql - SQL 语句（调用方需已完成校验）
 * @param params - 参数化占位符的值
 * @param maxRows - 最多返回的行数，超出时置 truncated 标记
 */
export const executeSql = async (
  sql: string,
  params: Array<string | number> = [],
  maxRows: number = DATABASE_QUERY_ROWS_LIMIT,
): Promise<SqlExecution> => {
  const pool = getPool();
  const started = Date.now();
  const [result, fields] = await pool.query<RowDataPacket[]>(sql, params);
  const columns: string[] = Array.isArray(fields)
    ? fields.map((field: FieldPacket) => field.name)
    : [];
  const rawRows: RowDataPacket[] = Array.isArray(result) ? result : [];
  const rows = rawRows
    .slice(0, maxRows)
    .map((row) => columns.map((column) => serializeCell(row[column])));
  const header = !Array.isArray(result) ? (result as ResultSetHeader) : null;
  return {
    columns,
    rows,
    affectedRows: header ? header.affectedRows : rawRows.length,
    insertId: header ? Number(header.insertId ?? 0) : 0,
    elapsedMs: Date.now() - started,
    truncated: rawRows.length > maxRows,
  };
};

/**
 * 探测数据库连接状态
 * @description 连接失败时返回 connected=false 与错误文本，不抛异常，便于页面给出可操作提示
 */
export const getDatabaseStatus = async (): Promise<DatabaseStatus> => {
  const config = readDatabaseConfig();
  if (!config) {
    return {
      configured: false,
      connected: false,
      host: '',
      port: 0,
      database: '',
      version: '',
      error: '未配置 DB_* 环境变量',
    };
  }
  const base = {
    configured: true,
    host: config.host,
    port: config.port,
    database: config.database,
  };
  try {
    const result = await executeSql('SELECT VERSION() AS version', [], 1);
    return { ...base, connected: true, version: result.rows[0]?.[0] ?? '', error: '' };
  } catch (err) {
    return { ...base, connected: false, version: '', error: (err as Error).message.slice(0, 300) };
  }
};
