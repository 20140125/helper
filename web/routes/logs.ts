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
 * 获取所有日志文件列表
 * @route GET /logs
 * @returns 日志文件信息列表（按修改时间倒序），包含 key、filename、exists、size、mtime
 */
router.get('/', (_req, res) => {
  const logs = listLogFiles();
  return returnResponse(res, ErrorCode.SUCCESS, { logs }, 'success');
});

/**
 * 读取指定日志文件的内容
 * @route GET /logs/:key
 * @param key 日志文件标识符，需在 LOG_FILES 中定义
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
 * 清空指定日志文件内容
 * @route DELETE /logs/:key
 * @param key 日志文件标识符，需在 LOG_FILES 中定义
 * @returns 操作结果
 */
router.delete('/:key', (req, res) => {
  const { key } = req.params;
  if (!isLogKeyValid(key)) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '日志文件不存在');
  }
  clearLogFile(key);
  return returnResponse(res, ErrorCode.SUCCESS, {}, '日志已清空');
});

export default router;
