/**
 * 系统背景图路由
 * @description 读取与图片输出对所有用户开放；上传 / 保存 / 清除由 CONFIG_EDIT 保护（server.ts 挂载）
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
} from './utils';
import {
  APP_BACKGROUND_DATA_URL_PATTERN,
  APP_BACKGROUND_MAX_DATA_URL_CHARS,
} from '@/types/app-background';

const router = Router();

/** 把异常转换成统一响应 */
const handleError = (res: Response, err: unknown) =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET / 读取当前系统背景的站内短地址（登录页与首屏也会调用） */
router.get('/', async (_req, res) => {
  try {
    return returnResponse(res, ErrorCode.SUCCESS, { result: await readAppBackground() }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route POST /upload 上传背景图，返回图片本体 data URL（不落磁盘） */
router.post('/upload', handleAppBackgroundUpload);

/** @route PUT / 把图片本体写入 hp_app_background，返回站内短地址 */
router.put('/', async (req, res) => {
  const { url } = req.body as { url?: unknown };
  if (typeof url !== 'string'
    || url.length > APP_BACKGROUND_MAX_DATA_URL_CHARS
    || !APP_BACKGROUND_DATA_URL_PATTERN.test(url)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '非法的背景图数据');
  }
  try {
    const shortUrl = await saveAppBackground(url);
    return returnResponse(res, ErrorCode.SUCCESS, { url: shortUrl }, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route DELETE / 清除系统背景，恢复默认主题 */
router.delete('/', async (_req, res) => {
  try {
    await clearAppBackground();
    return returnResponse(res, ErrorCode.SUCCESS, {}, '已恢复默认背景');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
