import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  formatDate,
  readApiCategories,
  writeApiCategories,
  readApiItems,
  writeApiItems,
} from './utils';
import type {
  ApiCategory,
  CreateApiCategoryBody,
  UpdateApiCategoryBody,
} from '@/types/api-management';

const router = Router();

/** `category_key` 合法格式校验：以 `cat_` 开头 + 小写字母/数字/下划线，最多 64 字符 */
const CATEGORY_KEY_PATTERN = /^cat_[a-z][a-z0-9_]*$/;

/**
 * 获取所有接口分类
 * @route GET /
 */
router.get('/', async (_req: Request, res: Response) => {
  const categories = await readApiCategories();
  return returnResponse(res, ErrorCode.SUCCESS, { categories } as Record<string, unknown>, '');
});

/**
 * 创建接口分类
 * @route POST /
 * @body {CreateApiCategoryBody}
 */
router.post('/', async (req: Request, res: Response) => {
  const { name, description = '', category_key } = req.body as CreateApiCategoryBody;
  if (!name?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：name');
  }
  const categories = await readApiCategories();

  // 派生 / 校验 category_key
  let key = (category_key ?? '').trim();
  if (key) {
    if (key.length > 64 || !CATEGORY_KEY_PATTERN.test(key)) {
      return returnResponse(
        res,
        ErrorCode.BAD_REQUEST,
        {},
        'category_key 格式不合法：需以 cat_ 开头的小写英文/数字/下划线，且不超过 64 字符',
      );
    }
  } else {
    key = `cat_${Date.now()}`;
  }

  // 唯一性校验
  if (categories.some((c) => c.category_key === key)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `category_key 已存在：${key}`);
  }

  const now = formatDate();
  const newCategory: ApiCategory = {
    category_key: key,
    name: name.trim(),
    description,
    created_at: now,
    updated_at: now,
  };
  categories.push(newCategory);
  await writeApiCategories(categories);
  return returnResponse(res, ErrorCode.SUCCESS, { category: newCategory } as Record<string, unknown>, '创建成功');
});

/**
 * 更新接口分类
 * @route PUT /:id
 * @body {UpdateApiCategoryBody}
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body as UpdateApiCategoryBody;
  const categories = await readApiCategories();
  const index = categories.findIndex((c) => c.category_key === id);
  if (index === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '分类不存在');
  }
  if (name !== undefined) categories[index].name = name.trim();
  if (description !== undefined) categories[index].description = description;
  categories[index].updated_at = formatDate();
  await writeApiCategories(categories);
  return returnResponse(res, ErrorCode.SUCCESS, { category: categories[index] } as Record<string, unknown>, '更新成功');
});

/**
 * 删除接口分类
 * @route DELETE /:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const categories = await readApiCategories();
  const index = categories.findIndex((c) => c.category_key === id);
  if (index === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '分类不存在');
  }
  categories.splice(index, 1);
  await writeApiCategories(categories);
  // 同步删除该分类下的所有 API 条目
  const items = (await readApiItems()).filter((item) => item.category_id !== id);
  await writeApiItems(items);
  return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '删除成功');
});

export default router;
