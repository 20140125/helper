import { Router } from 'express';
import type { Request, Response } from 'express';
import { returnResponse, ErrorCode, listAiChatAdminRuns, getAiChatAdminRunDetail } from './utils';

const router = Router();

/** 一天的毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 拥有其中任一权限即视为管理员，可查看全量用户的回话与用量 */
const ADMIN_LIKE_PERMISSIONS = ['rbac:view', 'rbac:edit'];

/**
 * 从 req 中读取当前用户上下文
 * @param {Request} req - Express 请求对象
 * @returns {{ email: string; permissions: string[] }} 用户上下文
 * @description 全局 JWT 中间件已把 userEmail / userPermissions 挂到 req 上
 */
const getUser = (req: Request): { email: string; permissions: string[] } => ({
  email: req.userEmail ?? '',
  permissions: (req.userPermissions ?? []) as string[],
});

/**
 * 当前用户是否可查看全量数据
 * @param {string[]} permissions - 用户权限码列表
 * @returns {boolean} 是否管理员
 */
const canSeeAll = (permissions: string[]): boolean =>
  ADMIN_LIKE_PERMISSIONS.some((permission) => permissions.includes(permission));

/**
 * 读取并夹紧整数查询参数
 * @param {unknown} raw - 原始 query 值
 * @param {number} fallback - 缺省值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 合法整数
 */
const clampInt = (raw: unknown, fallback: number, min: number, max: number): number => {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
};

/**
 * 分页查询 AI 运行列表
 * @route GET /runs?days=30&scope=me|all&keyword=&page=1&pageSize=15
 * @description scope=all 仅管理员生效，普通用户静默降级为 me，避免探测他人回话；
 *   列表不含 steps 明细，点开行时再走详情接口。
 */
router.get('/runs', async (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const days = clampInt(req.query.days, 30, 1, 90);
  const scope = req.query.scope === 'all' && canSeeAll(permissions) ? 'all' : 'me';
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim().slice(0, 100) : '';
  const page = clampInt(req.query.page, 1, 1, 10000);
  const pageSize = clampInt(req.query.pageSize, 15, 1, 100);
  const to = Date.now();

  try {
    const result = await listAiChatAdminRuns({
      user: scope === 'all' ? undefined : email,
      from: to - days * DAY_MS,
      to,
      keyword,
      page,
      pageSize,
    });
    return returnResponse(res, ErrorCode.SUCCESS, {
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      scope,
      days,
    }, '');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `运行列表查询失败：${(err as Error).message}`);
  }
});

/**
 * 查询单次运行详情（逐轮用量 / 工具调用 / 回话内容）
 * @route GET /runs/:runId
 * @description 非管理员只能读取自己发起的运行，记录不存在或不属于本人时返回 404
 */
router.get('/runs/:runId', async (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const runId = req.params.runId.trim().slice(0, 128);
  if (!runId) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '运行 ID 无效');
  }
  try {
    const detail = await getAiChatAdminRunDetail(runId, canSeeAll(permissions) ? undefined : email);
    if (!detail) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '运行记录不存在');
    }
    return returnResponse(res, ErrorCode.SUCCESS, {
      trace: detail.trace,
      conversation: detail.conversation,
      messages: detail.messages,
    }, '');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `运行详情查询失败：${(err as Error).message}`);
  }
});

export default router;
