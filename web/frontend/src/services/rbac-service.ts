import type {
  RbacRolesResponse,
  RbacUsersResponse, 
  RbacPermissionsResponse, 
  RoleResponse, 
  UserRoleResponse, 
  PermissionResponse, 
  PermissionMeta,
} from '@/types/rbac';
import type { Permission } from '@/types/permission';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * RBAC 权限管理服务类
 * @description 封装角色管理、用户角色绑定、权限元信息管理相关的 API 接口
 */
export class RbacService extends BaseService {
  /**
   * 获取角色管理页面数据（角色列表 + 用户列表 + 权限元信息 + 全量权限码）
   * @returns {Promise<RbacRolesResponse>} 角色管理聚合响应
   * @description 用于角色管理页初始化，一次请求拉全信息避免多次往返
   * @example
   * const service = new RbacService();
   * const result = await service.fetchRoles();
   * console.log('角色列表:', result.roles);
   * console.log('用户列表:', result.users);
   * console.log('权限元信息:', result.permissions);
   * console.log('全量权限码:', result.all_permissions);
   */
  fetchRoles = async (): Promise<RbacRolesResponse> => {
    return this.get<RbacRolesResponse>('/rbac/roles');
  };

  /**
   * 获取用户管理数据（用户列表 + 角色列表）
   * @returns {Promise<RbacUsersResponse>} 用户管理聚合响应
   * @description 用于用户管理页初始化，一次请求拉用户与可选角色列表
   * @example
   * const service = new RbacService();
   * const result = await service.fetchUsers();
   * console.log('用户列表:', result.users);
   * console.log('角色列表:', result.roles);
   */
  fetchUsers = async (): Promise<RbacUsersResponse> => {
    return this.get<RbacUsersResponse>('/rbac/users');
  };

  /**
   * 获取权限元信息列表
   * @returns {Promise<RbacPermissionsResponse>} 权限元信息响应
   * @description 返回全量权限元数据（权限码、分组、路由等），用于权限管理页渲染
   * @example
   * const service = new RbacService();
   * const result = await service.fetchPermissions();
   * console.log('权限元信息:', result.permissions);
   */
  fetchPermissions = async (): Promise<RbacPermissionsResponse> => {
    return this.get<RbacPermissionsResponse>('/rbac/permissions');
  };

  /**
   * 新增角色
   * @param {string} name - 角色名称
   * @param {string} description - 角色描述
   * @param {Permission[]} permissions - 权限码列表
   * @returns {Promise<RoleResponse>} 创建后的角色响应
   * @description 创建一个新角色并绑定指定权限码集合
   * @example
   * const service = new RbacService();
   * const result = await service.createRole('管理员', '系统管理员角色', ['user:read', 'user:write']);
   * console.log('创建的角色:', result);
   */
  createRole = async (name: string, description: string, permissions: Permission[]): Promise<RoleResponse> => {
    return this.post<RoleResponse>('/rbac/roles', { name, description, permissions });
  };

  /**
   * 更新角色
   * @param {string} id - 角色 ID
   * @param {{ name?: string; description?: string; permissions?: Permission[] }} payload - 更新内容（部分字段可选）
   * @returns {Promise<RoleResponse>} 更新后的角色响应
   * @description 按 ID 部分更新角色信息（名称/描述/权限码集合）
   * @example
   * const service = new RbacService();
   * const result = await service.updateRole('role-123', { name: '超级管理员', permissions: ['user:read', 'user:write'] });
   * console.log('更新的角色:', result);
   */
  updateRole = async (id: string, payload: {
    name?: string;
    description?: string;
    permissions?: Permission[];
  }): Promise<RoleResponse> => {
    return this.put<RoleResponse>(`/rbac/roles/${id}`, payload);
  };

  /**
   * 删除角色
   * @param {string} id - 角色 ID
   * @returns {Promise<UserRoleResponse>} 删除操作响应
   * @description 按 ID 删除指定角色，后端会一并清理该角色下的用户绑定关系
   * @example
   * const service = new RbacService();
   * const result = await service.deleteRole('role-123');
   * console.log('删除响应:', result);
   */
  deleteRole = async (id: string): Promise<UserRoleResponse> => {
    return this.del<UserRoleResponse>(`/rbac/roles/${id}`);
  };

  /**
   * 修改用户角色
   * @param {string} email - 用户邮箱
   * @param {string} roleId - 角色 ID
   * @returns {Promise<UserRoleResponse>} 用户角色更新响应
   * @description 将指定邮箱用户的角色重新绑定为目标 roleId
   * @example
   * const service = new RbacService();
   * const result = await service.updateUserRole('user@example.com', 'role-123');
   * console.log('更新响应:', result);
   */
  updateUserRole = async (email: string, roleId: string): Promise<UserRoleResponse> => {
    return this.put<UserRoleResponse>(`/rbac/users/${encodeURIComponent(email)}/role`, { roleId });
  };

  /**
   * 新增权限
   * @param {PermissionMeta} payload - 权限信息
   * @returns {Promise<PermissionResponse>} 创建权限响应
   * @description 创建一条新权限元数据，code 为唯一权限码
   * @example
   * const service = new RbacService();
   * const result = await service.createPermission({
   *   code: 'user:read',
   *   group_id: 'user',
   *   group_name: '用户管理',
   *   label: '读取用户',
   *   description: '允许读取用户信息',
   *   type: 'menu'
   * });
   * console.log('创建响应:', result);
   */
  createPermission = async (payload: PermissionMeta): Promise<PermissionResponse> => {
    return this.post<PermissionResponse>('/rbac/permissions', payload);
  };

  /**
   * 更新权限
   * @param {string} code - 权限码（唯一标识）
   * @param {Omit<PermissionMeta, 'code'>} payload - 更新内容（不含 code，code 由路径参数指定）
   * @returns {Promise<PermissionResponse>} 更新后的权限响应
   * @description 按权限码更新元数据（不可修改 code 本身，仅可改分组/描述/路由等）
   * @example
   * const service = new RbacService();
   * const result = await service.updatePermission('user:read', {
   *   group_id: 'user',
   *   group_name: '用户管理',
   *   label: '读取用户',
   *   description: '允许读取用户信息',
   *   type: 'menu'
   * });
   * console.log('更新响应:', result);
   */
  updatePermission = async (code: string, payload: Omit<PermissionMeta, 'code'>): Promise<PermissionResponse> => {
    return this.put<PermissionResponse>(`/rbac/permissions/${encodeURIComponent(code)}`, payload);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建 RBAC 服务实例的工厂函数
 * @description 提供 RbacService 类的实例，确保服务实例的一致性
 * @returns {RbacService} RBAC 服务实例
 */
export const createRbacService = (): RbacService => new RbacService();

/**
 * 默认导出的 RBAC 服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createRbacService 工厂函数
 */
export default createRbacService();
