import { Router, type Request, type Response } from 'express';
import { parseAndValidateFields, readTemplates, writeTemplates, returnResponse, ErrorCode } from './utils';

const router = Router();

/**
 * 生成模板 id（基于 label 转 kebab-case，冲突时追加数字后缀）
 */
function generateId(label: string, existingIds: string[]): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    || `template-${Date.now()}`;

  if (!existingIds.includes(base)) return base;

  let suffix = 2;
  while (existingIds.includes(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

// ==============================
// GET /api/playground
// 获取全部模板列表
// ==============================

/**
 * GET /
 * @description 返回 playground-templates.json 中的全部模板列表
 * @returns {{ code: 0, data: { data: TemplateData[] }, message: string }} 模板列表
 * @returns {{ code: 500, data: {}, message: string }} 读取失败（500）
 */
router.get('/', (_req: Request, res: Response) => {
  const result = readTemplates();
  if (result.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, result.message);
  }
  return returnResponse(res, ErrorCode.SUCCESS, { data: result.data }, 'success');
});

// ==============================
// POST /api/playground
// 向模板列表末尾追加一个新模板
// ==============================

/**
 * POST /
 * @description 向 playground-templates.json 末尾追加一个新模板（自动生成 id）
 * @body {{ template: { label: string; fields: unknown[] } }} 要新增的模板
 * @returns {{ code: 0, data: { id: string }, message: string }} 新增成功
 * @returns {{ code: number, data: {}, message: string }} 参数校验失败（400）或写入失败（500）
 */
router.post('/', (req: Request, res: Response) => {
  const { template } = req.body as { template?: unknown };

  if (
    !template
    || typeof template !== 'object'
    || typeof (template as Record<string, unknown>).label !== 'string'
    || !Array.isArray((template as Record<string, unknown>).fields)
  ) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '参数 template 必须包含 label（字符串）和 fields（数组）');
  }

  const readResult = readTemplates();
  if (readResult.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, readResult.message);
  }

  const tpl = template as { label: string; fields: unknown[]; id?: string };
  const existingIds = readResult.data.map((t) => t.id);

  // 如果前端传了 id 就用传的，否则自动生成
  const id = tpl.id && !existingIds.includes(tpl.id)
    ? tpl.id
    : generateId(tpl.label, existingIds);

  const newTemplate = { id, label: tpl.label, fields: tpl.fields };
  const templates = [...readResult.data, newTemplate];
  const writeResult = writeTemplates(templates);
  if (writeResult.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, writeResult.message);
  }

  return returnResponse(res, ErrorCode.SUCCESS, { id }, '新增成功');
});

// ==============================
// GET /api/playground/:id
// 按 id 获取单个模板
// ==============================

/**
 * GET /:id
 * @description 从 playground-templates.json 中按 id 获取指定模板
 * @param id - 模板唯一标识
 * @returns {{ code: 0, data: { data: TemplateData }, message: string }} 模板数据
 * @returns {{ code: number, data: {}, message: string }} 未找到（404）或读取失败（500）
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const readResult = readTemplates();
  if (readResult.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, readResult.message);
  }

  const template = readResult.data.find((t) => t.id === id);
  if (!template) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, `找不到 id 为 "${id}" 的模板`);
  }

  return returnResponse(res, ErrorCode.SUCCESS, { data: template }, 'success');
});

// ==============================
// DELETE /api/playground/:id
// 按 id 删除指定模板
// ==============================

/**
 * DELETE /:id
 * @description 从 playground-templates.json 中按 id 删除指定模板
 * @param id - 模板唯一标识
 * @returns {{ code: 0, data: {}, message: string }} 删除成功
 * @returns {{ code: number, data: {}, message: string }} 参数校验失败（400）或写入失败（500）
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const readResult = readTemplates();
  if (readResult.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, readResult.message);
  }

  const index = readResult.data.findIndex((t) => t.id === id);
  if (index === -1) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `找不到 id 为 "${id}" 的模板`);
  }

  const templates = readResult.data.filter((t) => t.id !== id);
  const writeResult = writeTemplates(templates);
  if (writeResult.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, writeResult.message);
  }

  return returnResponse(res, ErrorCode.SUCCESS, {}, '删除成功');
});

// ==============================
// PUT /api/playground/:id
// 按 id 更新指定模板的 fields
// ==============================

/**
 * PUT /:id
 * @description 将编辑器中修改后的 fields JSON 写回对应模板
 * @param id - 模板唯一标识
 * @body {{ fields: string }} 合法的 JSON 数组字符串
 * @returns {{ code: 0, data: {}, message: string }} 保存成功
 * @returns {{ code: number, data: {}, message: string }} 参数校验失败（400）或写入失败（500）
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const fieldsResult = parseAndValidateFields((req.body as { fields?: unknown }).fields);
  if (fieldsResult.code !== 0) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, fieldsResult.message);
  }

  const readResult = readTemplates();
  if (readResult.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, readResult.message);
  }

  const index = readResult.data.findIndex((t) => t.id === id);
  if (index === -1) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `找不到 id 为 "${id}" 的模板`);
  }

  const templates = readResult.data.map((t) => (t.id === id ? { ...t, fields: fieldsResult.data } : t));
  const writeResult = writeTemplates(templates);
  if (writeResult.code !== 0) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, writeResult.message);
  }

  return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
});

export default router;
