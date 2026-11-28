import { Router } from 'express';
import {
  returnResponse,
  ErrorCode,
  DEFAULT_LOG_PAGE_SIZE,
  listLogSources,
  isLogSourceValid,
  readSourceLogRows,
  clearLogSource,
  listRunLogRows,
  getRunLogById,
} from './utils';

const router = Router();

/**
 * 获取库里实际存在的日志来源
 * @route GET /logs
 * @returns 按最近写入时间倒序的来源统计（source / rows / bytes / latest）
 */
router.get('/', async (_req, res) => {
  try {
    const logs = await listLogSources();
    return returnResponse(res, ErrorCode.SUCCESS, { logs }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `日志来源查询失败：${(err as Error).message}`);
  }
});

/**
 * 分页查询运行日志记录
 * @route GET /logs/rows
 * @query page 页码，默认 1
 * @query pageSize 每页条数，默认 15，最大 100
 * @query source / sourceType / level / keyword 可选筛选条件
 * @returns 当前页日志记录、总条数与分页信息
 */
router.get('/rows', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(
    1,
    Number.parseInt(String(req.query['pageSize'] ?? String(DEFAULT_LOG_PAGE_SIZE)), 10) || DEFAULT_LOG_PAGE_SIZE,
  ));
  const source = typeof req.query['source'] === 'string' ? req.query['source'].trim().slice(0, 64) : '';
  const sourceType = typeof req.query['sourceType'] === 'string' ? req.query['sourceType'].trim().slice(0, 24) : '';
  const level = typeof req.query['level'] === 'string' ? req.query['level'].trim().slice(0, 32) : '';
  const keyword = typeof req.query['keyword'] === 'string' ? req.query['keyword'].trim().slice(0, 100) : '';

  try {
    const result = await listRunLogRows({ page, pageSize, source, sourceType, level, keyword });
    return returnResponse(res, ErrorCode.SUCCESS, {
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `日志查询失败：${(err as Error).message}`);
  }
});

/**
 * 查询单条日志详情
 * @route GET /logs/rows/:id
 * @param id 日志记录 ID
 * @returns 含链路 ID、关联用户的完整日志记录
 */
router.get('/rows/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '日志 ID 无效');
  }
  try {
    const row = await getRunLogById(id);
    if (!row) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '日志记录不存在');
    }
    return returnResponse(res, ErrorCode.SUCCESS, { row }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `日志详情查询失败：${(err as Error).message}`);
  }
});

/**
 * 读取指定来源末尾 N 条日志
 * @route GET /logs/:source
 * @param source hp_run_logs.source 原值
 * @query lines 读取条数，默认 100，最大 500
 * @returns 渲染后的日志内容字符串；该来源暂无记录时返回空字符串
 */
router.get('/:source', async (req, res) => {
  const { source } = req.params;
  const lines = Math.min(500, Math.max(1, Number.parseInt(String(req.query['lines'] ?? '100'), 10) || 100));

  if (!isLogSourceValid(source)) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '日志来源不存在');
  }

  const result = await readSourceLogRows(source, lines);

  if ('missing' in result) {
    return returnResponse(res, ErrorCode.SUCCESS, { content: '' }, '该来源暂无日志记录');
  }
  if ('error' in result) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, result.error);
  }
  return returnResponse(res, ErrorCode.SUCCESS, { content: result.content }, 'success');
});

/**
 * 清空指定来源的库记录
 * @route DELETE /logs/:source
 * @param source hp_run_logs.source 原值
 * @returns 删除的记录数
 */
router.delete('/:source', async (req, res) => {
  const { source } = req.params;
  if (!isLogSourceValid(source)) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '日志来源不存在');
  }
  try {
    const removed = await clearLogSource(source);
    return returnResponse(res, ErrorCode.SUCCESS, { removed }, `已删除 ${removed} 条日志记录`);
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `日志清空失败：${(err as Error).message}`);
  }
});

export default router;
