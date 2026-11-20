import type { PermissionMeta, PermissionGroup, PermissionSelectionSource } from '@/types/rbac';

export type { PermissionSelectionSource } from '@/types/rbac';

/**
 * 权限选择工具类
 * @description 封装权限分组计算、全选/半选状态判断、权限切换操作等通用逻辑，
 *              供 RbacModel、AutoFormPlaygroundModel 等需要权限选择功能的 Model 复用。
 *              通过注入 PermissionSelectionSource 实现与具体 Model 数据源解耦。
 */
export class PermissionSelection {
  private source: PermissionSelectionSource;

  constructor(source: PermissionSelectionSource) {
    this.source = source;
  }

  /**
   * 按分组归类的权限列表
   * @returns {PermissionGroup[]} 权限分组数组
   */
  get permissionGroups(): PermissionGroup[] {
    const groupMap = new Map<string, { group_name: string; items: PermissionMeta[] }>();
    for (const meta of this.source.getPermissionMetas()) {
      const entry = groupMap.get(meta.group_id) ?? { group_name: meta.group_name, items: [] };
      entry.items.push(meta);
      groupMap.set(meta.group_id, entry);
    }
    return Array.from(groupMap.entries()).map(([group_id, { group_name, items }]) => ({
      group_id,
      group_name,
      items,
    }));
  }

  /**
   * 所有权限码列表（从 permissionMetas 提取）
   * @returns {string[]} 所有可用权限码
   */
  get allPermissionCodes(): string[] {
    return this.source.getPermissionMetas().map((m) => m.code as string);
  }

  /**
   * 是否全部权限已勾选
   * @returns {boolean}
   */
  get isAllChecked(): boolean {
    const selected = this.source.getSelectedPermissions();
    return this.allPermissionCodes.length > 0
      && selected.length === this.allPermissionCodes.length;
  }

  /**
   * 是否部分权限已勾选（半选状态）
   * @returns {boolean}
   */
  get isIndeterminate(): boolean {
    const selected = this.source.getSelectedPermissions();
    return selected.length > 0
      && selected.length < this.allPermissionCodes.length;
  }

  /**
   * 检查某个分组是否全部勾选
   * @param {PermissionGroup} group - 权限分组
   * @returns {boolean}
   */
  isGroupAllChecked = (group: PermissionGroup): boolean => {
    const selected = this.source.getSelectedPermissions();
    return group.items.every((item) => selected.includes(item.code as string));
  };

  /**
   * 检查某个分组是否部分勾选（半选状态）
   * @param {PermissionGroup} group - 权限分组
   * @returns {boolean}
   */
  isGroupIndeterminate = (group: PermissionGroup): boolean => {
    const selected = this.source.getSelectedPermissions();
    const checkedCount = group.items.filter((item) =>
      selected.includes(item.code as string),
    ).length;
    return checkedCount > 0 && checkedCount < group.items.length;
  };

  /**
   * 全选/全不选权限
   * @param {boolean} checked - 是否全选
   */
  toggleAll = (checked: boolean): void => {
    this.source.setSelectedPermissions(checked ? [...this.allPermissionCodes] : []);
  };

  /**
   * 切换权限勾选（整组）
   * @param {PermissionGroup} group - 权限分组
   * @param {boolean} checked - 是否勾选
   */
  toggleGroup = (group: PermissionGroup, checked: boolean): void => {
    const codes = group.items.map((item) => item.code as string);
    const current = new Set(this.source.getSelectedPermissions());
    if (checked) {
      codes.forEach((c) => current.add(c));
    } else {
      codes.forEach((c) => current.delete(c));
    }
    this.source.setSelectedPermissions(Array.from(current));
  };

  /**
   * 处理单个权限勾选/取消
   * @param {string} code - 权限码
   * @param {boolean} checked - 是否勾选
   */
  toggle = (code: string, checked: boolean): void => {
    const current = new Set(this.source.getSelectedPermissions());
    if (checked) {
      current.add(code);
    } else {
      current.delete(code);
    }
    this.source.setSelectedPermissions(Array.from(current));
  };
}
