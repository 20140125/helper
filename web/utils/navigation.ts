/**
 * 侧边栏导航与页面注册表访问层
 * @description hp_nav_groups / hp_nav_items 是菜单显隐、分组、图标、顺序与贾维斯入口导航的唯一真源；
 *   启动时幂等建表，初始种子由 sql/navigation/41_navigation.sql 维护，读写全部走参数化 SQL。
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { Permission } from '@/types/permission';
import {
  type NavData,
  type NavGroup,
  type NavItem,
} from '@/types/navigation';

/** 分组表行 */
interface NavGroupRow extends RowDataPacket {
  group_key: string;
  label_key: string;
  icon: string;
  sort_order: number;
  enabled: number;
}

/** 页面表行 */
interface NavItemRow extends RowDataPacket {
  id: number;
  route_name: string;
  path: string;
  label_key: string;
  label_zh: string;
  icon: string;
  group_key: string;
  in_menu: number;
  sort_order: number;
  permission_code: string;
  super_admin_only: number;
  description: string;
  covered_by_tools: string | string[] | null;
  enabled: number;
}

/** 把分组行转成前端结构 */
const toGroup = (row: NavGroupRow): NavGroup => ({
  groupKey: String(row.group_key),
  labelKey: String(row.label_key),
  icon: String(row.icon ?? ''),
  sortOrder: Number(row.sort_order ?? 0),
  enabled: Number(row.enabled ?? 1) === 1,
});

/** 把页面行转成前端结构（JSON 列可能被 mysql2 直接解析成数组） */
const toItem = (row: NavItemRow): NavItem => {
  let tools: string[] = [];
  try {
    const raw = typeof row.covered_by_tools === 'string'
      ? JSON.parse(row.covered_by_tools) : row.covered_by_tools;
    if (Array.isArray(raw)) tools = raw.map(String);
  } catch {
    tools = [];
  }
  return {
    id: Number(row.id ?? 0),
    routeName: String(row.route_name),
    path: String(row.path),
    labelKey: String(row.label_key),
    labelZh: String(row.label_zh ?? ''),
    icon: String(row.icon ?? ''),
    groupKey: String(row.group_key ?? ''),
    inMenu: Number(row.in_menu ?? 0) === 1,
    sortOrder: Number(row.sort_order ?? 0),
    permissionCode: String(row.permission_code ?? ''),
    superAdminOnly: Number(row.super_admin_only ?? 0) === 1,
    description: String(row.description ?? ''),
    coveredByTools: tools,
    enabled: Number(row.enabled ?? 1) === 1,
  };
};

/**
 * 读取全部导航数据（含停用项，管理页需要；前端菜单自行过滤 enabled）
 * @returns {Promise<NavData>} 分组与页面列表
 */
export const listNavigation = async (): Promise<NavData> => {
  const pool = getPool();
  const [groupRows] = await pool.query<NavGroupRow[]>(
    'SELECT group_key, label_key, icon, sort_order, enabled FROM hp_nav_groups ORDER BY sort_order, group_key',
  );
  const [itemRows] = await pool.query<NavItemRow[]>(
    `SELECT id, route_name, path, label_key, label_zh, icon, group_key, in_menu, sort_order,
       permission_code, super_admin_only, description, covered_by_tools, enabled
     FROM hp_nav_items ORDER BY sort_order, id`,
  );
  return { groups: groupRows.map(toGroup), items: itemRows.map(toItem) };
};

/**
 * 按当前用户权限裁剪导航数据
 * @param {NavData} data - 全量导航数据
 * @param {Permission[]} permissions - 当前用户权限码列表
 * @param {boolean} isAdmin - 当前用户是否超级管理员
 * @returns {NavData} 该用户可见的分组与页面
 * @description 超管与导航管理页维护者（CONFIG_VIEW / CONFIG_EDIT）需要停用项、隐藏项与超管项，返回全量；
 *   普通登录用户只拿到启用分组，以及启用、非超管专属、权限码匹配（或未设权限码）的页面
 */
export const filterNavigationForUser = (
  data: NavData,
  permissions: Permission[],
  isAdmin: boolean,
): NavData => {
  if (isAdmin
    || permissions.includes(Permission.CONFIG_VIEW)
    || permissions.includes(Permission.CONFIG_EDIT)) {
    return data;
  }
  const owned = new Set<string>(permissions);
  return {
    groups: data.groups.filter((group) => group.enabled),
    items: data.items.filter((item) => item.enabled
      && !item.superAdminOnly
      && (!item.permissionCode || owned.has(item.permissionCode))),
  };
};

/**
 * 校验并规范化分组写入参数
 * @param {unknown} raw - 请求体
 * @returns {NavGroup | null} 合法时返回分组，否则 null
 */
export const normalizeNavGroup = (raw: unknown): NavGroup | null => {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const groupKey = String(body.groupKey ?? '').trim();
  const labelKey = String(body.labelKey ?? '').trim();
  if (!groupKey || groupKey.length > 32 || !labelKey || labelKey.length > 64) return null;
  return {
    groupKey,
    labelKey,
    icon: String(body.icon ?? '').trim().slice(0, 32),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    enabled: body.enabled !== false,
  };
};

