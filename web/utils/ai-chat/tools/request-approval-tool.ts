import { APPROVABLE_TOOLS, type ToolImpl, type ToolResult } from '@/types/ai-chat';
import { createApproval, listApprovals } from '../approval-store';

/**
 * request_approval 工具实现（Human-in-the-loop）
 * @description 让 LLM 把副作用操作「挂起」等待人工审批，而不是当场执行。
 *   适用于：用户说「先别发，等我确认」「走一下审批」，
 *   或开启严格模式（AI_STRICT_SIDE_EFFECTS=true，此时增删改类工具由 agent-loop 自动建单，不经过本工具）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "拟一条重启守护进程的通知，等我批准再发"  → { tool: 'send_wecom_message', args: { content: '...', user_consent_phrase: '等我批准再发' }, reason: '用户要求审批后再推送' }
 */
export const requestApprovalTool: ToolImpl = {
  name: 'request_approval',
  description:
    '为一次副作用操作创建人工审批单（不立即执行）。'
    + '当用户明确要求「先别执行 / 等我确认 / 走审批」，或你判断该操作影响面较大时，用它建单而不是直接执行。'
    + '建单后告知用户审批单 ID 与待执行内容，由用户在审批列表里通过或驳回。',
  parameters: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        description: `待审批的工具名，必须是副作用工具之一：${APPROVABLE_TOOLS.join(' / ')}`,
      },
      args: {
        type: 'object',
        description: '该工具的完整参数（与直接调用时一致）',
      },
      reason: {
        type: 'string',
        description: '申请理由：为什么要做这件事、影响面是什么',
      },
    },
    required: ['tool', 'args', 'reason'],
  },
  requiredPermissions: ['ai-approvals:edit'],
  invoke: async (args, ctx): Promise<ToolResult> => {
    const tool = typeof args.tool === 'string' ? args.tool.trim() : '';
    if (!APPROVABLE_TOOLS.includes(tool)) {
      return { ok: false, data: `不支持审批的工具：${tool}（仅支持 ${APPROVABLE_TOOLS.join(' / ')}）` };
    }
    const toolArgs = (args.args ?? {}) as Record<string, unknown>;
    const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
    if (!reason) {
      return { ok: false, data: 'reason 不能为空：必须说明为什么要执行该操作' };
    }

    // 防重：同工具 + 同参数的待审批单已存在时直接复用，不重复建单
    // （用户没看到回复就重试是最常见的重复来源）
    const argsJson = JSON.stringify(toolArgs);
    const duplicate = (await listApprovals()).find(
      (a) => a.status === 'pending' && a.tool === tool && JSON.stringify(a.args ?? {}) === argsJson,
    );
    if (duplicate) {
      return {
        ok: true,
        data: { approval_id: duplicate.id, status: duplicate.status, duplicate: true },
        summary: `已有同内容的待审批单 ${duplicate.id}，未重复创建`,
      };
    }

    const request = await createApproval({
      user: ctx.userEmail,
      conversationId: ctx.conversationId ?? '',
      tool,
      args: toolArgs,
      reason,
    });
    // 登记到本轮上下文：若本轮 LLM 回复失败（限流/中止），agent-loop 会把仍待审批的单统一作废
    ctx.createdApprovalIds?.push(request.id);
    return {
      ok: true,
      data: { approval_id: request.id, status: request.status },
      summary: `已创建审批单 ${request.id}，等待人工确认`,
    };
  },
};
