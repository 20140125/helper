/** 允许上传的背景图 MIME（与后端 APP_BACKGROUND_IMAGE_MIME_TYPES 对齐） */
export const APP_BACKGROUND_IMAGE_TYPES: string[] = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
];

/** 背景图大小上限（5MB，与后端 APP_BACKGROUND_MAX_IMAGE_SIZE 对齐） */
export const APP_BACKGROUND_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 原生文件选择器的 accept 值 */
export const APP_BACKGROUND_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/** 合法的站内背景图地址，用于把 URL 拼进 CSS 前二次校验 */
export const APP_BACKGROUND_URL_PATTERN = /^\/uploads\/[A-Za-z0-9._-]+$/;
