/**
 * 侧边栏导航与页面注册表路由
 * @description GET 按当前用户权限裁剪返回菜单，管理页维护者返回全量；贾维斯入口导航直接查库；写操作由 CONFIG_EDIT 保护。
 */
import { Router } from 'express';
import type { Response } from 'express';
import {
  ErrorCode,
  returnResponse,
  listNavigation,
  filterNavigationForUser,
  normalizeNavGroup,
  normalizeNavItem,
  saveNavGroup,
  saveNavItem,
  deleteNavGroup,
  deleteNavItem,
} from './utils';

const router = Router();

/** 把异常转换成统一响应 */
const handleError = (res: Response, err: unknown) =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET / 按当前用户权限返回分组与页面；管理页维护者返回全量（含停用项） */
router.get('/', async (req, res) => {
  try {
    const data = await listNavigation();
    const visible = filterNavigationForUser(data, req.userPermissions ?? [], req.userIsAdmin ?? false);
    return returnResponse(res, ErrorCode.SUCCESS, { groups: visible.groups, items: visible.items }, 'success');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route POST /groups 新增或更新分组 */
router.post('/groups', async (req, res) => {
  const group = normalizeNavGroup(req.body);
  if (!group) return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '分组参数不合法');
  try {
    await saveNavGroup(group);
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route PUT /groups/:groupKey 更新指定分组 */
router.put('/groups/:groupKey', async (req, res) => {
  const group = normalizeNavGroup({ ...(req.body as object), groupKey: req.params.groupKey });
  if (!group) return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '分组参数不合法');
  try {
    await saveNavGroup(group);
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route DELETE /groups/:groupKey 删除分组 */
router.delete('/groups/:groupKey', async (req, res) => {
  try {
    const removed = await deleteNavGroup(req.params.groupKey);
    if (!removed) return returnResponse(res, ErrorCode.NOT_FOUND, {}, '分组不存在');
    return returnResponse(res, ErrorCode.SUCCESS, {}, '删除成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route POST /items 新增或更新页面 */
router.post('/items', async (req, res) => {
  const item = normalizeNavItem(req.body);
  if (!item) return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '页面参数不合法');
  try {
    await saveNavItem(item);
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route PUT /items/:routeName 更新指定页面 */
router.put('/items/:routeName', async (req, res) => {
  const item = normalizeNavItem({ ...(req.body as object), routeName: req.params.routeName });
  if (!item) return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '页面参数不合法');
  try {
    await saveNavItem(item);
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route DELETE /items/:routeName 删除页面 */
router.delete('/items/:routeName', async (req, res) => {
  try {
    const removed = await deleteNavItem(req.params.routeName);
    if (!removed) return returnResponse(res, ErrorCode.NOT_FOUND, {}, '页面不存在');
    return returnResponse(res, ErrorCode.SUCCESS, {}, '删除成功');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
