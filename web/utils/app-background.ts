/**
 * 系统背景图访问层
 * @description 上传图片到 public/uploads、校验站内相对路径，并把配置写入 hp_env_config
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { Request, Response } from 'express';
import { returnResponse, ErrorCode } from './response';
import { readEnvConfigMap, upsertEnvConfig } from './env-config';
import {
  APP_BACKGROUND_CONFIG_KEY,
  APP_BACKGROUND_IMAGE_EXTENSIONS,
  APP_BACKGROUND_IMAGE_MIME_TYPES,
  APP_BACKGROUND_MAX_IMAGE_SIZE,
  APP_BACKGROUND_URL_PATTERN,
  type AppBackgroundConfig,
} from '@/types/app-background';

/** 与通用上传共用的静态目录 */
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * 校验背景图地址是否为站内上传路径
 * @param {string} url - 待校验的地址
 * @returns {boolean} 合法返回 true
 * @description 只允许 /uploads/<文件名>，拒绝外链、协议、路径穿越与 CSS 注入字符
 */
export const isSafeAppBackgroundUrl = (url: string): boolean =>
  APP_BACKGROUND_URL_PATTERN.test(url);

/** 背景图上传专用 multer：只接收白名单图片，文件名由服务端生成 */
export const appBackgroundUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      const safeExt = (APP_BACKGROUND_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? `.${ext}` : '';
      cb(null, `bg-${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`);
    },
  }),
  limits: { fileSize: APP_BACKGROUND_MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const allowed = (APP_BACKGROUND_IMAGE_EXTENSIONS as readonly string[]).includes(ext)
      && (APP_BACKGROUND_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype);
    if (!allowed) {
      cb(new Error('仅支持 JPG / PNG / WEBP / GIF 图片'));
      return;
    }
    cb(null, true);
  },
});

/**
 * 处理背景图上传
 * @param {Request} req - Express 请求
 * @param {Response} res - Express 响应
 * @returns {void} 返回站内相对地址 /uploads/<文件名>
 */
export const handleAppBackgroundUpload = (req: Request, res: Response): void => {
  appBackgroundUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? '图片大小超过限制（最大 5MB）'
        : (err instanceof Error ? err.message : '图片上传失败');
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, message);
    }
    if (!req.file) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '未收到文件，请确认字段名为 file');
    }
    const url = `/uploads/${req.file.filename}`;
    return returnResponse(res, ErrorCode.SUCCESS, { url, name: req.file.originalname }, 'success');
  });
};

/**
 * 读取系统背景配置
 * @returns {Promise<AppBackgroundConfig>} 背景图地址；非法值或数据库异常时返回空串
 */
export const readAppBackground = async (): Promise<AppBackgroundConfig> => {
  try {
    const map = await readEnvConfigMap();
    const url = map[APP_BACKGROUND_CONFIG_KEY] ?? '';
    return { url: isSafeAppBackgroundUrl(url) ? url : '' };
  } catch {
    return { url: '' };
  }
};

/**
 * 保存系统背景配置
 * @param {string} url - 站内背景图地址
 * @returns {Promise<void>} 无返回值
 * @description 只写 hp_env_config，避免长 URL 落入 .env 被 shell 转义破坏
 */
export const saveAppBackground = async (url: string): Promise<void> => {
  if (!isSafeAppBackgroundUrl(url)) throw new Error('非法的背景图地址');
  await upsertEnvConfig({ [APP_BACKGROUND_CONFIG_KEY]: url });
};

/**
 * 清除系统背景，恢复默认主题
 * @returns {Promise<void>} 无返回值
 */
export const clearAppBackground = async (): Promise<void> => {
  await upsertEnvConfig({ [APP_BACKGROUND_CONFIG_KEY]: '' });
};
