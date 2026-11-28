/**
 * query_current_user 工具实现
 * @description 查询当前登录用户身份：邮箱、是否超级管理员、角色、首次/最近登录时间。
 *              只读，且只返回当前用户自己（由 JWT 注入的 ctx.userEmail 决定），不返回他人信息。
 */

import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import type { ToolImpl, ToolResult, ToolContext } from '@/types/ai-chat';

/**
 * 格式化数据库时间
 * @param {unknown} value - MySQL DATETIME（Date 对象或字符串）
 * @returns {string} 本地时区可读时间；无效值返回空串
 */
const toTime = (value: unknown): string => {
  const ts = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ''));
  return Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '';
};

export const queryCurrentUserTool: ToolImpl = {
  name: 'query_current_user',
  description:
    '查询当前登录用户是谁：返回邮箱、是否超级管理员、角色、首次登录与最近登录时间。'
    + '用于回答「我是谁」「现在登录的用户是谁」「我是什么角色」「我的账号信息」等问题。'
    + '只读，且只返回当前用户本人的信息，不能查询其他用户。',
  parameters: {
    type: 'object',
    properties: {},
  },
  examples: [
    { user: '我是谁？', args: {} },
    { user: '现在登录的用户是谁', args: {} },
    { user: '我是什么角色', args: {} },
  ],
  invoke: async (_args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const email = ctx.userEmail?.trim();
    if (!email) {
      return { ok: false, data: '无法识别当前用户（请求未携带登录态）' };
    }
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT email, is_admin, role_key, role_name, first_login_at, last_login_at
       FROM hp_v_user_info WHERE email = ? LIMIT 1`,
      [email],
    );
    const row = rows[0];
    if (!row) {
      return { ok: false, data: `当前用户 ${email} 在用户表中没有记录` };
    }
    const isAdmin = Number(row.is_admin) === 1;
    const roleName = row.role_name ? String(row.role_name) : '';
    const roleLabel = isAdmin ? '超级管理员' : (roleName || '普通用户');
    const lastLoginAt = toTime(row.last_login_at);
    return {
      ok: true,
      data: {
        email: String(row.email),
        is_admin: isAdmin,
        role_key: row.role_key ? String(row.role_key) : null,
        role_name: roleName || null,
        role_label: roleLabel,
        first_login_at: toTime(row.first_login_at),
        last_login_at: lastLoginAt,
      },
      summary: `当前登录用户 ${email}，${roleLabel}，最近登录 ${lastLoginAt || '未知'}`,
    };
  },
};
