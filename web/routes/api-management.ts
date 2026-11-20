import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  formatDate,
  readApiCategories,
  readApiItems,
  writeApiItems,
  executeProxyRequest,
} from './utils';
import type {
  ApiItem,
  CreateApiItemBody,
  UpdateApiItemBody,
  ExecuteApiBody,
} from '@/types/api-management';

const router = Router();

// ==============================
// API 条目 CRUD
// ==============================

/**
 * 获取所有 API 条目
 * @route GET /
 * @query category_id - 可选，按分类过滤
 */
router.get('/', (req: Request, res: Response) => {
  const { category_id } = req.query as { category_id?: string };
  let items = readApiItems();
  if (category_id) {
    items = items.filter((item) => item.category_id === category_id);
  }
  return returnResponse(res, ErrorCode.SUCCESS, { items } as Record<string, unknown>, '');
});

/**
 * 创建 API 条目
 * @route POST /
 * @body {CreateApiItemBody}
 */
router.post('/', (req: Request, res: Response) => {
  const { category_id, name, method, path: apiPath, description = '', enabled = true, item_key } = req.body as CreateApiItemBody;
  if (!category_id || !name?.trim() || !method || !apiPath?.trim() || !item_key) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：category_id、name、method、path、item_key');
  }
  const categories = readApiCategories();
  if (!categories.find((c) => c.category_key === category_id)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '指定的分类不存在');
  }
  const items = readApiItems();
  const now = formatDate();
  const newItem: ApiItem = {
    item_key,
    category_id,
    name: name.trim(),
    method,
    path: apiPath.trim(),
    description,
    enabled,
    created_at: now,
    updated_at: now,
  };
  items.push(newItem);
  writeApiItems(items);
  return returnResponse(res, ErrorCode.SUCCESS, { item: newItem } as Record<string, unknown>, '创建成功');
});

/**
 * 更新 API 条目
 * @route PUT /:id
 * @body {UpdateApiItemBody}
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { category_id, name, method, path: apiPath, description, enabled } = req.body as UpdateApiItemBody;
  const items = readApiItems();
  const index = items.findIndex((item) => item.item_key === id);
  if (index === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, 'API 条目不存在');
  }
  if (category_id !== undefined) {
    const categories = readApiCategories();
    if (!categories.find((c) => c.category_key === category_id)) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '指定的分类不存在');
    }
    items[index].category_id = category_id;
  }
  if (name !== undefined) items[index].name = name.trim();
  if (method !== undefined) items[index].method = method;
  if (apiPath !== undefined) items[index].path = apiPath.trim();
  if (description !== undefined) items[index].description = description;
  if (enabled !== undefined) items[index].enabled = enabled;
  items[index].updated_at = formatDate();
  writeApiItems(items);
  return returnResponse(res, ErrorCode.SUCCESS, { item: items[index] } as Record<string, unknown>, '更新成功');
});

/**
 * 删除 API 条目
 * @route DELETE /:id
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const items = readApiItems();
  const index = items.findIndex((item) => item.item_key === id);
  if (index === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, 'API 条目不存在');
  }
  items.splice(index, 1);
  writeApiItems(items);
  return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '删除成功');
});

// ==============================
// API 执行（代理请求）
// ==============================

/**
 * 执行 API 请求（服务端代理）
 * @route POST /execute
 * @body {ExecuteApiBody}
 * @description 代理执行用户指定的 HTTP 请求，返回响应状态码、响应头和响应体
 */
router.post('/execute', async (req: Request, res: Response) => {
  const payload = req.body as ExecuteApiBody;
  if (!payload.url?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：url');
  }

  const result = await executeProxyRequest(payload);
  if ('error' in result) {
    const isBadUrl = result.error === 'URL 格式不正确';
    const code = isBadUrl ? ErrorCode.BAD_REQUEST : ErrorCode.INTERNAL_SERVER_ERROR;
    return returnResponse(res, code, {}, result.error);
  }

  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    result as unknown as Record<string, unknown>,
    '',
  );
});

export default router;
