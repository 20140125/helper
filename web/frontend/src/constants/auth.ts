/**
 * 鉴权相关常量
 * @description 集中管理鉴权模块在多处复用的常量，避免字符串硬编码散落
 */

/**
 * JWT Token 在 localStorage 中的存储 key
 * @description 被 http 拦截器、auth store、auto-upload 组件等多处共用，修改时只需改动此处
 */
export const AUTH_STORAGE_KEY = 'helper_auth_token';
