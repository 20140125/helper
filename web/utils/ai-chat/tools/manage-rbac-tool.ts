import { readRbacConfig, writeRbacConfig, readAllPermissionCodes } from '@/utils/rbac';
import type { RoleConfig, UserRole } from '@/types/rbac';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import type { Permission } from '@/types/permission';

/**
 * 生成「YYYY-MM-DD HH:mm:ss」时间戳
 * @returns {string} 本地时间字符串
 */
const nowStamp = (): string => {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
    + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

/**
 * 解析并校验权限码列表
 * @param {unknown} raw - LLM 传入的 permissions（逗号分隔字符串或数组）
 * @returns {{ ok: true; list: Permission[] } | { ok: false; reason: string }} 校验结果
 * @description 权限码必须已在 .cache/permission_metas.json 中登记，防止 LLM 编造权限码
 */
const parsePermissions = async (
  raw: unknown,
): Promise<{ ok: true; list: Permission[] } | { ok: false; reason: string }> => {
  const arr = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter(Boolean)
    : typeof raw === 'string'
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  if (arr.length === 0) return { ok: false, reason: 'permissions 不能为空' };

  const allowed = new Set<string>(await readAllPermissionCodes());
  const unknown = arr.filter((p) => !allowed.has(p));
  if (unknown.length > 0) {
    return { ok: false, reason: `未知权限码：${unknown.join('、')}（先用 query_rbac 查已登记的权限码）` };
  }
  return { ok: true, list: arr as Permission[] };
};

/**
 * manage_rbac 工具实现（角色与用户授权写能力）
 * @description 把 RBAC 的增删改从 Web 页面开放给贾维斯，并纳入副作用白名单——
 *   严格模式下会先建审批单，由超级管理员通过后生效，避免 AI 擅自改权限。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把 alice@xx.com 设成管理员"    → { action: 'assign_role', email: 'alice@xx.com', role_id: 'role_admin' }
 *   - "建一个只读角色"                → { action: 'create_role', role_name: '只读', permissions: ['dashboard:view'] }
 *   - "给运营角色加上规则编辑权限"    → { action: 'update_role_permissions', role_id: 'role_ops', permissions: [...] }
 */
export const manageRbacTool: ToolImpl = {
  name: 'manage_rbac',
  description:
    '管理角色与用户授权：分配 / 收回角色、新建角色、调整角色权限。'
    + '不确定 role_id 或权限码时先用 query_rbac 查清单，禁止编造。'
    + '操作口径与影响面（内置角色不可删、改权限影响该角色下所有人）加载 rbac-manage 技能后再调。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['assign_role', 'revoke_role', 'create_role', 'update_role_permissions'],
        description: '操作类型',
      },
      email: { type: 'string', description: '用户邮箱（assign_role / revoke_role 必填）' },
      role_id: { type: 'string', description: '角色 ID（assign_role / update_role_permissions 必填）' },
      role_name: { type: 'string', description: '角色显示名（create_role 必填）' },
      description: { type: 'string', description: '角色描述（create_role 可选）' },
      permissions: {
        type: 'string',
        description: '权限码，英文逗号分隔（create_role / update_role_permissions 必填）',
      },
    },
    required: ['action'],
  },
  requiredPermissions: ['rbac:roles:edit', 'rbac:users:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const action = typeof args.action === 'string' ? args.action.trim() : '';
    const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : '';
    const roleId = typeof args.role_id === 'string' ? args.role_id.trim() : '';
    const roleName = typeof args.role_name === 'string' ? args.role_name.trim() : '';
    const description = typeof args.description === 'string' ? args.description.trim() : '';

    const config = await readRbacConfig();

    // ── 分配 / 改角色 ──
    if (action === 'assign_role') {
      if (!email || !email.includes('@')) return { ok: false, data: 'email 不能为空且必须是合法邮箱' };
      const role = config.roles.find((r) => r.id === roleId);
      if (!role) {
        return {
          ok: false,
          data: `角色 ${roleId || '空'} 不存在。现有角色：${config.roles.map((r) => `${r.id}(${r.name})`).join('、')}`,
        };
      }
      const stamp = nowStamp();
      const idx = config.userRoles.findIndex((u) => u.email === email);
      const binding: UserRole = { email, roleId, assignedAt: stamp };
      if (idx === -1) config.userRoles.push(binding);
      else config.userRoles[idx] = binding;
      await writeRbacConfig(config);
      return {
        ok: true,
        data: { email, role_id: roleId, role_name: role.name },
        summary: `已将 ${email} 设为「${role.name}」`,
      };
    }

    // ── 收回角色 ──
    if (action === 'revoke_role') {
      if (!email) return { ok: false, data: 'email 不能为空' };
      const before = config.userRoles.length;
      config.userRoles = config.userRoles.filter((u) => u.email !== email);
      if (config.userRoles.length === before) {
        return { ok: false, data: `${email} 当前没有分配任何角色，无需收回` };
      }
      await writeRbacConfig(config);
      return { ok: true, data: { email, revoked: true }, summary: `已收回 ${email} 的角色` };
    }

    // ── 新建角色 ──
    if (action === 'create_role') {
      if (!roleName) return { ok: false, data: 'role_name 不能为空' };
      const parsed = await parsePermissions(args.permissions);
      if (!parsed.ok) return { ok: false, data: parsed.reason };
      const stamp = nowStamp();
      const id = `role_${Date.now()}`;
      const role: RoleConfig = {
        id,
        name: roleName,
        description: description || roleName,
        permissions: parsed.list,
        builtin: false,
        created_at: stamp,
        updated_at: stamp,
      };
      config.roles.push(role);
      await writeRbacConfig(config);
      return {
        ok: true,
        data: { role_id: id, name: role.name, permissions: role.permissions },
        summary: `已新建角色「${role.name}」（${id}），含 ${role.permissions.length} 项权限`,
      };
    }

    // ── 改角色权限 ──
    if (action === 'update_role_permissions') {
      const role = config.roles.find((r) => r.id === roleId);
      if (!role) {
        return {
          ok: false,
          data: `角色 ${roleId || '空'} 不存在。现有角色：${config.roles.map((r) => `${r.id}(${r.name})`).join('、')}`,
        };
      }
      const parsed = await parsePermissions(args.permissions);
      if (!parsed.ok) return { ok: false, data: parsed.reason };
      role.permissions = parsed.list;
      role.updated_at = nowStamp();
      await writeRbacConfig(config);
      return {
        ok: true,
        data: { role_id: role.id, name: role.name, permissions: role.permissions },
        summary: `角色「${role.name}」权限已更新为 ${role.permissions.length} 项`,
      };
    }

    return { ok: false, data: `未知 action：${action || '空'}（可选 assign_role / revoke_role / create_role / update_role_permissions）` };
  },
};
