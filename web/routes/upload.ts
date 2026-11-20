import { Router } from 'express';
import { handleFileUpload } from './utils';

const router = Router();

// ==============================
// POST /api/upload/file
// 上传单个文件
// ==============================

/**
 * POST /file
 * @description 上传单个文件，保存到 public/uploads 目录，返回可访问的文件 URL
 * @body multipart/form-data，字段名为 file
 * @returns {{ code: number, data: { url: string; name: string }, message: string }} 上传结果
 */
router.post('/file', handleFileUpload);

export default router;
