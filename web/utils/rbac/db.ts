import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { formatDate } from '@/utils/script';
import type { Permission } from '@/types/permission';
import type { PermissionMeta, PermissionType, RbacConfig, RoleConfig, UserRole } from '@/types/rbac';
import type { UserRecord, UsersStore } from '@/types/auth';

/**
 * 把权限码转换成 hp_permissions.enum_key
 * @param {string} code - 权限码
 * @returns {string} 枚举风格的大写下划线标识
 */
const toEnumKey = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

/**
 * 把数据库 DATETIME 转成统一的时间文本
 * @param {unknown} value - 数据库返回的单元格值
 * @returns {string} yyyy-MM-dd HH:mm:ss 格式文本
 */
const toDateText = (value: unknown): string => {
  if (value instanceof Date) return formatDate(value);
  if (value === null || value === undefined) return '';
  return String(value);
};

/**
 * 确保 hp_permissions 具备权限元信息所需的列
 * @returns {Promise<void>}
 * @description 存量库只建了基础列，运行时补齐 type / route，避免必须重跑建表脚本；
 *   字段真实值以 hp_permissions 库表为唯一真源，不再从本地 JSON 快照回填
 */
export const ensureRbacSchema = async (): Promise<void> => {
  const pool = getPool();
  const [cols] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hp_permissions'`,
  );
  const names = new Set(cols.map((col) => String(col.COLUMN_NAME)));
  if (!names.has('type')) {
    await pool.execute("ALTER TABLE `hp_permissions` ADD COLUMN `type` VARCHAR(10) NOT NULL DEFAULT 'view' COMMENT '权限类型 view/edit'");
  }
  if (!names.has('route')) {
    await pool.execute("ALTER TABLE `hp_permissions` ADD COLUMN `route` VARCHAR(255) NULL COMMENT '页面路由（仅 view）'");
  }
};

/**
 * 从数据库读取权限元信息
 * @returns {Promise<PermissionMeta[]>} 权限元信息列表
 */
export const readPermissionMetasFromDb = async (): Promise<PermissionMeta[]> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT code, group_id, group_name, label, description, type, route FROM hp_permissions ORDER BY id',
  );
  return rows.map((row) => {
    const meta: PermissionMeta = {
      code: String(row.code) as Permission,
      group_id: String(row.group_id),
      group_name: String(row.group_name),
      label: String(row.label),
      description: row.description === null ? '' : String(row.description),
      type: (row.type === 'edit' ? 'edit' : 'view') as PermissionType,
    };
    if (row.route) meta.route = String(row.route);
    return meta;
  });
};

/**
 * 把权限元信息全量 UPSERT 到数据库
 * @param {PermissionMeta[]} metas - 权限元信息列表
 * @returns {Promise<void>}
 */
