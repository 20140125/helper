import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { returnResponse, ErrorCode } from './response';
import {
  AI_CHAT_SKIN_IMAGE_EXTENSIONS,
  AI_CHAT_SKIN_IMAGE_MIME_TYPES,
  AI_CHAT_SKIN_MAX_IMAGE_SIZE,
} from '@/types/ai-chat-skin';

/** 通用上传目录：public/uploads（静态文件服务可直接访问） */
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

/** multer 实例，限制文件大小 10MB */
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * 处理单文件上传请求
 * @param {Request} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 */
export const handleFileUpload = (req: Request, res: Response): void => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文件大小超过限制（最大 10MB）');
      }
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `上传错误：${err.message}`);
    }

    if (err) {
      return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, '文件上传失败，请稍后重试');
    }

    if (!req.file) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '未收到文件，请确认字段名为 file');
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/uploads/${req.file.filename}`;

    return returnResponse(res, ErrorCode.SUCCESS, { url, name: req.file.originalname }, 'success');
  });
};

/**
 * 把上传文件归一化为白名单内的图片 MIME
 * @param {string} mimetype - 浏览器声明的 MIME
 * @param {string} originalname - 原始文件名
 * @returns {string} 归一化后的 MIME
 * @description jpg 统一为 image/jpeg，避免扩展名与声明不一致时生成非法 data URL
 */
const normalizeImageMime = (mimetype: string, originalname: string): string => {
  const ext = path.extname(originalname).slice(1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return mimetype;
};

/**
 * 贾维斯皮肤背景图上传专用 multer
 * @description 图片本体入库，不再落 public/uploads 磁盘，因此用 memoryStorage 直接拿 buffer
 */
export const skinImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AI_CHAT_SKIN_MAX_IMAGE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const allowed = (AI_CHAT_SKIN_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
    if (!file.mimetype.startsWith('image/') || !allowed) {
      cb(new Error('仅支持 JPG / PNG / WEBP / GIF 图片'));
      return;
    }
    cb(null, true);
  },
});

/**
 * 处理贾维斯皮肤背景图上传
 * @param {Request} req - Express 请求对象
 * @param {Response} res - Express 响应对象
 * @description 返回 data:image/...;base64,... 图片本体，由前端随配置 PUT 写进数据库
 */
export const handleSkinBackgroundUpload = (req: Request, res: Response): void => {
  skinImageUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? '图片大小超过限制（最大 5MB）'
        : (err instanceof Error ? err.message : '图片上传失败');
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, message);
    }
    if (!req.file?.buffer) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '未收到文件，请确认字段名为 file');
    }
    const mime = normalizeImageMime(req.file.mimetype, req.file.originalname);
    if (!(AI_CHAT_SKIN_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '仅支持 JPG / PNG / WEBP / GIF 图片');
    }
    const url = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    return returnResponse(res, ErrorCode.SUCCESS, { url, name: req.file.originalname }, 'success');
  });
};
