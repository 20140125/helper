import type { Request, Response, NextFunction, Router } from 'express';
import { Permission, type RoutePermissionConfig } from '@/types/permission';
import { verifyJwt, isAdminEmail } from './auth';
import { getUserAuthInfo } from './rbac';
import { returnResponse, ErrorCode } from './response';
export type { RoutePermissionConfig } from '@/types/permission';

// ==============================
// Express Request 扩展
// ==============================

/**
 * 扩展 Express Request 接口，附加用户信息
 * @description JWT 中间件解析成功后，将用户邮箱和权限列表挂到 req 上
 */
declare global {
  namespace Express {
    interface Request {
      /** 当前登录用户的邮箱 */
      userEmail?: string;
      /** 当前用户的权限码列表 */
      userPermissions?: Permission[];
      /** 当前用户是否为超级管理员（MAIL_USERNAME） */
      userIsAdmin?: boolean;
      /** 当前用户的角色 ID */
      userRoleId?: string;
    }
  }
}

// ==============================
// 权限中间件
// ==============================

/**
 * 从 Cookie 头中解析指定 cookie 的值
 * @description 与 server.ts 顶层鉴权中间件保持一致，避免新增依赖；地址栏直访场景仅有 Cookie，无 Authorization Header
 * @param cookieHeader - 原始 Cookie 头
 * @param name - cookie 名
 * @returns 解码后的 cookie 值；不存在返回 null
 */
export const readCookie = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;
  const segments = cookieHeader.split(';');
  for (const seg of segments) {
    const idx = seg.indexOf('=');
    if (idx === -1) continue;
    const key = seg.slice(0, idx).trim();
    if (key !== name) continue;
    const value = seg.slice(idx + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
};

/**
 * 从请求中获取认证 token
 * @param req - Express Request
 * @returns token 字符串；不存在返回 null
 */
export const getAuthToken = (req: Request): string | null => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = readCookie(req.headers.cookie, 'auth_token');
  return headerToken || cookieToken;
};

/**
 * 从请求中解析用户信息并挂载到 req 上
 * @description 在 JWT 鉴权中间件通过后调用，提取 email → 查 RBAC 配置 → 计算权限列表
 *              token 取值优先级：Authorization Header > auth_token Cookie（兼容浏览器地址栏直访）
 */
export const attachUserInfo = async (req: Request): Promise<void> => {
  const token = getAuthToken(req);
  if (!token) return;

  const payload = verifyJwt(token);
  if (!payload) return;

  const isSuperAdmin = isAdminEmail(payload.email);
  req.userEmail = payload.email;
  req.userIsAdmin = isSuperAdmin;
  const authInfo = await getUserAuthInfo(payload.email, isSuperAdmin);
  req.userRoleId = authInfo.roleId;
  req.userPermissions = authInfo.permissions;
};

/**
 * 权限校验中间件工厂函数（单路由级别使用）
 * @param requiredPermission - 当前接口所需的权限码
 * @returns Express 中间件
 * @description 检查 req.userPermissions 中是否包含所需权限，不具备则返回 403
 *
 * @example
 * ```ts
 * router.post('/start', requirePermission(Permission.DAEMON_EDIT), (_req, res) => {
 *   // 仅 admin 可执行
 * });
 * ```
 */
export const requirePermission = (requiredPermission: Permission) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const permissions = req.userPermissions ?? [];
    if (!permissions.includes(requiredPermission)) {
      returnResponse(res, ErrorCode.FORBIDDEN, { requiredPermission }, '权限不足，无法执行此操作');
      return;
    }
    next();
  };

// ==============================
// 路由级权限配置
// ==============================

/** 只读 HTTP 方法 */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 为一个路由模块包裹读写权限中间件
 * @param router   - Express Router 实例
 * @param config   - 读写权限配置
 * @returns 包裹后的 Router（原 router 不受影响，返回一个新的包装 Router）
 *
 * @example
 * ```ts
 * // server.ts 中使用
 * app.use('/api/config', withPermission(configRouter, {
 *   read:  Permission.CONFIG_VIEW,
 *   write: Permission.CONFIG_EDIT,
 * }));
 *
 * // 带 readPaths 的使用
 * app.use('/api/templates', ...withPermission(templatesRouter, {
 *   read:  Permission.TEMPLATES_VIEW,
 *   write: Permission.TEMPLATES_EDIT,
 *   readPaths: ['/preview'],  // POST /preview 视为只读
 * }));
 * ```
 */
export const withPermission = (router: Router, config: RoutePermissionConfig): Router[] => {
  const readPathSet = config.readPaths ? new Set(config.readPaths) : null;

  const guard = (req: Request, res: Response, next: NextFunction): void => {
    const isRead = READ_METHODS.has(req.method)
      || (readPathSet !== null && readPathSet.has(req.path));
    const required = isRead ? config.read : config.write;

    // 没配置对应权限码 → 不拦截
    if (!required) {
      next();
      return;
    }

    const permissions = req.userPermissions ?? [];
    if (!permissions.includes(required)) {
      returnResponse(res, ErrorCode.FORBIDDEN, { requiredPermission: required }, '权限不足，无法执行此操作');
      return;
    }
    next();
  };

  // 返回 [guard, router]，供 app.use(path, ...withPermission(router, config)) 展开使用
  return [guard as unknown as Router, router];
};
