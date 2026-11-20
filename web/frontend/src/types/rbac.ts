import type { Permission } from './permission';
import type { ApiResponse } from './api';

/**
 * 角色配置
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
  /** 是否为内置角色 */
  builtin: boolean;
  /** 创建时间 */
  created_at: string;
  /** 最近修改时间 */
  updated_at: string;
  route_select: string[];
  _isEditing?: boolean;
}

/**
 * 用户角色绑定
 */
export interface UserRole {
  /** 用户邮箱 */
  email: string;
  /** 角色 ID */
  roleId: string;
  /** 绑定时间 */
  assignedAt: string;
}

/**
 * 权限类型
 * - View：控制左侧导航栏页面的访问权限（查看）
 * - Edit：控制页面内按钮/操作的执行权限（编辑）
 */
export enum PermissionType {
  View = 'view',
  Edit = 'edit',
}

/**
 * 权限元信息
 */
export interface PermissionMeta {
  /** 权限码 */
  code: Permission;
  /** 分组标识（稳定 ID，用于分组聚合） */
  group_id: string;
  /** 分组显示名称（中文，用于前端展示） */
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
 * 权限更新载荷类型（不含 code，code 由路径参数指定）
 */
export type PermissionUpdatePayload = Omit<PermissionMeta, 'code'>;

/**
 * 权限表单数据类型
 * @description 包含 PermissionMeta 的字段（code 允许为空字符串以支持新建态），
 *              以及仅用于表单 UI 的辅助字段（route_select、_isEditing）
 */
export interface IPermissionFormData extends Omit<PermissionMeta, 'code'> {
  /** 权限码（新建时为空字符串，编辑时为已有 Permission 值） */
  code: Permission | '';
  /** 编辑类型权限时使用的路由选择值（仅表单 UI） */
  route_select?: string;
  /** 内部标记：当前是否为编辑模式（供 handler 判断） */
  _isEditing?: boolean;
  /** 索引签名：兼容子组件 `defineModel<Record<string, unknown>>('formData')` */
  [key: string]: unknown;
}

/**
 * 角色表单数据类型
 * @description 用于角色管理抽屉（新增/编辑）的 v-model 绑定值
 */
export interface IRoleFormData {
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 该角色拥有的权限码列表 */
  permissions: string[];
  /** 索引签名：兼容子组件 `defineModel<Record<string, unknown>>('formData')` */
  [key: string]: unknown;
}

/**
 * 用户角色表单数据类型
 * @description 用于「修改用户角色」抽屉的 v-model 绑定值
 */
export interface IUserRoleFormData {
  /** 用户邮箱 */
  email: string;
  /** 角色 ID */
  roleId: string;
  /** 索引签名：兼容子组件 `defineModel<Record<string, unknown>>('formData')` */
  [key: string]: unknown;
}


/**
 * 用户信息（含角色）
 */
export interface UserInfo {
  /** 邮箱 */
  email: string;
  /** 是否为管理员 */
  isAdmin: boolean;
  /** 是否为超级管理员 */
  isSuperAdmin: boolean;
  /** 角色 ID */
  roleId: string;
  /** 首次登录时间 */
  firstLoginAt: string;
  /** 最近登录时间 */
  lastLoginAt: string;
}

/**
 * RBAC 角色管理页面响应（GET /api/rbac/roles）
 */
export type RbacRolesResponse = ApiResponse<{
  roles: RoleConfig[];
  users: UserInfo[];
  permissionMetas: PermissionMeta[];
  allPermissions: string[];
}>;

/**
 * RBAC 用户管理响应（GET /api/rbac/users）
 */
export type RbacUsersResponse = ApiResponse<{
  users: UserInfo[];
  roles: RoleConfig[];
}>;

/**
 * RBAC 权限列表响应（GET /api/rbac/permissions）
 */
export type RbacPermissionsResponse = ApiResponse<{
  permissionMetas: PermissionMeta[];
}>;

/**
 * 角色操作响应
 */
export type RoleResponse = ApiResponse<{
  role?: RoleConfig;
}>;

/**
 * 用户角色更新响应
 */
export type UserRoleResponse = ApiResponse;

/**
 * 权限操作响应
 */
export type PermissionResponse = ApiResponse<{
  permission?: PermissionMeta;
}>;

/**
 * 按分组归类的权限列表
 */
export interface PermissionGroup {
  /** 分组标识（稳定 ID，用于 key 和分组聚合） */
  group_id: string;
  /** 分组显示名称（中文，用于前端展示） */
  group_name: string;
  /** 该分组下的权限列表 */
  items: PermissionMeta[];
}

/**
 * 权限选择数据源接口
 * @description 由外部（Model）提供权限元信息和当前已选权限列表的读写能力
 */
export interface PermissionSelectionSource {
  /** 获取全量权限元信息列表 */
  getPermissionMetas: () => PermissionMeta[];
  /** 获取当前已选权限码列表 */
  getSelectedPermissions: () => string[];
  /** 设置已选权限码列表 */
  setSelectedPermissions: (permissions: string[]) => void;
}
