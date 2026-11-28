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

/** 由专用模块维护的键：禁止通过缓存管理页直接覆盖 */
const DB_BACKED_CACHE_FILES = RESERVED_CACHE_FILES;

const router = Router();

/**
 * GET /
 * 获取缓存条目列表，按更新时间降序排列
 * @returns {{ ok: true, files: CacheFileInfo[] }} 条目列表
 */
router.get('/', async (_req, res) => {
  try {
    const files = await listCacheFiles(CACHE_DIR);
    return returnResponse(res, ErrorCode.SUCCESS, { files }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

/**
 * GET /:filename(*)
 * 读取指定缓存条目的内容（键可包含子目录，如 api_responses/foo.json）
 * @param filename - 缓存键，必须以 .json 结尾
 * @returns {{ ok: true, content: string }} 内容字符串
 * @returns {{ ok: false, message: string }} 键非法（400）/ 不存在（404）/ 读取失败（500）
 */
router.get('/:filename(*)', async (req, res) => {
  const { filename } = req.params;
  if (!isValidFilename(filename)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '非法文件名');
  }
  try {
    const result = await readCacheFile(CACHE_DIR, filename);
    if ('notFound' in result) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '条目不存在');
    }
    if ('error' in result) {
      return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, result.error);
    }
    return returnResponse(res, ErrorCode.SUCCESS, { content: result.content }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

/**
 * PUT /:filename(*)
 * 更新指定缓存条目的内容（仅接受合法 JSON 字符串）
 * @param filename - 缓存键
 * @body {{ content: string }} 合法的 JSON 字符串
 * @returns {{ ok: true, message: string }} 保存成功
 * @returns {{ ok: false, message: string }} 参数校验失败（400）/ 条目不存在（404）/ 写入失败（500）
 */
router.put('/:filename(*)', async (req, res) => {
  const { filename } = req.params;
  const { content } = req.body as { content?: unknown };

  const validationError = validateCacheWriteParams(filename, content);
  if (validationError) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, validationError);
  }

  // 由专用模块维护的键不允许通过缓存接口直接覆盖
  if (DB_BACKED_CACHE_FILES.includes(filename)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '该条目由专用模块维护，禁止直接覆盖');
  }

  try {
    const writeError = await writeCacheFile(CACHE_DIR, filename, content as string);
    if (writeError) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, writeError);
    }
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
