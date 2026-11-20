import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { returnResponse, ErrorCode } from './response';

/** 上传目录：public/uploads（静态文件服务可直接访问） */
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
