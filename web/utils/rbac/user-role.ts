import { Permission } from '@/types/permission';
import type { RoleConfig } from '@/types/rbac';
import { readRbacConfig } from './config';

// ==============================
// 用户权限计算
// ==============================

/**
 * 根据用户邮箱获取其角色配置
 * @param email - 用户邮箱
 * @param isSuperAdmin - 是否为超级管理员（MAIL_USERNAME）
 * @returns 角色配置，未找到时返回 viewer 角色
 */
export const getUserRoleConfig = (email: string, isSuperAdmin: boolean): RoleConfig => {
  const config = readRbacConfig();

  // 超级管理员（MAIL_USERNAME）强制绑定 super_admin 角色
  if (isSuperAdmin) {
    return config.roles.find((r) => r.id === 'super_admin')!;
  }

  // 查找用户绑定的角色
  const userRole = config.userRoles.find((ur) => ur.email === email);
  if (userRole) {
    const role = config.roles.find((r) => r.id === userRole.roleId);
    if (role) return role;
  }

  // 默认返回 viewer 角色
  return config.roles.find((r) => r.id === 'viewer')!;
};

/**
 * 根据用户邮箱获取权限码列表
 * @param email - 用户邮箱
 * @param isSuperAdmin - 是否为超级管理员
 * @returns 权限码数组
 */
export const getUserPermissionsByEmail = (email: string, isSuperAdmin: boolean): Permission[] => {
  const role = getUserRoleConfig(email, isSuperAdmin);
  return role.permissions;
};

/**
 * 获取用户的角色 ID
 * @param email - 用户邮箱
 * @param isSuperAdmin - 是否为超级管理员
 * @returns 角色 ID
 */
export const getUserRoleId = (email: string, isSuperAdmin: boolean): string => {
  const role = getUserRoleConfig(email, isSuperAdmin);
  return role.id;
};
