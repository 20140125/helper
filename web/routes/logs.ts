import { Router } from 'express';
import {
  returnResponse,
  ErrorCode,
  listLogFiles,
  isLogKeyValid,
  readLogTail,
  clearLogFile,
} from './utils';

const router = Router();

/**
 * 获取所有日志来源列表
 * @route GET /logs
 * @returns 日志来源列表（按最近写入时间倒序），包含 key、filename、exists、size、mtime
 */
router.get('/', async (_req, res) => {
  try {
    const logs = await listLogFiles();
    return returnResponse(res, ErrorCode.SUCCESS, { logs }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `日志查询失败：${(err as Error).message}`);
  }
});

/**
 * 读取指定日志文件的内容
 * @route GET /logs/:key
 * @param key 日志来源标识，需在 LOG_SOURCES 中注册
 * @query lines 读取的行数，默认 100
 * @returns 日志文件内容字符串；文件尚未生成时返回空字符串
 */
router.get('/:key', async (req, res) => {
  const { key } = req.params;
  const lines = parseInt(req.query['lines'] as string || '100', 10);

  if (!isLogKeyValid(key)) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '日志文件不存在');
  }

  const result = await readLogTail(key, lines);

  if ('missing' in result) {
    return returnResponse(res, ErrorCode.SUCCESS, { content: '' }, '日志文件尚未生成');
  }
  if ('error' in result) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, result.error);
  }
  return returnResponse(res, ErrorCode.SUCCESS, { content: result.content }, 'success');
});

/**
 * 清空指定来源的日志记录
 * @route DELETE /logs/:key
 * @param key 日志来源标识，需在 LOG_SOURCES 中注册（或为库里已存在的来源名）
 * @returns 操作结果
 */
router.delete('/:key', async (req, res) => {
  const { key } = req.params;
  if (!isLogKeyValid(key)) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '日志来源不存在');
  }
  try {
    const removed = await clearLogFile(key);
    return returnResponse(res, ErrorCode.SUCCESS, { removed }, `已删除 ${removed} 条日志记录`);
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `日志清空失败：${(err as Error).message}`);
  }
});

export default router;
