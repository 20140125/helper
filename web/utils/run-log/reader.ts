/**
 * 运行日志查询与清理
 * @description 日志查看页、AI 工具、定时清理统一走这里读 hp_run_logs；
 *   不再使用 fs.statSync / tail / writeFileSync('') 操作任何日志文件。
 */

import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import {
  DEFAULT_LOG_RETENTION_DAYS,
  type RunLogRow,
  type RunLogDetail,
  type RunLogQuery,
  type RunLogPage,
  type RunLogSourceStat,
} from '@/types/run-log';

/** 一天的毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 补零 */
const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/**
 * 读取日志保留天数
 * @returns {number} 保留天数，未配置或非法时取默认 15 天
 */
export const getLogRetentionDays = (): number => {
  const raw = Number(process.env.LOG_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_LOG_RETENTION_DAYS;
};

/**
 * 把时间戳转成 MySQL DATETIME(3) 字面量
 * @param {number} ms - 毫秒时间戳
 * @returns {string} 形如 2026-11-28 01:30:00.123
 */
const toMysqlDatetime = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

/**
 * 按来源聚合日志统计
 * @returns {Promise<RunLogSourceStat[]>} 每个来源的条数、正文体积与最新时间
 */
export const listRunLogSources = async (): Promise<RunLogSourceStat[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>([
    'SELECT source, COUNT(*) AS total, COALESCE(SUM(LENGTH(message)), 0) AS bytes,',
    '       DATE_FORMAT(MAX(logged_at), \'%Y-%m-%d %H:%i:%s\') AS latest',
    'FROM hp_run_logs GROUP BY source',
  ].join(' '));
  return rows.map((row) => ({
    source: String(row.source),
    rows: Number(row.total),
    bytes: Number(row.bytes),
    latest: String(row.latest ?? ''),
  }));
};

/**
 * 读取某个来源最近 N 条日志（按时间正序返回）
 * @param {string} source - 来源标识
 * @param {number} limit - 最多返回条数
 * @param {number} offset - 跳过条数（「历史」视图用）
 * @returns {Promise<RunLogRow[]>} 日志行
 */
export const readRunLogRows = async (
  source: string,
  limit: number,
  offset = 0,
): Promise<RunLogRow[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    // DATE_FORMAT 让 mysql2 返回字符串而不是 JS Date，渲染时不会出现 Date.toString()
    'SELECT id, DATE_FORMAT(logged_at, \'%Y-%m-%d %H:%i:%s\') AS logged_at, ts_ms, level, '
    + 'source_type, source, message, context, caller, hostname, pid '
    + 'FROM hp_run_logs WHERE source = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [source, limit, offset],
  );
  return (rows as RunLogRow[]).reverse();
};

/**
 * 按条件分页查询日志记录（按 id 倒序）
 * @param {RunLogQuery} query - 分页与筛选条件
 * @returns {Promise<RunLogPage>} 当前页记录与总条数
 * @description 筛选条件全部走参数化 SQL，COUNT 与分页查询共用同一 WHERE 子句
 */
export const listRunLogRows = async (query: RunLogQuery): Promise<RunLogPage> => {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (query.source) {
    conditions.push('source = ?');
    params.push(query.source);
  }
  if (query.sourceType) {
    conditions.push('source_type = ?');
    params.push(query.sourceType);
  }
  if (query.level) {
    conditions.push('level = ?');
    params.push(query.level);
  }
  if (query.keyword) {
    conditions.push('message LIKE ?');
    params.push(`%${query.keyword}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [countRows] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM hp_run_logs ${where}`,
    params,
  );
  const total = Number(countRows[0]?.total ?? 0);
  const offset = (query.page - 1) * query.pageSize;
  const [rows] = await getPool().query<RowDataPacket[]>(
    // DATE_FORMAT 让 mysql2 返回字符串而不是 JS Date
    'SELECT id, DATE_FORMAT(logged_at, \'%Y-%m-%d %H:%i:%s\') AS logged_at, ts_ms, level, '
    + 'source_type, source, message, context, caller, hostname, pid '
    + `FROM hp_run_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, query.pageSize, offset],
  );
  return {
    items: rows as RunLogRow[],
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};

/**
 * 按 ID 查询单条日志详情
 * @param {number} id - 日志记录 ID
 * @returns {Promise<RunLogDetail | null>} 完整日志记录，不存在时返回 null
 */
export const getRunLogById = async (id: number): Promise<RunLogDetail | null> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT id, DATE_FORMAT(logged_at, \'%Y-%m-%d %H:%i:%s\') AS logged_at, ts_ms, level, '
    + 'source_type, source, message, context, caller, hostname, pid, trace_id, `user` '
    + 'FROM hp_run_logs WHERE id = ? LIMIT 1',
    [id],
  );
  return (rows[0] as RunLogDetail | undefined) ?? null;
};

/**
 * 把日志行渲染成页面可直接展示的文本
 * @param {RunLogRow[]} rows - 按时间正序的日志行
 * @returns {string} 文本日志内容
 * @description 访问日志本身是多行区块，按原文拼接；其余日志按 [时间] [级别] 正文 渲染
 */
export const renderRunLogRows = (rows: RunLogRow[]): string =>
  rows
    .map((row) => {
      if (row.source === 'web_access') return row.message;
      // console 的 args=[]、脚本的默认 extra={} 都没有信息量，不拼进展示文本
      const meaningful = row.context && !['{}', '[]', 'null', ''].includes(row.context.trim());
      const context = meaningful ? ` ${row.context}` : '';
      return `[${row.logged_at}] [${row.level}] ${row.message}${context}`;
    })
    .join('\n');

/**
 * 清空日志（按来源，或全表）
 * @param {string} [source] - 来源标识；省略表示清空全部
 * @returns {Promise<number>} 删除的记录数
 */
export const clearRunLogs = async (source?: string): Promise<number> => {
  const sql = source
    ? 'DELETE FROM hp_run_logs WHERE source = ?'
    : 'DELETE FROM hp_run_logs';
  const params = source ? [source] : [];
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result.affectedRows;
};

/**
 * 按保留天数清理过期日志
 * @param {number} [days] - 保留天数，省略时读 .env 的 LOG_RETENTION_DAYS
 * @returns {Promise<number>} 删除的记录数
 */
export const purgeExpiredRunLogs = async (days?: number): Promise<number> => {
  const keepDays = days ?? getLogRetentionDays();
  const boundary = toMysqlDatetime(Date.now() - keepDays * DAY_MS);
  const [result] = await getPool().execute<ResultSetHeader>(
    'DELETE FROM hp_run_logs WHERE logged_at < ?',
    [boundary],
  );
  return result.affectedRows;
};
