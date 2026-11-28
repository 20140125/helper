/**
 * 鉴权相关常量
 * @description 集中管理鉴权模块在多处复用的常量，避免字符串硬编码散落
 */

/**
 * JWT Token 在 localStorage 中的存储 key
 * @description 被 http 拦截器、auth store、auto-upload 组件等多处共用，修改时只需改动此处
 */
export const AUTH_STORAGE_KEY = 'helper_auth_token';

/**
 * 后端鉴权 Cookie 可能仍有效的标记 key
 * @description 登录成功（含 token 校验通过）时置位，登出后清除；无 token 且标记不存在时
 *   不再调用 /auth/logout，避免未登录状态下每次刷新都重复发起登出请求
 */
export const AUTH_SESSION_ACTIVE_KEY = 'helper_auth_session_active';
