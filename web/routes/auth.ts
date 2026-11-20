import { Router, Request, Response } from 'express';
import {
  codeStore,
  getAuthTargetEmail,
  getAuthMailFromName,
  createMailTransporter,
  generateAuthCode,
  signJwt,
  verifyJwt,
  recordUserLogin,
  isAdminEmail,
  getUserPermissionsByEmail,
  getUserRoleId,
  setAuthCookie,
  clearAuthCookie,
  buildAuthCodeMailHtml,
  returnResponse,
  ErrorCode,
} from './utils';

const router = Router();

// ==============================
// POST /api/auth/send-code
// 发送邮箱验证码
// ==============================

/**
 * POST /send-code
 * @description 生成6位验证码并通过 SMTP 发送到用户填写的邮箱，验证码5分钟内有效
 * @body {{ email: string }} 接收验证码的邮箱地址
 * @returns {{ ok: boolean; message: string }} 发送结果
 */
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    const fromName = getAuthMailFromName();

    if (!email || !email.trim()) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '请输入邮箱地址');
    }

    const targetEmail = email.trim();

    const code = generateAuthCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效期

    codeStore.set(targetEmail, { code, expiresAt });

    const senderEmail = getAuthTargetEmail();
    const transporter = createMailTransporter();
    await transporter.sendMail({
      from: `"${fromName}" <${senderEmail}>`,
      to: targetEmail,
      subject: '【智能提醒管理平台】登录验证码',
      html: buildAuthCodeMailHtml(code),
    });

    return returnResponse(res, ErrorCode.SUCCESS, {}, '验证码已发送');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '未知错误';
    console.error('[auth] 发送验证码失败:', message);
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `发送失败：${message}`);
  }
});

// ==============================
// POST /api/auth/verify-code
// 验证登录验证码
// ==============================

/**
 * POST /verify-code
 * @description 校验用户输入的验证码，验证通过后签发 JWT Token，并记录用户登录信息
 * @body {{ email: string; code: string }} 邮箱地址和用户输入的验证码
 * @returns {{ ok: boolean; message: string; token?: string }} 验证结果及 JWT Token
 */
router.post('/verify-code', (req: Request, res: Response) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !email.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '请输入邮箱地址');
  }

  if (!code) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '请输入验证码');
  }

  const targetEmail = email.trim();
  const record = codeStore.get(targetEmail);

  if (!record) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '验证码不存在，请重新发送');
  }

  if (Date.now() > record.expiresAt) {
    codeStore.delete(targetEmail);
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '验证码已过期，请重新发送');
  }

  if (record.code !== code.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '验证码错误');
  }

  codeStore.delete(targetEmail);

  // 记录用户登录信息到 JSON 文件
  recordUserLogin(targetEmail);

  // 签发 JWT Token
  const token = signJwt(targetEmail);
  const isAdmin = isAdminEmail(targetEmail);

  const permissions = getUserPermissionsByEmail(targetEmail, isAdmin);
  const roleId = getUserRoleId(targetEmail, isAdmin);
  // 同步下发 Cookie，让浏览器地址栏直访接口也能识别登录态
  setAuthCookie(res, token);
  return returnResponse(res, ErrorCode.SUCCESS, { token, isAdmin, permissions, roleId }, '登录成功');
});

// ==============================
// POST /api/auth/verify-token
// 验证 JWT Token 有效性
// ==============================

/**
 * POST /verify-token
 * @description 验证客户端携带的 JWT Token 是否有效，用于页面初始化时恢复登录状态
 * @body {{ token: string }} JWT Token 字符串
 * @returns {{ ok: boolean; email?: string; message: string }} 验证结果
 */
router.post('/verify-token', (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, 'Token 不存在');
  }

  const payload = verifyJwt(token);

  if (!payload) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, 'Token 无效或已过期');
  }

  const isAdmin = isAdminEmail(payload.email);
  const permissions = getUserPermissionsByEmail(payload.email, isAdmin);
  const roleId = getUserRoleId(payload.email, isAdmin);

  // Token 验证通过同时刷新 Cookie，保证存量用户也能享受地址栏直访能力
  setAuthCookie(res, token);

  return returnResponse(res, ErrorCode.SUCCESS, { email: payload.email, isAdmin, permissions, roleId }, 'Token 有效');
});

// ==============================
// POST /api/auth/logout
// 退出登录：清除服务端 Cookie
// ==============================

/**
 * POST /logout
 * @description 清除鉴权 Cookie（localStorage 由前端自行清理）
 * @returns {{ code: 0; message: string }}
 */
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  return returnResponse(res, ErrorCode.SUCCESS, {}, '退出成功');
});

// ==============================
// GET /api/auth/admin-contact
// 获取超级管理员联系邮箱（公开接口，无需鉴权）
// ==============================

/**
 * GET /admin-contact
 * @description 返回超级管理员的邮箱地址，供无权限页面展示联系方式
 * @returns {{ ok: boolean; data: { email: string }; message: string }}
 */
router.get('/admin-contact', (_req: Request, res: Response) => {
  const adminEmail = process.env.MAIL_USERNAME ?? '';
  return returnResponse(res, ErrorCode.SUCCESS, { email: adminEmail }, 'success');
});

export default router;
