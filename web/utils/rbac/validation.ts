import type { PermissionBody } from '@/types/rbac';

// ==============================
// 权限字段验证
// ==============================

/**
 * 验证权限通用字段（不含 code），返回错误消息；通过则返回 null
 * @param body - 权限请求体
 * @returns 错误消息或 null
 */
export const validatePermissionFields = (body: PermissionBody): string | null => {
  if (!body.group_id?.trim()) return '分组 ID 不能为空';
  if (!body.group_name?.trim()) return '分组名称不能为空';
  if (!body.label?.trim()) return '权限名称不能为空';
  if (!body.type || !(['view', 'edit'] as string[]).includes(body.type)) return '权限类型必须为 view 或 edit';
  if (body.type === 'view' && !body.route?.trim()) return 'view 类型的权限必须填写路由地址';
  return null;
};
