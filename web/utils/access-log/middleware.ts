/**
 * Access Log 中间件
 * @description 记录每个 API 请求的用户、方法、路径、状态码和响应体
 */

import type { Request, Response, NextFunction } from 'express';
import { getTimestamp, formatBody } from './formatter';
import { appendLog } from './rotation';

/** 不记录 access log 的路径前缀列表（避免日志自引用和膨胀） */
const EXCLUDED_PATHS = ['/logs'];

/**
 * Access Log 中间件
 * @description 记录每个 API 请求的用户、方法、路径、状态码和响应体
 *
 * 日志格式（每条请求一个区块，用分隔线隔开）：
 *
 * ────────────────────────────────────────
 * ▸ 2026-04-03 11:30:00  GET /api/trigger
 *   用户: admin@example.com | 状态: 200 | 耗时: 12ms
 *   响应:
 *   {
 *     "ok": true,
 *     "scripts": [...]
 *   }
 * ────────────────────────────────────────
 */
export const accessLogMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (EXCLUDED_PATHS.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  const startTime = Date.now();

  const originalJson = res.json.bind(res);
  res.json = (body?: unknown): Response => {
    const duration = Date.now() - startTime;
    const user = req.userEmail ?? '-';
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;

    const separator = '────────────────────────────────────────────────────────';
    const header = `▸ ${getTimestamp()}  ${method} ${url}`;
    const meta = `  用户: ${user}  |  状态: ${status}  |  耗时: ${duration}ms`;
    const bodyStr = formatBody(body);

    const block = [
      separator,
      header,
      meta,
      '  响应:',
      bodyStr,
    ].join('\n');

    appendLog(block);

    return originalJson(body);
  };

  next();
};
