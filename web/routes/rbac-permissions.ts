import { Router } from 'express';
import { readPermissionMetas, createPermissionMeta, updatePermissionMeta, validatePermissionFields, Permission, returnResponse, ErrorCode } from './utils';
import type { PermissionMeta, PermissionBody } from './utils';

const router = Router();

/**
 * 获取权限元信息列表
 * @route GET /api/rbac/permissions
 * @returns {{ ok: boolean, permissionMetas: PermissionMeta[] }}
 */
router.get('/', (_req, res) => {
  return returnResponse(res, ErrorCode.SUCCESS, { permissionMetas: readPermissionMetas() }, 'success');
});

/**
 * 新增权限元信息
 * @route POST /api/rbac/permissions
 * @body {PermissionBody}
 */
router.post('/', (req, res) => {
  const body = req.body as PermissionBody;

  if (!body.code?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '权限码不能为空');
  }
  const error = validatePermissionFields(body);
  if (error) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, error);
  }

  try {
    const newMeta: PermissionMeta = {
      code: body.code.trim() as Permission,
      group_id: body.group_id!.trim(),
      group_name: body.group_name!.trim(),
      label: body.label!.trim(),
      description: body.description?.trim() ?? '',
      type: body.type!,
      ...(body.type === 'view' ? { route: body.route!.trim() } : {}),
    };
    const created = createPermissionMeta(newMeta);
    return returnResponse(res, ErrorCode.SUCCESS, { permission: created }, '权限已创建');
  } catch (e) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, e instanceof Error ? e.message : '创建权限失败');
  }
});

/**
 * 更新权限元信息（权限码不可修改）
 * @route PUT /api/rbac/permissions/:code
 * @param {string} req.params.code - 权限码（URL 编码）
 * @body {Omit<PermissionBody, 'code'>}
 */
router.put('/:code', (req, res) => {
  const code = decodeURIComponent(req.params.code);
  const body = req.body as PermissionBody;

  const error = validatePermissionFields(body);
  if (error) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, error);
  }

  try {
    const updates: Omit<Partial<PermissionMeta>, 'code'> = {
      group_id: body.group_id!.trim(),
      group_name: body.group_name!.trim(),
      label: body.label!.trim(),
      description: body.description?.trim() ?? '',
      type: body.type!,
      ...(body.type === 'view' ? { route: body.route!.trim() } : { route: undefined }),
    };
    const updated = updatePermissionMeta(code, updates);
    return returnResponse(res, ErrorCode.SUCCESS, { permission: updated }, '权限已更新');
  } catch (e) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, e instanceof Error ? e.message : '更新权限失败');
  }
});

export default router;
