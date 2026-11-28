import { Router } from 'express';
import { readRbacConfig, writeRbacConfig, readUsers, isAdminEmail, formatDate, returnResponse, ErrorCode } from './utils';
import type { UserRole } from './utils';

const router = Router();

/**
 * 获取用户列表及角色信息
 * @route GET /api/rbac/users
 * @returns {{ ok: boolean, users: UserRecord[], roles: RoleConfig[] }}
 */
router.get('/', async (_req, res) => {
  try {
    const config = await readRbacConfig();
    const usersStore = await readUsers();

    const users = usersStore.users.map((u) => ({
      ...u,
      isSuperAdmin: isAdminEmail(u.email),
      roleId: (() => {
        if (isAdminEmail(u.email)) return 'super_admin';
        const userRole = config.userRoles.find((ur) => ur.email === u.email);
        return userRole?.roleId ?? 'viewer';
      })(),
    }));

    return returnResponse(res, ErrorCode.SUCCESS, { users, roles: config.roles }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

/**
 * 修改用户角色
 * @route PUT /api/rbac/users/:email/role
 * @param {string} req.params.email - 用户邮箱（URL 编码）
 * @body {{ roleId: string }}
 */
router.put('/:email/role', async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { roleId } = req.body as { roleId?: string };

  if (!roleId) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少角色 ID');
  }

  // 超级管理员角色不能被手动分配
  if (isAdminEmail(email)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '超级管理员的角色不可修改');
  }

  try {
    const config = await readRbacConfig();

    // 检查角色是否存在
    const role = config.roles.find((r) => r.id === roleId);
    if (!role) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '角色不存在');
    }

    // super_admin 角色不能手动分配给其他用户
    if (roleId === 'super_admin') {
      return returnResponse(res, ErrorCode.FORBIDDEN, {}, '超级管理员角色不可手动分配');
    }

    // 更新或创建绑定
    const existing = config.userRoles.find((ur) => ur.email === email);
    if (existing) {
      existing.roleId = roleId;
      existing.assignedAt = formatDate();
    } else {
      const newBinding: UserRole = {
        email,
        roleId,
        assignedAt: formatDate(),
      };
      config.userRoles.push(newBinding);
    }

    await writeRbacConfig(config);

    return returnResponse(res, ErrorCode.SUCCESS, {}, `用户角色已更新为「${role.name}」`);
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
