// ==============================
// 侧边栏导航与页面注册表（数据库唯一真源）
// @description hp_nav_groups / hp_nav_items 的类型；初始种子由 sql/navigation/41_navigation.sql 维护；
//   前端菜单、贾维斯 query_pages 均读库，路由 meta 只保留权限校验与兜底标签。
// ==============================

/** 侧边栏分组 */
export interface NavGroup {
  /** 分组标识（稳定 ID） */
  groupKey: string;
  /** 分组标题的 i18n key */
  labelKey: string;
  /** 分组图标 */
  icon: string;
  /** 展示顺序 */
  sortOrder: number;
  /** 是否启用 */
  enabled: boolean;
}

/** 页面 / 菜单项（同时供贾维斯入口导航使用） */
export interface NavItem {
  /** 自增主键（由库生成） */
  id?: number;
  /** vue-router 路由名 */
  routeName: string;
  /** 浏览器直连路径 */
  path: string;
  /** 菜单标题的 i18n key */
  labelKey: string;
  /** 中文名（贾维斯入口导航用，避免只拿到 i18n key） */
  labelZh: string;
  /** 菜单图标 */
  icon: string;
  /** 所属分组标识 */
  groupKey: string;
  /** 是否在侧边栏显示 */
  inMenu: boolean;
  /** 展示顺序 */
  sortOrder: number;
  /** 访问所需权限码 */
  permissionCode: string;
  /** 是否仅超级管理员可见 */
  superAdminOnly: boolean;
  /** 页面用途说明（贾维斯入口导航） */
  description: string;
  /** 已覆盖该页能力的贾维斯工具 */
  coveredByTools: string[];
  /** 是否启用 */
  enabled: boolean;
}

/** 导航聚合数据 */
export interface NavData {
  /** 分组列表 */
  groups: NavGroup[];
  /** 页面列表 */
  items: NavItem[];
}

