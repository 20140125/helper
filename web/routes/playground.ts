import { Router, type Request, type Response } from 'express';
import {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplateFields,
  deleteTemplateById,
  parseAndValidateFields,
  type PlaygroundTemplateInput,
  returnResponse,
  ErrorCode,
} from './utils';

const router = Router();

// ==============================
// GET /api/playground
// 获取全部模板列表
// ==============================

/**
 * GET /
 * @description 返回 hp_playground_templates 中的全部模板列表（按 sort_order 升序）
 * @returns {{ code: 0, data: { data: TemplateData[] }, message: string }} 模板列表
 * @returns {{ code: 500, data: {}, message: string }} 读取失败（500）
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await listTemplates();
    return returnResponse(res, ErrorCode.SUCCESS, { data }, 'success');
  } catch (err) {
    return returnResponse(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {},
      err instanceof Error ? err.message : '读取模板失败',
    );
  }
});

// ==============================
// POST /api/playground
// 向模板列表末尾追加一个新模板
// ==============================

/**
 * POST /
 * @description 向 hp_playground_templates 追加一个新模板（自动生成 id，排到列表末尾）
 * @body {{ template: { label: string; fields: unknown[] } }} 要新增的模板
 * @returns {{ code: 0, data: { id: string }, message: string }} 新增成功
 * @returns {{ code: number, data: {}, message: string }} 参数校验失败（400）或写入失败（500）
 */
router.post('/', async (req: Request, res: Response) => {
  const { template } = req.body as { template?: unknown };

  if (
    !template
    || typeof template !== 'object'
    || typeof (template as Record<string, unknown>).label !== 'string'
    || !Array.isArray((template as Record<string, unknown>).fields)
  ) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '参数 template 必须包含 label（字符串）和 fields（数组）');
  }

  const tpl = template as PlaygroundTemplateInput;
  try {
    const id = await createTemplate({
      label: tpl.label,
      fields: tpl.fields,
      id: tpl.id,
      category: typeof tpl.category === 'string' ? tpl.category : undefined,
    });
    return returnResponse(res, ErrorCode.SUCCESS, { id }, '新增成功');
  } catch (err) {
    return returnResponse(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {},
      err instanceof Error ? err.message : '新增模板失败',
    );
  }
});

// ==============================
// GET /api/playground/:id
// 按 id 获取单个模板
// ==============================

/**
 * GET /:id
 * @description 从 hp_playground_templates 中按 id 获取指定模板
 * @param id - 模板唯一标识
 * @returns {{ code: 0, data: { data: TemplateData }, message: string }} 模板数据
 * @returns {{ code: number, data: {}, message: string }} 未找到（404）或读取失败（500）
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const data = await getTemplateById(id);
    if (!data) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, `找不到 id 为 "${id}" 的模板`);
    }
    return returnResponse(res, ErrorCode.SUCCESS, { data }, 'success');
  } catch (err) {
    return returnResponse(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {},
      err instanceof Error ? err.message : '读取模板失败',
    );
  }
});

// ==============================
// DELETE /api/playground/:id
// 按 id 删除指定模板
// ==============================

/**
 * DELETE /:id
 * @description 从 hp_playground_templates 中按 id 删除指定模板
 * @param id - 模板唯一标识
 * @returns {{ code: 0, data: {}, message: string }} 删除成功
 * @returns {{ code: number, data: {}, message: string }} 未找到（400）或删除失败（500）
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await deleteTemplateById(id);
    if (!deleted) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `找不到 id 为 "${id}" 的模板`);
    }
    return returnResponse(res, ErrorCode.SUCCESS, {}, '删除成功');
  } catch (err) {
    return returnResponse(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {},
      err instanceof Error ? err.message : '删除模板失败',
    );
  }
});

// ==============================
// PUT /api/playground/:id
// 按 id 更新指定模板的 fields
// ==============================

/**
 * PUT /:id
 * @description 将编辑器中修改后的 fields JSON 写回 hp_playground_templates
 * @param id - 模板唯一标识
 * @body {{ fields: string }} 合法的 JSON 数组字符串
 * @returns {{ code: 0, data: {}, message: string }} 保存成功
 * @returns {{ code: number, data: {}, message: string }} 参数校验失败（400）或保存失败（500）
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const fieldsResult = parseAndValidateFields((req.body as { fields?: unknown }).fields);
  if (fieldsResult.code !== 0) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, fieldsResult.message);
  }

  try {
    const updated = await updateTemplateFields(id, fieldsResult.data);
    if (!updated) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `找不到 id 为 "${id}" 的模板`);
    }
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return returnResponse(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {},
      err instanceof Error ? err.message : '保存模板失败',
    );
  }
});

export default router;
