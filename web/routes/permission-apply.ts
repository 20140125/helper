import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  requirePermission,
  Permission,
  readPermissionRequests,
  writePermissionRequests,
  createPermissionRequest,
  findPendingRequest,
  approveRequest,
  buildApplyMarkdown,
  buildApprovedMarkdown,
  alreadyResolvedHtml,
  approveSuccessHtml,
  sendApprovalEmail,
  sendRejectionEmail,
  notifyAllWebhooks,
} from './utils';
import type { ApplyPermissionBody, ApprovePermissionBody, RejectPermissionBody } from './utils';
import { formatDate } from '@/utils/script';

// ==============================
// 路由
// ==============================

const router = Router();

/**
 * POST /api/permission-apply/apply
 * @description 已登录用户申请权限，向管理员发送企微通知（需 JWT 鉴权）
 * @body {ApplyPermissionBody}
 */
router.post('/apply', requirePermission(Permission.DASHBOARD_VIEW), async (req: Request, res: Response) => {
  const email = req.userEmail;
  const { fromPath, reason } = req.body as ApplyPermissionBody;

  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, 'Not authenticated');
  }
  if (!fromPath?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'Missing fromPath');
  }

  const store = readPermissionRequests();
  const trimmedPath = fromPath.trim();

  // 已有待处理申请时去重，避免重复通知刷屏
  const existing = store.requests.find(
    (r) => r.email === email && r.fromPath === trimmedPath && r.status === 'pending',
  );

  let requestId: string;
  if (existing) {
    requestId = existing.request_id;
  } else {
    const newRequest = createPermissionRequest(email, trimmedPath, reason);
    requestId = newRequest.request_id;
    store.requests.push(newRequest);
    writePermissionRequests(store);
  }

  const host = `${req.protocol}://${req.get('host')}`;
  const approveUrl = `${host}/api/permission-apply/approve?id=${requestId}&token=${process.env.APPROVE_TOKEN ?? ''}`;
  const markdown = buildApplyMarkdown(email, trimmedPath, approveUrl, reason);

  const notified = await notifyAllWebhooks(markdown);
  if (!notified) {
    console.warn('[permission-apply] 企微通知发送失败或未配置 Webhook');
  }

  return returnResponse(res, ErrorCode.SUCCESS, { requestId }, 'Permission request submitted');
});

/**
 * GET /api/permission-apply/list
 * @description 管理员查询申请列表（需 JWT 鉴权）
 * @query {{ status?: 'pending'|'approved'|'rejected'|'all', page?: number, pageSize?: number }}
 */
router.get('/list', requirePermission(Permission.RBAC_REQUESTS_VIEW), (req: Request, res: Response) => {
  const status = (req.query.status as string) ?? 'all';
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)));

  const store = readPermissionRequests();
  const all = store.requests.slice().reverse(); // 最新在前

  const filtered = status === 'all' ? all : all.filter((r) => r.status === status);
  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pendingCount = store.requests.filter((r) => r.status === 'pending').length;

  return returnResponse(res, ErrorCode.SUCCESS, {
    items,
    total,
    page,
    pageSize,
    pendingCount,
  } as Record<string, unknown>, '');
});

/**
 * POST /api/permission-apply/approve-by-id
 * @description 管理员在前端批准申请（需 JWT 鉴权）
 * @body {ApprovePermissionBody}
 */
router.post('/approve-by-id', requirePermission(Permission.RBAC_REQUESTS_EDIT), async (req: Request, res: Response) => {
  const { id, resolvedBy } = req.body as ApprovePermissionBody;

  if (!id) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'Missing id');
  }

  const store = readPermissionRequests();
  const result = findPendingRequest(store, id);

  if ('error' in result) {
    return returnResponse(res, result.code, {}, result.error);
  }

  const { request } = result;
  approveRequest(request, store, resolvedBy ?? 'admin');

  await sendApprovalEmail(request.email, request.fromPath);
  notifyAllWebhooks(buildApprovedMarkdown(request.email, request.fromPath, request.resolvedBy)).catch(() => {});

  return returnResponse(res, ErrorCode.SUCCESS, { id }, 'Approved');
});

/**
 * POST /api/permission-apply/reject
 * @description 管理员拒绝申请（需 JWT 鉴权）
 * @body {RejectPermissionBody}
 */
router.post('/reject', requirePermission(Permission.RBAC_REQUESTS_EDIT), async (req: Request, res: Response) => {
  const { id, rejectReason, resolvedBy } = req.body as RejectPermissionBody;

  if (!id) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'Missing id');
  }

  const store = readPermissionRequests();
  const result = findPendingRequest(store, id);

  if ('error' in result) {
    return returnResponse(res, result.code, {}, result.error);
  }

  const { request } = result;
  request.status = 'rejected';
  request.resolvedAt = formatDate();
  request.resolvedBy = resolvedBy ?? 'admin';
  request.rejectReason = rejectReason?.trim() ?? '';
  writePermissionRequests(store);

  await sendRejectionEmail(request.email, request.fromPath, request.rejectReason);

  return returnResponse(res, ErrorCode.SUCCESS, { id }, 'Rejected');
});

/**
 * GET /api/permission-apply/approve
 * @description 管理員点击企微通知中的批准链接（需 JWT 鉴权，Token 参数二次校验）
 * @query {{ id: string; token?: string }}
 */
router.get('/approve', async (req: Request, res: Response) => {
  const { id, token } = req.query as { id?: string; token?: string };

  if (!id) {
    res.status(400).send('<h2>❌ Missing request ID</h2>');
    return;
  }

  // 可选 Token 校验（设置 APPROVE_TOKEN 环境变量后启用）
  const approveToken = process.env.APPROVE_TOKEN ?? '';
  if (approveToken && token !== approveToken) {
    res.status(403).send('<h2>🚫 Invalid or missing approve token</h2>');
    return;
  }

  const store = readPermissionRequests();
  const result = findPendingRequest(store, id);

  if ('error' in result) {
    const isNotFound = result.code === ErrorCode.NOT_FOUND;
    const statusCode = isNotFound ? 404 : 200;
    const html = isNotFound
      ? '<h2>❌ Request not found</h2>'
      : alreadyResolvedHtml(store.requests.find((r) => r.request_id === id)!);
    res.status(statusCode).send(html);
    return;
  }

  const { request } = result;
  approveRequest(request, store, 'wecom-link');

  await sendApprovalEmail(request.email, request.fromPath);
  notifyAllWebhooks(buildApprovedMarkdown(request.email, request.fromPath)).catch(() => {});

  res.status(200).send(approveSuccessHtml(request));
});

export default router;
