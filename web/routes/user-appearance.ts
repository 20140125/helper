/**
 * 按用户外观偏好路由
 * @description 全局 JWT 中间件已保证登录态；读写按 req.userEmail 隔离，不设额外权限码
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  ErrorCode,
  returnResponse,
  readUserAppearance,
  upsertUserAppearance,
  normalizeSurfaceOpacity,
} from './utils';
import {
  USER_APPEARANCE_SURFACE_OPACITY_MAX,
  USER_APPEARANCE_SURFACE_OPACITY_MIN,
} from '@/types/user-appearance';
import type { UserAppearanceBody } from '@/types/user-appearance';

const router = Router();

/** 把异常转换成统一响应 */
const handleError = (res: Response, err: unknown) =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET / 读取当前用户的背景图遮挡层不透明度 */
router.get('/', async (req: Request, res: Response) => {
  const email = req.userEmail ?? '';
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  try {
    const result = await readUserAppearance(email);
    return returnResponse(res, ErrorCode.SUCCESS, { result }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route PUT / 保存当前用户的背景图遮挡层不透明度 */
router.put('/', async (req: Request, res: Response) => {
  const email = req.userEmail ?? '';
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const { surfaceOpacity } = (req.body ?? {}) as UserAppearanceBody;
  const value = normalizeSurfaceOpacity(surfaceOpacity);
  if (value === null) {
    return returnResponse(
      res,
      ErrorCode.BAD_REQUEST,
      {},
      `遮挡层不透明度必须是 ${USER_APPEARANCE_SURFACE_OPACITY_MIN}–${USER_APPEARANCE_SURFACE_OPACITY_MAX} 的整数`,
    );
  }
  try {
    await upsertUserAppearance(email, { surfaceOpacity: value });
    return returnResponse(res, ErrorCode.SUCCESS, { result: { surfaceOpacity: value } }, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
