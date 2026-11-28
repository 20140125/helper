import { readPermissionRequests } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 可过滤的申请状态 */
const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'all'] as const;

/** 返回条数上限 */
const MAX_ITEMS = 50;

/**
 * query_permission_requests 工具实现
 * @description 查询用户的权限申请记录（申请人、目标页面、原因、状态、审批人）。
 *              只读，不审批不拒绝（审批需在「权限申请」页面由管理员操作）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "有没有待审批的权限申请？"                        → { status: 'pending' }
 *   - "xxx@xx.com 申请过哪些权限"                       → { email: 'xxx@xx.com' }
 */
export const queryPermissionRequestsTool: ToolImpl = {
  name: 'query_permission_requests',
  description:
    '查询权限申请记录（申请人邮箱、目标页面、原因、状态、审批人与时间）。'
    + 'status 默认 pending（待审批），可选 approved / rejected / all。只读，不能审批。',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: [...REQUEST_STATUSES],
        description: '按状态过滤，默认 pending',
      },
      email: {
        type: 'string',
        description: '按申请人邮箱模糊匹配',
      },
    },
  },
  requiredPermissions: ['rbac:requests:view'],
  invoke: async (args): Promise<ToolResult> => {
    const status = typeof args.status === 'string' && args.status.trim()
      ? args.status.trim()
      : 'pending';
    if (!REQUEST_STATUSES.includes(status as (typeof REQUEST_STATUSES)[number])) {
      return { ok: false, data: `不支持 status="${status}"，可用：${REQUEST_STATUSES.join('、')}` };
    }
    const emailKw = typeof args.email === 'string' ? args.email.toLowerCase().trim() : '';

    const all = (await readPermissionRequests()).requests ?? [];
    const list = all
      .filter((r) => (status === 'all' ? true : r.status === status))
      .filter((r) => (emailKw ? r.email.toLowerCase().includes(emailKw) : true));

    const shown = list.slice(0, MAX_ITEMS);
    return {
      ok: true,
      data: {
        requests: shown.map((r) => ({
          request_id: r.request_id,
          email: r.email,
          from_path: r.fromPath,
          reason: r.reason ?? '',
          status: r.status,
          created_at: r.created_at,
          resolved_by: r.resolvedBy ?? '',
          resolved_at: r.resolvedAt ?? '',
          reject_reason: r.rejectReason ?? '',
        })),
        total: list.length,
        truncated: list.length > MAX_ITEMS,
      },
      summary: `${status === 'all' ? '全部' : status} 申请共 ${list.length} 条`,
    };
  },
};
