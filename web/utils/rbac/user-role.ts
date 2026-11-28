import { Permission } from '@/types/permission';
import type { RoleConfig } from '@/types/rbac';
import { readRbacConfig } from './config';

// ==============================
// 用户权限计算
// ==============================

/**
 * 根据用户邮箱获取其角色配置
 * @param {string} email - 用户邮箱
 * @param {boolean} isSuperAdmin - 是否为超级管理员（MAIL_USERNAME）
 * @returns {Promise<RoleConfig>} 角色配置，未找到时返回 viewer 角色
 */
export const getUserRoleConfig = async (email: string, isSuperAdmin: boolean): Promise<RoleConfig> => {
  const config = await readRbacConfig();

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
 * @param {string} email - 用户邮箱
 * @param {boolean} isSuperAdmin - 是否为超级管理员
 * @returns {Promise<Permission[]>} 权限码数组
 */
export const getUserPermissionsByEmail = async (email: string, isSuperAdmin: boolean): Promise<Permission[]> => {
  const role = await getUserRoleConfig(email, isSuperAdmin);
  return role.permissions;
};

/**
 * 获取用户的角色 ID
 * @param {string} email - 用户邮箱
 * @param {boolean} isSuperAdmin - 是否为超级管理员
 * @returns {Promise<string>} 角色 ID
 */
export const getUserRoleId = async (email: string, isSuperAdmin: boolean): Promise<string> => {
  const role = await getUserRoleConfig(email, isSuperAdmin);
  return role.id;
};

/**
 * 一次查库同时取得角色 ID 与权限列表
 * @param {string} email - 用户邮箱
 * @param {boolean} isSuperAdmin - 是否为超级管理员
 * @returns {Promise<{ roleId: string; permissions: Permission[] }>} 用户鉴权信息
 * @description 供 JWT 中间件使用，避免每个请求重复查库两次
 */
export const getUserAuthInfo = async (
  email: string,
  isSuperAdmin: boolean,
): Promise<{ roleId: string; permissions: Permission[] }> => {
  const role = await getUserRoleConfig(email, isSuperAdmin);
  return { roleId: role.id, permissions: role.permissions };
};
