/**
 * 高德地理编码缓存路由
 * @description 独立管理页的列表、新增/更新与删除；只读由 CACHE_VIEW 保护，
 *   写入 / 删除由 CACHE_EDIT 保护（server.ts 统一挂载）。
 */
import { Router } from 'express';
import type { Response } from 'express';
import {
  ErrorCode,
  returnResponse,
  listAmapGeocodeEntries,
  writeAmapGeocodeEntry,
  deleteAmapGeocodeEntry,
  validateAmapGeocodeWrite,
} from './utils';
import type { AmapGeocodeWriteBody } from '@/types/amap-geocode';

const router = Router();

/** 把异常转换成统一响应 */
const handleError = (res: Response, err: unknown) =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET / 按地址关键字列出地理编码缓存 */
router.get('/', async (req, res) => {
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : '';
  try {
    const items = await listAmapGeocodeEntries(keyword);
    return returnResponse(res, ErrorCode.SUCCESS, { items }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route PUT / 新增或更新一条地址坐标 */
router.put('/', async (req, res) => {
  const payload = req.body as AmapGeocodeWriteBody;
  const validationError = validateAmapGeocodeWrite(payload);
  if (validationError) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, validationError);
  }
  try {
    await writeAmapGeocodeEntry(payload);
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route DELETE / 删除一条地址坐标 */
router.delete('/', async (req, res) => {
  const address = String(req.query.address ?? '');
  if (!address) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少地址');
  }
  try {
    const deleted = await deleteAmapGeocodeEntry(address);
    if (!deleted) return returnResponse(res, ErrorCode.NOT_FOUND, {}, '地址不存在');
    return returnResponse(res, ErrorCode.SUCCESS, {}, '删除成功');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
