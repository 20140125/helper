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
