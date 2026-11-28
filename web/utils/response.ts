import { Response } from 'express';

export enum ErrorCode {
  SUCCESS = 0,
  STATUS_SUCCESS = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

// ==============================
// 异常 → HTTP 状态码
// @description 业务校验错误显式标记状态码，避免所有异常都被当成 500
// ==============================

/**
 * 生成带 HTTP 状态码的业务错误
 * @param message - 透传给前端的错误文本
 * @param status - 对应的业务/HTTP 状态码
 */
export const createHttpError = (message: string, status: ErrorCode): Error =>
  Object.assign(new Error(message), { httpStatus: status });

/** 请求参数或内容不合法（400） */
export const badRequest = (message: string): Error => createHttpError(message, ErrorCode.BAD_REQUEST);

/** 请求的表、视图或脚本不存在（404） */
export const notFound = (message: string): Error => createHttpError(message, ErrorCode.NOT_FOUND);

/** mysql2 返回的表不存在错误码 */
const TABLE_MISSING_CODES = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);

/** mysql2 返回的连接、权限与服务端故障错误码（仍属 500） */
const SERVER_DB_ERROR_CODES = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_CON_COUNT_ERROR',
  'ER_HOST_NOT_PRIVILEGED',
  'ER_SERVER_SHUTDOWN',
  'ER_NORMAL_SHUTDOWN',
  'ER_UNKNOWN_ERROR',
]);

/**
 * 把异常解析成 HTTP 业务状态码
 * @description 带 httpStatus 的业务错误优先；仅 MySQL 服务端返回的 ER_* 错误按语义细分，
 *   表不存在归 404、SQL 语句/数据问题归 400、权限与连接故障归 500；
 *   网络/文件系统错误及未标记异常一律视为服务端故障 500
 */
export const resolveHttpErrorCode = (err: unknown): ErrorCode => {
  const tagged = err as { httpStatus?: unknown; code?: unknown } | null;
  if (typeof tagged?.httpStatus === 'number') return tagged.httpStatus as ErrorCode;
  const code = typeof tagged?.code === 'string' ? tagged.code : '';
  if (!code.startsWith('ER_')) return ErrorCode.INTERNAL_SERVER_ERROR;
  if (TABLE_MISSING_CODES.has(code)) return ErrorCode.NOT_FOUND;
  if (SERVER_DB_ERROR_CODES.has(code)) return ErrorCode.INTERNAL_SERVER_ERROR;
  return ErrorCode.BAD_REQUEST;
};

/**
 * 统一 API 响应方法
 * @param res     - Express Response 对象
 * @param code    - 业务状态码（0 表示成功，非 0 为 HTTP 错误码如 400/403/404/500）
 * @param data    - 响应数据
 * @param message - 响应消息
 */
export const returnResponse = (res: Response, code: number, data: Record<string, unknown>, message: string) => {
  return res.status(code || ErrorCode.STATUS_SUCCESS).json({ code, data, message });
}
