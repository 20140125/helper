import { Router, Request, Response } from 'express';
import {
  saveAuthCode,
  getAuthCode,
  consumeAuthCode,
  getAuthTargetEmail,
  getAuthMailFromName,
  createMailTransporter,
  generateAuthCode,
  getDefaultAuthCode,
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

/** 验证码有效期（毫秒） */
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

// ==============================
// POST /api/auth/send-code
// 发送邮箱验证码
// ==============================

/**
 * POST /send-code
 * @description 生成6位验证码并落库，通过 SMTP 发送到用户填写的邮箱，验证码5分钟内有效；
 *   系统配置了默认验证码且邮箱为超管时跳过邮件
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

    // 系统配置里的默认验证码仅对超级管理员邮箱生效，命中时跳过 SMTP
    const defaultCode = isAdminEmail(targetEmail) ? await getDefaultAuthCode() : '';
    const code = defaultCode || generateAuthCode();
    await saveAuthCode(targetEmail, code, Date.now() + AUTH_CODE_TTL_MS);

    if (defaultCode) {
      return returnResponse(res, ErrorCode.SUCCESS, {}, '已启用系统默认验证码，无需发送邮件');
    }

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
 * @description 校验落库验证码，验证通过后签发 JWT Token，并把登录用户写入 hp_users
 * @body {{ email: string; code: string }} 邮箱地址和用户输入的验证码
 * @returns {{ ok: boolean; message: string; token?: string }} 验证结果及 JWT Token
 */
router.post('/verify-code', async (req: Request, res: Response) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !email.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '请输入邮箱地址');
  }

  if (!code) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '请输入验证码');
  }

  const targetEmail = email.trim();
  const record = await getAuthCode(targetEmail);

  // 系统配置的默认验证码仅对超管邮箱生效，且无需先发送邮件
  const configuredDefault = await getDefaultAuthCode();
  const defaultLogin = !!configuredDefault && isAdminEmail(targetEmail) && code.trim() === configuredDefault;

  if (!defaultLogin && !record) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '验证码不存在，请重新发送');
  }

  if (!defaultLogin && record && Date.now() > record.expiresAt) {
    await consumeAuthCode(targetEmail);
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '验证码已过期，请重新发送');
  }

  if (!defaultLogin && record && record.code !== code.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '验证码错误');
  }

  // 先完成登录记录与权限读取，全部成功后才消费验证码：
  // 任何一步失败都保留验证码，用户可直接重试，不会被误报「验证码不存在」
  try {
    await recordUserLogin(targetEmail);
    const token = signJwt(targetEmail);
    const isAdmin = isAdminEmail(targetEmail);
    const permissions = await getUserPermissionsByEmail(targetEmail, isAdmin);
    const roleId = await getUserRoleId(targetEmail, isAdmin);
    await consumeAuthCode(targetEmail);
    // 同步下发 Cookie，让浏览器地址栏直访接口也能识别登录态
    setAuthCookie(res, token);
    return returnResponse(res, ErrorCode.SUCCESS, { token, isAdmin, permissions, roleId }, '登录成功');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '未知错误';
    console.error('[auth] 登录流程失败:', message);
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `登录失败，请重试：${message}`);
  }
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
router.post('/verify-token', async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, 'Token 不存在');
  }

  const payload = verifyJwt(token);

  if (!payload) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, 'Token 无效或已过期');
  }

  // 全局中间件已从 header / cookie 挂载用户；仅 body 传 token 的场景在此兜底，
  // 保证访问日志也能记录本次校验对应的用户名（日志在响应时读取 req.userEmail）
  if (!req.userEmail) req.userEmail = payload.email;

  const isAdmin = isAdminEmail(payload.email);
  const permissions = await getUserPermissionsByEmail(payload.email, isAdmin);
  const roleId = await getUserRoleId(payload.email, isAdmin);

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
 * @description 返回超级管理员邮箱；开发模式额外返回默认验证码供登录页预填，
 *   生产环境不回显，避免公开接口泄露通用验证码
 * @returns {{ ok: boolean; data: { email: string; defaultAuthCode: string }; message: string }}
 */
router.get('/admin-contact', async (_req: Request, res: Response) => {
  const adminEmail = process.env.MAIL_USERNAME ?? '';
  const defaultAuthCode = process.env.NODE_ENV === 'development' ? await getDefaultAuthCode() : '';
  return returnResponse(res, ErrorCode.SUCCESS, { email: adminEmail, defaultAuthCode }, 'success');
});

export default router;
