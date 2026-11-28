// ==============================
// 侧边栏导航与页面注册表类型
// @description 与 /api/navigation 的响应结构保持一致，数据库为唯一真源
// ==============================

/** 侧边栏分组 */
export interface NavGroup {
  /** 分组标识 */
  groupKey: string;
  /** 分组标题 i18n key */
  labelKey: string;
  /** 分组图标 */
  icon: string;
  /** 展示顺序 */
  sortOrder: number;
  /** 是否启用 */
  enabled: boolean;
}

/** 页面 / 菜单项 */
export interface NavItem {
  /** 自增主键 */
  id?: number;
  /** 路由名 */
  routeName: string;
  /** 直连路径 */
  path: string;
  /** 菜单标题 i18n key */
  labelKey: string;
  /** 中文名 */
  labelZh: string;
  /** 菜单图标 */
  icon: string;
  /** 所属分组 */
  groupKey: string;
  /** 是否在侧边栏显示 */
  inMenu: boolean;
  /** 展示顺序 */
  sortOrder: number;
  /** 所需权限码 */
  permissionCode: string;
  /** 是否仅超级管理员可见 */
  superAdminOnly: boolean;
  /** 页面用途说明 */
  description: string;
  /** 已覆盖该页能力的贾维斯工具 */
  coveredByTools: string[];
  /** 是否启用 */
  enabled: boolean;
}

/** 导航列表响应 */
export interface NavigationResponse {
  /** 业务状态码 */
  code: number;
  /** 分组与页面 */
  data: { groups: NavGroup[]; items: NavItem[] };
  /** 提示信息 */
  message: string;
}

/** 导航写操作响应 */
export interface NavigationMutationResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: Record<string, unknown>;
  /** 提示信息 */
  message: string;
}

