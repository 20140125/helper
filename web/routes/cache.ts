import { Router } from 'express';
import {
  CACHE_DIR,
  ErrorCode,
  returnResponse,
  isValidFilename,
  validateCacheWriteParams,
  writeCacheFile,
  listCacheFiles,
  readCacheFile,
} from './utils';
import { RESERVED_CACHE_FILES } from '@/utils/cache';

/** 已迁库的文件：禁止通过 /api/cache 直接覆盖（webhooks.json 保留 JSON 镜像仅供 shell 只读） */
const DB_BACKED_CACHE_FILES = RESERVED_CACHE_FILES;

const router = Router();

/**
 * GET /
 * 获取缓存文件列表，按修改时间降序排列
 * @returns {{ ok: true, files: CacheFileInfo[] }} 文件列表
 */
router.get('/', (_req, res) => {
  const files = listCacheFiles(CACHE_DIR);
  return returnResponse(res, ErrorCode.SUCCESS, { files }, 'success');
});

/**
 * GET /:filename(*)
 * 读取指定缓存文件的内容（支持子目录路径，如 api_responses/foo.json）
 * @param filename - 缓存文件名（必须以 .json 结尾，可包含子目录路径）
 * @returns {{ ok: true, content: string }} 文件内容字符串
 * @returns {{ ok: false, message: string }} 文件名非法（400）或文件不存在（404）或读取失败（500）
 */
router.get('/:filename(*)', (req, res) => {
  const { filename } = req.params;
  if (!isValidFilename(filename)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '非法文件名');
  }
  const result = readCacheFile(CACHE_DIR, filename);
  if ('notFound' in result) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '文件不存在');
  }
  if ('error' in result) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, result.error);
  }
  return returnResponse(res, ErrorCode.SUCCESS, { content: result.content }, 'success');
});

/**
 * PUT /:filename(*)
 * 更新指定缓存文件的内容（支持子目录路径，如 api_responses/foo.json，仅接受合法 JSON 字符串）
 * @param filename - 缓存文件名（必须以 .json 结尾，可包含子目录路径）
 * @body {{ content: string }} 合法的 JSON 字符串
 * @returns {{ ok: true, message: string }} 保存成功
 * @returns {{ ok: false, message: string }} 参数校验失败（400）或文件不存在（404）或写入失败（500）
 */
router.put('/:filename(*)', (req, res) => {
  const { filename } = req.params;
  const { content } = req.body as { content?: unknown };

  const validationError = validateCacheWriteParams(filename, content);
  if (validationError) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, validationError);
  }

  // 已迁库的系统文件不允许通过缓存接口直接覆盖
  if (DB_BACKED_CACHE_FILES.includes(filename)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '该文件已迁库，禁止直接覆盖');
  }

  try {
    const writeError = writeCacheFile(CACHE_DIR, filename, content as string);
    if (writeError) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, writeError);
    }
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
