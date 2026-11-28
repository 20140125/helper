import fs from 'fs';
import { Permission } from '@/types/permission';
import type { RbacConfig } from '@/types/rbac';
import { formatDate } from '@/utils/script';
import { PROJECT_DIR } from '@/utils/paths';
import { readAllPermissionCodes } from './permission-meta';
import { readRbacConfigFromDb, writeRbacConfigToDb } from './db';

/** RBAC 配置 JSON 快照路径（数据库不可用时的降级数据） */
const RBAC_FILE = `${PROJECT_DIR}/.cache/rbac.json`;

/** 内置角色 ID 集合，用于判断角色是否为内置角色 */
const BUILTIN_ROLE_IDS = new Set(['super_admin', 'admin', 'viewer']);

// ==============================
// 默认配置与本地 JSON 降级
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
 * 读取本地 RBAC 配置快照
 * @returns {Promise<RbacConfig>} RBAC 配置
 */
const readLegacyRbacConfig = async (): Promise<RbacConfig> => {
  if (!fs.existsSync(RBAC_FILE)) return createDefaultConfig();
  try {
    return ensureBuiltinRoleIds(JSON.parse(fs.readFileSync(RBAC_FILE, 'utf-8')) as RbacConfig);
  } catch {
    return createDefaultConfig();
  }
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
 * @description 优先查库；数据库不可用时降级读取本地 JSON 快照
 */
export const readRbacConfig = async (): Promise<RbacConfig> => {
  try {
    return await ensureBuiltinRoleIds(await readRbacConfigFromDb());
  } catch (err) {
    console.warn('[RBAC] 读取 hp_roles 失败，回退 JSON：', (err as Error).message);
    return readLegacyRbacConfig();
  }
};

/**
 * 写入 RBAC 配置
 * @param {RbacConfig} config - RBAC 配置数据
 * @returns {Promise<void>}
 */
export const writeRbacConfig = async (config: RbacConfig): Promise<void> => {
  await writeRbacConfigToDb(config);
};