/**
 * 校验并规范化页面写入参数
 * @param {unknown} raw - 请求体
 * @returns {NavItem | null} 合法时返回页面，否则 null
 */
export const normalizeNavItem = (raw: unknown): NavItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const routeName = String(body.routeName ?? '').trim();
  const path = String(body.path ?? '').trim();
  const labelKey = String(body.labelKey ?? '').trim();
  if (!routeName || routeName.length > 64 || !path.startsWith('/') || path.length > 128
    || !labelKey || labelKey.length > 64) return null;
  const tools = Array.isArray(body.coveredByTools)
    ? body.coveredByTools.map(String).slice(0, 20) : [];
  return {
    routeName,
    path,
    labelKey,
    labelZh: String(body.labelZh ?? '').trim().slice(0, 128),
    icon: String(body.icon ?? '').trim().slice(0, 32),
    groupKey: String(body.groupKey ?? '').trim().slice(0, 32),
    inMenu: body.inMenu === true,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    permissionCode: String(body.permissionCode ?? '').trim().slice(0, 64),
    superAdminOnly: body.superAdminOnly === true,
    description: String(body.description ?? '').trim().slice(0, 255),
    coveredByTools: tools,
    enabled: body.enabled !== false,
  };
};

/**
 * 新增或更新分组
 * @param {NavGroup} group - 已校验的分组
 * @returns {Promise<void>}
 */
export const saveNavGroup = async (group: NavGroup): Promise<void> => {
  await getPool().execute(
    `INSERT INTO hp_nav_groups (group_key, label_key, icon, sort_order, enabled)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE label_key = VALUES(label_key), icon = VALUES(icon),
       sort_order = VALUES(sort_order), enabled = VALUES(enabled)`,
    [group.groupKey, group.labelKey, group.icon, group.sortOrder, group.enabled ? 1 : 0],
  );
};

/**
 * 新增或更新页面（按 route_name 唯一定位）
 * @param {NavItem} item - 已校验的页面
 * @returns {Promise<void>}
 */
export const saveNavItem = async (item: NavItem): Promise<void> => {
  await getPool().execute(
    `INSERT INTO hp_nav_items
       (route_name, path, label_key, label_zh, icon, group_key, in_menu, sort_order,
        permission_code, super_admin_only, description, covered_by_tools, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE path = VALUES(path), label_key = VALUES(label_key),
       label_zh = VALUES(label_zh), icon = VALUES(icon), group_key = VALUES(group_key),
       in_menu = VALUES(in_menu), sort_order = VALUES(sort_order),
       permission_code = VALUES(permission_code), super_admin_only = VALUES(super_admin_only),
       description = VALUES(description), covered_by_tools = VALUES(covered_by_tools),
       enabled = VALUES(enabled)`,
    [
      item.routeName, item.path, item.labelKey, item.labelZh, item.icon, item.groupKey,
      item.inMenu ? 1 : 0, item.sortOrder, item.permissionCode,
      item.superAdminOnly ? 1 : 0, item.description,
      JSON.stringify(item.coveredByTools), item.enabled ? 1 : 0,
    ],
  );
};

/**
 * 删除分组
 * @param {string} groupKey - 分组标识
 * @returns {Promise<boolean>} 实际删除返回 true
 */
export const deleteNavGroup = async (groupKey: string): Promise<boolean> => {
  const [result] = await getPool().execute<ResultSetHeader>(
    'DELETE FROM hp_nav_groups WHERE group_key = ?', [groupKey],
  );
  return result.affectedRows > 0;
};

/**
 * 删除页面
 * @param {string} routeName - 路由名
 * @returns {Promise<boolean>} 实际删除返回 true
 */
export const deleteNavItem = async (routeName: string): Promise<boolean> => {
  const [result] = await getPool().execute<ResultSetHeader>(
    'DELETE FROM hp_nav_items WHERE route_name = ?', [routeName],
  );
  return result.affectedRows > 0;
};

/**
 * 启动时幂等建表
 * @returns {Promise<void>}
 * @description 存量库无需全库重建；初始种子统一由 sql/navigation/41_navigation.sql 播种（INSERT IGNORE，不覆盖管理页编辑）
 */
export const ensureNavigationSchema = async (): Promise<void> => {
  const pool = getPool();
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS hp_nav_groups (
      group_key VARCHAR(32) NOT NULL,
      label_key VARCHAR(64) NOT NULL,
      icon VARCHAR(32) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (group_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='侧边栏菜单分组'`,
  );
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS hp_nav_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      route_name VARCHAR(64) NOT NULL,
      path VARCHAR(128) NOT NULL,
      label_key VARCHAR(64) NOT NULL,
      label_zh VARCHAR(128) NOT NULL DEFAULT '',
      icon VARCHAR(32) NOT NULL DEFAULT '',
      group_key VARCHAR(32) NOT NULL DEFAULT '',
      in_menu TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      permission_code VARCHAR(64) NOT NULL DEFAULT '',
      super_admin_only TINYINT(1) NOT NULL DEFAULT 0,
      description VARCHAR(255) NOT NULL DEFAULT '',
      covered_by_tools JSON NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY uk_route_name (route_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='侧边栏菜单与页面入口注册表'`,
  );
};

