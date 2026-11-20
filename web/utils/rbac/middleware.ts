import type { Request, Response, NextFunction } from 'express';
import { returnResponse, ErrorCode } from '@/utils/response';

// ==============================
// 超级管理员校验中间件
// ==============================

/**
 * 仅允许超级管理员执行的操作
 * @description 检查 req.userIsAdmin，非超级管理员返回 403
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.userIsAdmin) {
    returnResponse(res, ErrorCode.FORBIDDEN, {}, '仅超级管理员可执行此操作');
    return;
  }
  next();
};
