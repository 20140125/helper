/**
 * 缓存数据管理路由
 * @description 管理 13 张 hp_cache_* 表的缓存行：表清单、分页检索、单条读写与删除。
 *   只读接口由 CACHE_VIEW 保护，写入 / 删除由 CACHE_EDIT 保护（server.ts 统一挂载）。
 */
import { Router } from 'express';
import type { Response } from 'express';
import {
  ErrorCode,
  returnResponse,
  listCacheAdminTables,
  listCacheAdminEntries,
  readCacheAdminEntry,
  writeCacheAdminEntry,
  deleteCacheAdminEntry,
  validateCacheAdminWrite,
} from './utils';
import type { CacheAdminWriteBody } from '@/types/cache-admin';

const router = Router();

/** 把异常转换成统一响应 */
const handleError = (res: Response, err: unknown) =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET /tables 列出全部可管理的缓存表 */
router.get('/tables', (_req, res) => {
  try {
    return returnResponse(res, ErrorCode.SUCCESS, { tables: listCacheAdminTables() }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /entries 按表 / 粒度 / 关键字分页检索缓存行 */
router.get('/entries', async (req, res) => {
  const { table, periodType, keyword, limit, offset } = req.query;
  try {
    const result = await listCacheAdminEntries({
      table: typeof table === 'string' ? table : undefined,
      periodType: typeof periodType === 'string' ? periodType : undefined,
      keyword: typeof keyword === 'string' ? keyword : undefined,
      limit: Number(limit) || undefined,
      offset: Number(offset) || undefined,
    });
    return returnResponse(res, ErrorCode.SUCCESS, { result }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /entry 读取单条缓存行全文 */
router.get('/entry', async (req, res) => {
  const table = String(req.query.table ?? '');
  const section = String(req.query.section ?? '');
  const key = String(req.query.key ?? '');
  if (!table || !key) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少表名或缓存键');
  }
  try {
    const result = await readCacheAdminEntry(table, section, key);
    if (!result) return returnResponse(res, ErrorCode.NOT_FOUND, {}, '缓存行不存在');
    return returnResponse(res, ErrorCode.SUCCESS, { result }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route PUT /entry 新增或更新一条缓存行 */
router.put('/entry', async (req, res) => {
  const payload = req.body as CacheAdminWriteBody;
  if (!payload || typeof payload !== 'object') {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '请求体不合法');
  }
  const validationError = validateCacheAdminWrite({
    table: payload.table,
    section: payload.section ?? '',
    key: payload.key,
    body: payload.body,
  });
  if (validationError) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, validationError);
  }
  try {
    await writeCacheAdminEntry({
      table: payload.table,
      section: payload.section ?? '',
      key: payload.key,
      body: payload.body,
    });
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route DELETE /entry 删除一条缓存行 */
router.delete('/entry', async (req, res) => {
  const table = String(req.query.table ?? '');
  const section = String(req.query.section ?? '');
  const key = String(req.query.key ?? '');
  if (!table || !key) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少表名或缓存键');
  }
  try {
    const deleted = await deleteCacheAdminEntry(table, section, key);
    if (!deleted) return returnResponse(res, ErrorCode.NOT_FOUND, {}, '缓存行不存在');
    return returnResponse(res, ErrorCode.SUCCESS, {}, '删除成功');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
