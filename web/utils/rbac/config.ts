import fs from 'fs';
import { Permission } from '@/types/permission';
import type { RbacConfig } from '@/types/rbac';
import { formatDate } from '@/utils/script';
import { PROJECT_DIR, CACHE_DIR } from '@/utils/paths';
import { readAllPermissionCodes } from './permission-meta';

/** RBAC 配置文件路径 */
const RBAC_FILE = `${PROJECT_DIR}/.cache/rbac.json`;

// ==============================
// 内置角色 ID 列表（仅用于首次生成默认配置）
// ==============================

/** 内置角色 ID 集合，用于判断角色是否为内置角色 */
const BUILTIN_ROLE_IDS = new Set(['super_admin', 'admin', 'viewer']);

// ==============================
// RBAC 配置文件读写
// ==============================

/**
 * 生成首次运行时的默认 RBAC 配置
 * @description 仅在 rbac.json 不存在或损坏时调用，后续权限完全以 JSON 文件为准
 */
const createDefaultConfig = (): RbacConfig => {
  const now = formatDate();
  const allPermissions = readAllPermissionCodes() as Permission[];
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
 * 读取 RBAC 配置
 * @returns RBAC 配置数据
 * @description 如果文件不存在则生成默认配置写入；文件存在时完全信任 JSON 内容，权限以 JSON 为准
 */
export const readRbacConfig = (): RbacConfig => {
  if (!fs.existsSync(RBAC_FILE)) {
    const defaultConfig = createDefaultConfig();
    writeRbacConfig(defaultConfig);
    return defaultConfig;
  }
  try {
    const config = JSON.parse(fs.readFileSync(RBAC_FILE, 'utf-8')) as RbacConfig;
    // 仅确保内置角色 ID 存在（不会覆盖已有角色的权限配置）
    return ensureBuiltinRoleIds(config);
  } catch {
    const defaultConfig = createDefaultConfig();
    writeRbacConfig(defaultConfig);
    return defaultConfig;
  }
};

/**
 * 写入 RBAC 配置
 * @param config - RBAC 配置数据
 */
export const writeRbacConfig = (config: RbacConfig): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(RBAC_FILE, JSON.stringify(config, null, 2), 'utf-8');
};

/**
 * 确保内置角色 ID 始终存在，并保证 super_admin 始终拥有全部权限
 * @description 仅在角色被意外删除时补回默认配置；super_admin 权限始终与最新权限码同步
 */
const ensureBuiltinRoleIds = (config: RbacConfig): RbacConfig => {
  const defaultConfig = createDefaultConfig();
  const allPermissions = readAllPermissionCodes() as Permission[];
  let changed = false;

  for (const builtinId of BUILTIN_ROLE_IDS) {
    const existing = config.roles.find((r) => r.id === builtinId);
    if (!existing) {
      // 角色被删除了，补回默认配置
      const defaultRole = defaultConfig.roles.find((r) => r.id === builtinId)!;
      config.roles.unshift(defaultRole);
      changed = true;
    } else {
      if (!existing.builtin) {
        // 确保 builtin 标记正确
        existing.builtin = true;
        changed = true;
      }
      // super_admin 始终拥有全部权限，自动同步新增的权限码
      if (builtinId === 'super_admin') {
        const currentCodes = new Set(existing.permissions);
        const missingPermissions = allPermissions.filter((p) => !currentCodes.has(p));
        if (missingPermissions.length > 0) {
          existing.permissions = allPermissions;
          existing.updated_at = formatDate();
          changed = true;
        }
      }
    }
  }

  if (changed) {
    writeRbacConfig(config);
  }
  return config;
};
