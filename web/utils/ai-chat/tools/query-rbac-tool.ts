import {
  readRbacConfig,
  readPermissionMetas,
  readAllPermissionCodes,
} from '@/routes/utils';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';

/** 可查询的 RBAC 维度 */
const RBAC_TARGETS = ['overview', 'roles', 'users', 'permissions'] as const;

/** 各维度所需的权限码 */
const TARGET_PERMISSION: Record<string, string> = {
  overview: 'rbac:roles:view',
  roles: 'rbac:roles:view',
  users: 'rbac:users:view',
  permissions: 'rbac:permissions:view',
};

/** 返回条数上限 */
const MAX_ITEMS = 100;

/**
 * query_rbac 工具实现
 * @description 查询 RBAC 权限体系：角色（含权限码）、用户-角色绑定、权限码清单。
 *              按当前用户权限逐维度过滤，只有有权限的维度才返回数据。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "系统里有哪些角色？"                             → { target: 'roles' }
 *   - "张三是什么角色"                                  → { target: 'users', keyword: 'zhangsan' }
 *   - "一共有多少个权限码"                              → { target: 'permissions' }
 */
export const queryRbacTool: ToolImpl = {
  name: 'query_rbac',
  description:
    '查询 RBAC 权限体系：target=roles 查角色及其权限码；users 查用户-角色绑定；'
    + 'permissions 查权限码清单（分组/名称/类型）；overview 查整体概览（角色数/用户数/权限码数）。'
    + '只读，不做任何增删改；权限申请记录用 query_permission_requests。',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: [...RBAC_TARGETS],
        description: '查询维度，默认 overview',
      },
      keyword: {
        type: 'string',
        description: '模糊过滤：roles 按角色名/id，users 按邮箱，permissions 按权限码或名称',
      },
    },
  },
  requiredPermissions: ['rbac:roles:view', 'rbac:users:view', 'rbac:permissions:view'],
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const target = typeof args.target === 'string' && args.target.trim()
      ? args.target.trim()
      : 'overview';
    if (!RBAC_TARGETS.includes(target as (typeof RBAC_TARGETS)[number])) {
      return { ok: false, data: `不支持 target="${target}"，可用：${RBAC_TARGETS.join('、')}` };
    }

    const permissions = ctx.userPermissions ?? [];
    const need = TARGET_PERMISSION[target];
    if (need && !permissions.includes(need)) {
      return { ok: false, data: `无权限查看 ${target}（需 ${need}）` };
    }

    const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';
    const config = await readRbacConfig();
    const metas = await readPermissionMetas();

    // ── 概览 ──
    if (target === 'overview') {
      return {
        ok: true,
        data: {
          roles: config.roles.length,
          users: config.userRoles.length,
          permission_codes: (await readAllPermissionCodes()).length,
          role_names: config.roles.map((r) => r.name),
        },
        summary: `${config.roles.length} 个角色、${config.userRoles.length} 个用户绑定、`
          + `${(await readAllPermissionCodes()).length} 个权限码`,
      };
    }

    // ── 角色 ──
    if (target === 'roles') {
      const list = config.roles
        .filter((r) => {
          if (!kw) return true;
          return r.name.toLowerCase().includes(kw) || r.id.toLowerCase().includes(kw);
        })
        .slice(0, MAX_ITEMS)
        .map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          builtin: r.builtin,
          permissions: r.permissions,
          user_count: config.userRoles.filter((u) => u.roleId === r.id).length,
        }));
      return {
        ok: true,
        data: { roles: list, total: list.length },
        summary: `共 ${list.length} 个角色`,
      };
    }

    // ── 用户-角色绑定 ──
    if (target === 'users') {
      const roleNameById = new Map(config.roles.map((r) => [r.id, r.name]));
      const list = config.userRoles
        .filter((u) => (kw ? u.email.toLowerCase().includes(kw) : true))
        .slice(0, MAX_ITEMS)
        .map((u) => ({
          email: u.email,
          role_id: u.roleId,
          role_name: roleNameById.get(u.roleId) ?? '未知角色',
          assigned_at: u.assignedAt,
        }));
      return {
        ok: true,
        data: { users: list, total: list.length },
        summary: `共 ${list.length} 条用户-角色绑定`,
      };
    }

    // ── 权限码 ──
    const list = metas
      .filter((m) => {
        if (!kw) return true;
        return (
          m.code.toLowerCase().includes(kw)
          || m.label.toLowerCase().includes(kw)
          || (m.group_name ?? '').toLowerCase().includes(kw)
        );
      })
      .slice(0, MAX_ITEMS)
      .map((m) => ({
        code: m.code,
        label: m.label,
        group_name: m.group_name,
        type: m.type,
        route: m.route ?? '',
        description: m.description,
      }));
    return {
      ok: true,
      data: { permissions: list, total: list.length },
      summary: `共 ${list.length} 个权限码`,
    };
  },
};
