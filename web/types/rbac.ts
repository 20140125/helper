// ==============================
// RBAC 类型定义
// ==============================

import type { Permission } from './permission';

/**
 * 角色定义
 * @description 可动态配置的角色，每个角色绑定一组权限码
 */
export interface RoleConfig {
  /** 角色唯一标识 */
  id: string;
  /** 角色显示名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 该角色拥有的权限码列表 */
  permissions: Permission[];
  /** 是否为内置角色（内置角色不可删除） */
  builtin: boolean;
  /** 创建时间 */
  created_at: string;
  /** 最近修改时间 */
  updated_at: string;
}

/**
 * 用户-角色绑定
 * @description 记录每个用户分配的角色 ID
 */
export interface UserRole {
  /** 用户邮箱 */
  email: string;
  /** 分配的角色 ID */
  roleId: string;
  /** 绑定时间 */
  assignedAt: string;
}

/**
 * RBAC 配置文件结构
 * @description 持久化到 .cache/rbac.json
 */
export interface RbacConfig {
  /** 角色列表 */
  roles: RoleConfig[];
  /** 用户-角色绑定列表 */
  userRoles: UserRole[];
}

/**
 * 权限类型
 * - view：控制左侧导航栏页面的访问权限（查看）
 * - edit：控制页面内按钮/操作的执行权限（编辑）
 */
export type PermissionType = 'view' | 'edit';

/**
 * 权限元信息（供前端展示）
 * @description 描述一个权限码的分类、名称和说明
 */
export interface PermissionMeta {
  /** 权限码 */
  code: Permission;
  /** 分组标识（稳定 ID，用于分组聚合，与数据库 hp_permissions.group_id 对齐） */
  group_id: string;
  /** 分组显示名称（中文，用于前端展示，与数据库 hp_permissions.group_name 对齐） */
  group_name: string;
  /** 权限显示名称 */
  label: string;
  /** 权限描述 */
  description: string;
  /** 权限类型：view = 控制页面访问（查看），edit = 控制按钮/操作（编辑） */
  type: PermissionType;
  /** 对应的左侧导航栏路由地址（仅 type=view 时有值，如 'dashboard'、'config'） */
  route?: string;
}

/**
 * 权限新增/编辑请求体类型
 * @description POST / PUT /api/rbac/permissions 共用的请求体
 */
export interface PermissionBody {
  /** 权限码 */
  code?: string;
  /** 分组标识 */
  group_id?: string;
  /** 分组显示名称 */
  group_name?: string;
  /** 权限显示名称 */
  label?: string;
  /** 权限描述 */
  description?: string;
  /** 权限类型 */
  type?: PermissionType;
  /** 路由地址 */
  route?: string;
}
