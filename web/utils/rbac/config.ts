import { Permission } from '@/types/permission';
import type { RbacConfig } from '@/types/rbac';
import { formatDate } from '@/utils/script';
import { readAllPermissionCodes } from './permission-meta';
import { readRbacConfigFromDb, writeRbacConfigToDb } from './db';

/** 内置角色 ID 集合，用于判断角色是否为内置角色 */
const BUILTIN_ROLE_IDS = new Set(['super_admin', 'admin', 'viewer']);

// ==============================
// 默认配置与内置角色校正
// ==============================

/**
 * 生成首次运行时的默认 RBAC 配置
 * @returns {Promise<RbacConfig>} 默认配置
 */
const createDefaultConfig = async (): Promise<RbacConfig> => {
  const now = formatDate();
  const allPermissions = (await readAllPermissionCodes()) as Permission[];
  const viewPermissions = allPermissions.filter((p) => p.endsWith(':view'));

  return {
    roles: [
      {
        id: 'super_admin',
        name: '超级管理员',
        description: '拥有系统全部权限，可管理角色和用户',
        permissions: allPermissions,
        builtin: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'admin',
        name: '管理员',
        description: '拥有系统全部功能权限',
        permissions: allPermissions,
        builtin: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'viewer',
        name: '只读用户',
        description: '可查看所有页面，但不能执行任何操作',
        permissions: viewPermissions,
        builtin: true,
        created_at: now,
        updated_at: now,
      },
    ],
    userRoles: [],
  };
};

/**
 * 确保内置角色存在，并保证 super_admin 拥有全部权限
 * @param {RbacConfig} config - 待校正的配置
 * @returns {Promise<RbacConfig>} 校正后的配置
 * @description 只在内存中校正；写库由显式管理接口完成，避免读请求触发写操作
 */
const ensureBuiltinRoleIds = async (config: RbacConfig): Promise<RbacConfig> => {
  const defaultConfig = await createDefaultConfig();
  const allPermissions = (await readAllPermissionCodes()) as Permission[];

  for (const builtinId of BUILTIN_ROLE_IDS) {
    const existing = config.roles.find((r) => r.id === builtinId);
    if (!existing) {
      const defaultRole = defaultConfig.roles.find((r) => r.id === builtinId)!;
      config.roles.unshift(defaultRole);
    } else {
      existing.builtin = true;
      if (builtinId === 'super_admin') {
        existing.permissions = allPermissions;
      }
    }
  }
  return config;
};

// ==============================
// RBAC 配置读写（数据库为唯一真源）
// ==============================

/**
 * 读取 RBAC 配置
 * @returns {Promise<RbacConfig>} RBAC 配置数据
 * @description 直接查库并校正内置角色；数据库异常向上抛出，由路由转成 500，不再降级读本地 JSON
 */
export const readRbacConfig = async (): Promise<RbacConfig> =>
  ensureBuiltinRoleIds(await readRbacConfigFromDb());

/**
 * 写入 RBAC 配置
 * @param {RbacConfig} config - RBAC 配置数据
 * @returns {Promise<void>}
 */
export const writeRbacConfig = async (config: RbacConfig): Promise<void> => {
  await writeRbacConfigToDb(config);
};