export const writePermissionMetasToDb = async (metas: PermissionMeta[]): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const meta of metas) {
      await conn.execute(
        `INSERT INTO hp_permissions (enum_key, code, group_id, group_name, label, description, type, route)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE group_id = VALUES(group_id), group_name = VALUES(group_name),
           label = VALUES(label), description = VALUES(description), type = VALUES(type), route = VALUES(route)`,
        [toEnumKey(meta.code), meta.code, meta.group_id, meta.group_name, meta.label,
          meta.description, meta.type, meta.route ?? null],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * 从数据库读取完整 RBAC 配置（角色 + 角色权限 + 用户角色绑定）
 * @returns {Promise<RbacConfig>} RBAC 配置
 */
export const readRbacConfigFromDb = async (): Promise<RbacConfig> => {
  const pool = getPool();
  const [roleRows] = await pool.query<RowDataPacket[]>(
    'SELECT role_key, name, description, builtin, created_at, updated_at FROM hp_roles ORDER BY id',
  );
  const [permissionRows] = await pool.query<RowDataPacket[]>(
    `SELECT r.role_key, p.code FROM hp_role_permissions rp
     JOIN hp_roles r ON r.id = rp.role_id
     JOIN hp_permissions p ON p.id = rp.permission_id
     ORDER BY rp.id`,
  );
  const [bindingRows] = await pool.query<RowDataPacket[]>(
    `SELECT u.email, r.role_key, ur.assigned_at FROM hp_user_roles ur
     JOIN hp_users u ON u.id = ur.user_id
     JOIN hp_roles r ON r.id = ur.role_id`,
  );

  const permissionsByRole = new Map<string, Permission[]>();
  for (const row of permissionRows) {
    const key = String(row.role_key);
    const list = permissionsByRole.get(key) ?? [];
    list.push(String(row.code) as Permission);
    permissionsByRole.set(key, list);
  }

  const roles: RoleConfig[] = roleRows.map((row) => ({
    id: String(row.role_key),
    name: String(row.name),
    description: row.description === null ? '' : String(row.description),
    permissions: permissionsByRole.get(String(row.role_key)) ?? [],
    builtin: Boolean(row.builtin),
    created_at: toDateText(row.created_at),
    updated_at: toDateText(row.updated_at),
  }));
  const userRoles: UserRole[] = bindingRows.map((row) => ({
    email: String(row.email),
    roleId: String(row.role_key),
    assignedAt: toDateText(row.assigned_at),
  }));
  return { roles, userRoles };
};

/**
 * 把 RBAC 配置整体持久化到数据库
 * @param {RbacConfig} config - 完整 RBAC 配置
 * @returns {Promise<void>}
 * @description 单事务内重建角色权限与用户绑定，保持与旧「整文件覆盖」一致的语义
 */
export const writeRbacConfigToDb = async (config: RbacConfig): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    // 1. 补齐角色中引用但权限表里尚不存在的权限码
    const metaByCode = new Map((await readPermissionMetasFromDb()).map((m) => [String(m.code), m]));
    const codes = new Set<string>();
    config.roles.forEach((role) => role.permissions.forEach((p) => codes.add(String(p))));
    for (const code of codes) {
      const meta = metaByCode.get(code);
      await conn.execute(
        `INSERT INTO hp_permissions (enum_key, code, group_id, group_name, label, description, type, route)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE label = VALUES(label)`,
        [toEnumKey(code), code, meta?.group_id ?? 'custom', meta?.group_name ?? '自定义',
          meta?.label ?? code, meta?.description ?? '', meta?.type ?? 'edit', meta?.route ?? null],
      );
    }
    const [permissionRows] = await conn.query<RowDataPacket[]>('SELECT id, code FROM hp_permissions');
    const permissionIds = new Map(permissionRows.map((row) => [String(row.code), Number(row.id)]));

    // 2. 角色 UPSERT + 权限重建
    for (const role of config.roles) {
      await conn.execute(
        `INSERT INTO hp_roles (role_key, name, description, builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
           builtin = VALUES(builtin), updated_at = VALUES(updated_at)`,
        [role.id, role.name, role.description, role.builtin ? 1 : 0, role.created_at, role.updated_at],
      );
      const [roleRows] = await conn.query<RowDataPacket[]>('SELECT id FROM hp_roles WHERE role_key = ?', [role.id]);
      const roleId = Number(roleRows[0].id);
      await conn.execute('DELETE FROM hp_role_permissions WHERE role_id = ?', [roleId]);
      for (const code of role.permissions) {
        const permissionId = permissionIds.get(String(code));
        if (permissionId !== undefined) {
          await conn.execute(
            'INSERT IGNORE INTO hp_role_permissions (role_id, permission_id) VALUES (?, ?)',
            [roleId, permissionId],
          );
        }
      }
    }

    // 3. 删除已从配置中移除的角色（外键级联清理关联）
    if (config.roles.length > 0) {
      const placeholders = config.roles.map(() => '?').join(', ');
      await conn.execute(
        `DELETE FROM hp_roles WHERE role_key NOT IN (${placeholders})`,
        config.roles.map((role) => role.id),
      );
    } else {
      await conn.execute('DELETE FROM hp_roles');
    }

    // 4. 用户-角色绑定整体重建（用户不存在时先补一条用户记录）
    await conn.execute('DELETE FROM hp_user_roles');
    for (const binding of config.userRoles) {
      await conn.execute(
        'INSERT INTO hp_users (email) VALUES (?) ON DUPLICATE KEY UPDATE email = VALUES(email)',
        [binding.email],
      );
      const [userRows] = await conn.query<RowDataPacket[]>('SELECT id FROM hp_users WHERE email = ?', [binding.email]);
      const [roleRows] = await conn.query<RowDataPacket[]>('SELECT id FROM hp_roles WHERE role_key = ?', [binding.roleId]);
      if (userRows.length > 0 && roleRows.length > 0) {
        await conn.execute(
          'INSERT IGNORE INTO hp_user_roles (user_id, role_id, assigned_at) VALUES (?, ?, ?)',
          [Number(userRows[0].id), Number(roleRows[0].id), binding.assignedAt || formatDate()],
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * 从数据库读取用户列表
 * @returns {Promise<UsersStore>} 用户列表
 */
export const readUsersFromDb = async (): Promise<UsersStore> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT email, is_admin, first_login_at, last_login_at FROM hp_users ORDER BY id',
  );
  const users: UserRecord[] = rows.map((row) => ({
    email: String(row.email),
    isAdmin: Boolean(row.is_admin),
    firstLoginAt: toDateText(row.first_login_at),
    lastLoginAt: toDateText(row.last_login_at),
  }));
  return { users };
};

/**
 * 记录用户登录（存在则更新最近登录时间与管理标识）
 * @param {string} email - 用户邮箱
 * @param {boolean} isAdmin - 是否为超级管理员
 * @returns {Promise<void>}
 */
export const upsertUserLogin = async (email: string, isAdmin: boolean): Promise<void> => {
  const now = formatDate();
  await getPool().execute(
    `INSERT INTO hp_users (email, is_admin, first_login_at, last_login_at) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_admin = VALUES(is_admin), last_login_at = VALUES(last_login_at)`,
    [email, isAdmin ? 1 : 0, now, now],
  );
};
