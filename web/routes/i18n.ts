import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  ErrorCode,
  returnResponse,
  Permission,
  requirePermission,
  readAllI18nTranslations,
  listI18nMessages,
  updateI18nMessage,
} from './utils';
import type { UpdateI18nMessageBody } from '@/types/i18n';

const router = Router();

/**
 * 统一处理接口异常
 * @param {Response} res - Express 响应对象
 * @param {unknown} err - 捕获到的异常
 * @returns {Response} 统一错误响应
 * @description 业务校验失败与数据库异常都把 message 透传给前端展示
 */
const handleError = (res: Response, err: unknown): Response =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET /translations - 前端运行时语言包（公开，一次返回 zh / en，登录页与首屏都要用） */
router.get('/translations', async (_req: Request, res: Response) => {
  try {
    const translations = await readAllI18nTranslations();
    return returnResponse(res, ErrorCode.SUCCESS, { translations } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /messages - 语言管理页列表（公开给所有登录用户查看） */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { lang, namespace, keyword, limit, offset } = req.query as Record<string, string | undefined>;
    const result = await listI18nMessages({
      lang,
      namespace,
      keyword,
      limit: Number(limit) || undefined,
      offset: Number(offset) || undefined,
    });
    return returnResponse(res, ErrorCode.SUCCESS, { result } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route PUT /messages/:id - 更新一条静态文案（database:edit） */
router.put('/messages/:id', requirePermission(Permission.DATABASE_EDIT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { value } = (req.body ?? {}) as UpdateI18nMessageBody;
    if (!Number.isInteger(id) || id <= 0) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '条目 ID 不合法');
    }
    if (typeof value !== 'string') {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文案必须是字符串');
    }
    await updateI18nMessage(id, value);
    return returnResponse(res, ErrorCode.SUCCESS, { id, value } as Record<string, unknown>, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
