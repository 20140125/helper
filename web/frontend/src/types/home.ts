/**
 * 菜单项数据结构
 */
export interface MenuItem {
  value: string;
  label: string;
  icon: string;
  /** 所属分组名称 */
  group?: string;
}

/**
 * 菜单分组结构
 * @description 将菜单项按分组聚合，支持折叠/展开
 */
export interface MenuGroup {
  /** 分组名称 */
  group: string;
  /** 分组图标 */
  icon: string;
  /** 该分组下的菜单项 */
  items: MenuItem[];
}
