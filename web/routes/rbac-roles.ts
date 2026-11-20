import { Router } from 'express';
import { readRbacConfig, writeRbacConfig, readUsers, isAdminEmail, readPermissionMetas, readAllPermissionCodes, formatDate, Permission, returnResponse, ErrorCode } from './utils';
import type { RoleConfig } from './utils';

const router = Router();

/**
 * 获取角色管理页面所需数据（角色列表 + 用户列表 + 权限元信息 + 全量权限码）
 * @route GET /api/rbac/roles
 * @returns {{ ok: boolean, roles: RoleConfig[], users: UserRecord[], permissionMetas: PermissionMeta[], allPermissions: string[] }}
 */
router.get('/', (_req, res) => {
  const config = readRbacConfig();
  const usersStore = readUsers();

  // 标记哪些用户是超级管理员
  const users = usersStore.users.map((u) => ({
    ...u,
    isSuperAdmin: isAdminEmail(u.email),
    roleId: (() => {
      if (isAdminEmail(u.email)) return 'super_admin';
      const userRole = config.userRoles.find((ur) => ur.email === u.email);
      return userRole?.roleId ?? 'viewer';
    })(),
  }));

  return returnResponse(res, ErrorCode.SUCCESS, {
    roles: config.roles,
    users,
    permissionMetas: readPermissionMetas(),
    allPermissions: readAllPermissionCodes(),
  }, 'success');
});

/**
 * 新增角色
 * @route POST /api/rbac/roles
 * @body {{ name: string, description: string, permissions: string[] }}
 */
router.post('/', (req, res) => {
  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: string[];
  };

  if (!name?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '角色名称不能为空');
  }

  const config = readRbacConfig();

  // 检查名称是否重复
  if (config.roles.some((r) => r.name === name.trim())) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '角色名称已存在');
  }

  const now = formatDate();
  const newRole: RoleConfig = {
    id: `role_${Date.now()}`,
    name: name.trim(),
    description: description?.trim() ?? '',
    permissions: (permissions ?? []) as Permission[],
    builtin: false,
    created_at: now,
    updated_at: now,
  };

  config.roles.push(newRole);
  writeRbacConfig(config);

  return returnResponse(res, ErrorCode.SUCCESS, { role: newRole }, '角色已创建');
});

/**
 * 更新角色（可修改名称、描述、权限列表）
 * @route PUT /api/rbac/roles/:id
 * @param {string} req.params.id - 角色 ID
 * @body {{ name?: string, description?: string, permissions?: string[] }}
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: string[];
  };

  const config = readRbacConfig();
  const role = config.roles.find((r) => r.id === id);

  if (!role) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '角色不存在');
  }

  // super_admin 角色不允许修改权限（始终拥有全部权限）
  if (id === 'super_admin') {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '超级管理员角色不可修改');
  }

  // 检查名称重复（排除自身）
  if (name?.trim() && config.roles.some((r) => r.id !== id && r.name === name.trim())) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '角色名称已存在');
  }

  if (name?.trim()) role.name = name.trim();
  if (description !== undefined) role.description = description.trim();
  if (permissions) role.permissions = permissions as Permission[];
  role.updated_at = formatDate();

  writeRbacConfig(config);

  return returnResponse(res, ErrorCode.SUCCESS, { role }, '角色已更新');
});

/**
 * 删除角色（内置角色不可删除）
 * @route DELETE /api/rbac/roles/:id
 * @param {string} req.params.id - 角色 ID
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const config = readRbacConfig();
  const role = config.roles.find((r) => r.id === id);

  if (!role) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '角色不存在');
  }

  if (role.builtin) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '内置角色不可删除');
  }

  // 将使用该角色的用户降级为 viewer
  const affectedUsers = config.userRoles.filter((ur) => ur.roleId === id);
  config.userRoles = config.userRoles.filter((ur) => ur.roleId !== id);
  config.roles = config.roles.filter((r) => r.id !== id);
  writeRbacConfig(config);

  return returnResponse(res, ErrorCode.SUCCESS, {}, `角色已删除，${affectedUsers.length} 个用户已降级为只读用户`);
});

export default router;
