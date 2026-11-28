/**
 * 系统背景图路由
 * @description 读取对所有登录用户开放；上传 / 设置 / 清除由 CONFIG_EDIT 保护（server.ts 挂载）
 */
import { Router } from 'express';
import type { Response } from 'express';
import {
  ErrorCode,
  returnResponse,
  handleAppBackgroundUpload,
  readAppBackground,
  saveAppBackground,
  clearAppBackground,
  isSafeAppBackgroundUrl,
} from './utils';

const router = Router();

/** 把异常转换成统一响应 */
const handleError = (res: Response, err: unknown) =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET / 读取当前系统背景（登录页与首屏也会调用） */
router.get('/', async (_req, res) => {
  try {
    return returnResponse(res, ErrorCode.SUCCESS, { result: await readAppBackground() }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route POST /upload 上传背景图，返回站内相对地址 */
router.post('/upload', handleAppBackgroundUpload);

/** @route PUT / 设置系统背景 */
router.put('/', async (req, res) => {
  const { url } = req.body as { url?: unknown };
  if (typeof url !== 'string' || !isSafeAppBackgroundUrl(url)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '非法的背景图地址');
  }
  try {
    await saveAppBackground(url);
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route DELETE / 清除系统背景 */
router.delete('/', async (_req, res) => {
  try {
    await clearAppBackground();
    return returnResponse(res, ErrorCode.SUCCESS, {}, '已恢复默认背景');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
