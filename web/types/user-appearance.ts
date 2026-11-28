// ==============================
// 按用户外观偏好相关类型与常量
// @description 遮挡层不透明度按 JWT 用户邮箱隔离，存 hp_user_appearance
// ==============================

/** 遮挡层不透明度默认值（%），与原卡片 color-mix 的 86% 保持一致 */
export const USER_APPEARANCE_SURFACE_OPACITY_DEFAULT = 86;

/** 遮挡层不透明度下限（%），低于此值内容可读性过差 */
export const USER_APPEARANCE_SURFACE_OPACITY_MIN = 20;

/** 遮挡层不透明度上限（%） */
export const USER_APPEARANCE_SURFACE_OPACITY_MAX = 100;

/** 按用户外观偏好配置 */
export interface UserAppearanceConfig {
  /** 系统背景图遮挡层（卡片 / 顶栏 / 侧栏）不透明度，取值 20–100 */
  surfaceOpacity: number;
}

/** 保存外观偏好的请求体 */
export interface UserAppearanceBody {
  /** 遮挡层不透明度，路由内必须校验后再写库 */
  surfaceOpacity?: unknown;
}
