// ==============================
// 系统背景图相关类型与常量
// @description 图片本体存 hp_app_background（LONGBLOB），对外只暴露站内短地址；
//   旧版 hp_env_config.APP_BACKGROUND_URL 仅用于启动时一次性迁移
// ==============================

/** 旧版背景图配置在 hp_env_config 中的键名（迁移用，不再写入） */
export const APP_BACKGROUND_CONFIG_KEY = 'APP_BACKGROUND_URL';

/** 允许的图片扩展名 */
export const APP_BACKGROUND_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;

/** 允许的图片 MIME */
export const APP_BACKGROUND_IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
] as const;

/** 单张背景图上限（5MB） */
export const APP_BACKGROUND_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** data URL 字符串上限（5MB 图片 base64 后约 6.8MB，留余量） */
export const APP_BACKGROUND_MAX_DATA_URL_CHARS = 8 * 1024 * 1024;

/** 保存接口请求体上限，必须在全局 express.json() 之前放宽 */
export const APP_BACKGROUND_BODY_LIMIT = '8mb';

/** 图片本体 data URL 白名单，避免任意字符串写进数据库与 CSS */
export const APP_BACKGROUND_DATA_URL_PATTERN =
  /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/i;

/** 库内图片对外短地址前缀（拼内容 MD5，URL 自带版本，可长缓存） */
export const APP_BACKGROUND_IMAGE_URL_PREFIX = '/uploads/appbg-';

/** 合法的站内背景图地址，避免把任意 URL 拼进 CSS url() */
export const APP_BACKGROUND_URL_PATTERN = /^\/uploads\/[A-Za-z0-9._-]+$/;

/** 系统背景配置 */
export interface AppBackgroundConfig {
  /** 背景图站内短地址，空串表示使用默认主题 */
  url: string;
}
