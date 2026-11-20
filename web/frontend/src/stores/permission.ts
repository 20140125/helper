import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Permission } from '@/types/permission';

// ==============================
// 权限 Store 类
// ==============================

/**
 * 权限管理 Store 类
 * @description 管理当前用户的权限码列表，供全局按钮级权限控制使用
 */
export class PermissionStore {
  /**
   * 当前用户的权限码列表
   * @description 登录成功后从后端获取并缓存
   */
  permissions = ref<Permission[]>([]);

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 设置用户权限列表
   * @param permissions - 后端返回的权限码数组
   */
  setPermissions = (permissions: string[]): void => {
    this.permissions.value = permissions as Permission[];
  };

  /**
   * 清空权限列表（退出登录时调用）
   */
  clearPermissions = (): void => {
    this.permissions.value = [];
  };

  /**
   * 检查当前用户是否拥有指定权限
   * @param permission - 要检查的权限码
   * @returns 是否拥有该权限
   */
  hasPermission = (permission: Permission): boolean => {
    return this.permissions.value.includes(permission);
  };

  /**
   * 检查当前用户是否拥有指定权限列表中的任意一个
   * @param permissions - 权限码数组
   * @returns 是否拥有其中任一权限
   */
  hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some((p) => this.permissions.value.includes(p));
  };

  /**
   * 检查当前用户是否拥有指定权限列表中的全部权限
   * @param permissions - 权限码数组
   * @returns 是否拥有全部权限
   */
  hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every((p) => this.permissions.value.includes(p));
  };
}

/**
 * 创建权限 Store 实例的工厂函数
 * @description 将 PermissionStore 类包装为 Pinia 可用的 Store
 */
export const usePermissionStore = defineStore('permission', () => {
  const store = new PermissionStore();

  return {
    ...store,
  };
});
