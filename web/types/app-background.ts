// ==============================
// 系统背景图相关类型与常量
// @description 配置值存 hp_env_config，图片落 public/uploads，只接受站内相对路径
// ==============================

/** 背景图配置在 hp_env_config 中的键名 */
export const APP_BACKGROUND_CONFIG_KEY = 'APP_BACKGROUND_URL';

/** 允许的图片扩展名 */
export const APP_BACKGROUND_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;

/** 允许的图片 MIME */
export const APP_BACKGROUND_IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
] as const;

/** 单张背景图上限（5MB） */
export const APP_BACKGROUND_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 合法的站内背景图地址，避免把任意 URL 拼进 CSS url() */
export const APP_BACKGROUND_URL_PATTERN = /^\/uploads\/[A-Za-z0-9._-]+$/;

/** 系统背景配置 */
export interface AppBackgroundConfig {
  /** 背景图地址，空串表示使用默认主题 */
  url: string;
}
