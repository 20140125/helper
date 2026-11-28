import fs from 'fs';
import {
  AI_APPROVALS_FILE,
  type ApprovalRequest,
  type ApprovalStatus,
  type ToolContext,
} from '@/types/ai-chat';
import { findTool } from './tools';
import { appendMessage } from './conversation-store';
import { getUserPermissionsByEmail } from '@/utils/rbac';
import { isAdminEmail } from '@/utils/auth';
import { readEnvFile } from '@/utils/env';

/**
 * 副作用操作审批单
 * @description Human-in-the-loop 的落点：LLM 不直接执行副作用，而是开一张单子等人批。
 *   审批人点「通过」时才真正 invoke 工具，且用的是**审批人自己的权限**——
 *   发起人权限不足时，不能靠 AI 绕过。
 */

/** 审批单列表上限（超出丢弃最旧的已终结单） */
const MAX_APPROVALS = 200;

/**
 * 是否开启「严格副作用模式」
 * @returns {boolean} 开启后副作用工具不再当场执行，而是先建审批单
 * @description 进程环境变量优先（启动时 dotenv 已载入），为空时回退 readEnvFile() 读 web/.env；
 *              取值方式与 amap 系列工具保持一致，便于在 .env 里统一维护。
 */
export const isStrictSideEffects = (): boolean => {
  const raw = (
    process.env.AI_STRICT_SIDE_EFFECTS ?? readEnvFile().AI_STRICT_SIDE_EFFECTS ?? ''
  ).trim().toLowerCase();
  return raw === 'true' || raw === '1';
};

/**
 * 读取全部审批单
 * @returns {ApprovalRequest[]} 按创建时间倒序
 */
export const listApprovals = (): ApprovalRequest[] => {
  if (!fs.existsSync(AI_APPROVALS_FILE)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(AI_APPROVALS_FILE, 'utf-8')) as ApprovalRequest[];
    return Array.isArray(list) ? list.sort((a, b) => b.created_at - a.created_at) : [];
  } catch {
    return [];
  }
};

/**
 * 写入审批单列表
 * @param {ApprovalRequest[]} list - 审批单列表
 * @returns {void}
 */
const writeApprovals = (list: ApprovalRequest[]): void => {
  const trimmed = list
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, MAX_APPROVALS);
  try {
    fs.writeFileSync(AI_APPROVALS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[ai-approval] 写入失败：${(err as Error).message}`);
  }
};

/**
 * 创建一张审批单
 * @param {object} input - 创建参数
 * @param {string} input.user - 发起人邮箱
 * @param {string} input.conversationId - 来源会话
 * @param {string} input.tool - 目标工具名
 * @param {Record<string, unknown>} input.args - 工具参数
 * @param {string} input.reason - 申请理由
 * @returns {ApprovalRequest} 新建的审批单
 * @description 只接受副作用工具：纯查询开审批单没有意义，也避免把审批队列变成噪音。
 */
export const createApproval = (input: {
  user: string;
  conversationId: string;
  tool: string;
  args: Record<string, unknown>;
  reason: string;
}): ApprovalRequest => {
  const now = Date.now();
  const request: ApprovalRequest = {
    id: `apr_${now}_${Math.random().toString(36).slice(2, 8)}`,
    user: input.user,
    conversation_id: input.conversationId,
    tool: input.tool,
    args: input.args ?? {},
    reason: input.reason,
    status: 'pending',
    created_at: now,
  };
  const list = listApprovals();
  list.unshift(request);
  writeApprovals(list);
  return request;
};

/**
 * 按 ID 查找审批单
 * @param {string} id - 审批单 ID
 * @returns {ApprovalRequest | undefined} 审批单
 */
export const findApproval = (id: string): ApprovalRequest | undefined =>
  listApprovals().find((a) => a.id === id);

/**
 * 更新审批单（合并字段后整体写回）
 * @param {string} id - 审批单 ID
 * @param {Partial<ApprovalRequest>} patch - 要合并的字段
 * @returns {ApprovalRequest | null} 更新后的审批单；不存在返回 null
 */
export const updateApproval = (
  id: string,
  patch: Partial<ApprovalRequest>,
): ApprovalRequest | null => {
  const list = listApprovals();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  writeApprovals(list);
  return list[idx];
};

/**
 * 把审批结果回写到发起人的会话
 * @param {Pick<ApprovalRequest, 'user' | 'conversation_id' | 'id' | 'tool'>} request - 审批单
 * @param {ApprovalStatus} status - 终态（executed / failed / rejected）
 * @param {string} decidedBy - 审批人邮箱（作废场景传 'system'）
 * @param {string} [result] - 执行结果 / 驳回原因
 * @returns {boolean} 是否真的回写成功（没有会话 ID 或会话不存在返回 false）
 * @description 审批是异步的：发起人建完单就离开对话，审批人稍后在 /approvals 拍板。
 *   没有回传的话发起人完全不知道结果，只会反复重试。这里往发起人的那条会话里
 *   追加一条 assistant 消息，他下次打开对话就能看到结论。
 */
export const notifyApprovalResult = (
  request: Pick<ApprovalRequest, 'user' | 'conversation_id' | 'id' | 'tool'>,
  status: ApprovalStatus,
  decidedBy: string,
  result?: string,
): boolean => {
  if (!request.conversation_id || !request.user) return false;
  const verdict = status === 'executed' ? '已通过并执行' : status === 'rejected' ? '已驳回' : '执行失败';
  const lines = [
    '### 审批结果通知',
    '',
    `> 你提交的 \`${request.tool}\` 审批单 \`${request.id}\` ${verdict}（审批人：${decidedBy}）。`,
  ];
  if (result) lines.push('', `**结果**：${result}`);
  if (status !== 'executed') lines.push('', '如需继续，请在本对话重新发起。');

  try {
    appendMessage(request.user, request.conversation_id, {
      role: 'assistant',
      content: lines.join('\n'),
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * 批量作废仍处于待审批的审批单
 * @param {string[]} ids - 审批单 ID 列表
 * @param {string} reason - 作废原因（写入 result 字段，审批列表可见）
 * @returns {number} 实际作废的张数
 * @description 场景：严格模式下 request_approval 建单成功后，本轮 LLM 回复却因限流/
 *   网络异常/用户中止没有送达——用户什么都看不到，只会反复重试造成重复审批单。
 *   agent-loop 在失败出口统一调用本函数，把本轮建的单标记为 failed。
 */
export const cancelPendingApprovals = (ids: string[], reason: string): number => {
  let cancelled = 0;
  for (const id of ids) {
    const request = findApproval(id);
    if (request && isPending(request.status)) {
      updateApproval(id, {
        status: 'failed',
        decided_by: 'system',
        decided_at: Date.now(),
        result: reason,
      });
      cancelled += 1;
    }
  }
  return cancelled;
};

/**
 * 审批通过后真正执行工具
 * @param {string} id - 审批单 ID
 * @param {string} operator - 审批人邮箱
 * @returns {Promise<ApprovalRequest | null>} 执行后的审批单；不存在返回 null
 * @description 执行身份取审批人而非发起人：谁批准谁负责，权限也按审批人的算。
 */
export const executeApproval = async (
  id: string,
  operator: string,
): Promise<ApprovalRequest | null> => {
  const request = findApproval(id);
  if (!request) return null;

  // 审批权只给超级管理员：有权限的管理员可以建单，但拍板必须由超级管理员完成
  const reject = (result: string): ApprovalRequest | null => {
    const updated = updateApproval(id, {
      status: 'failed',
      decided_by: operator,
      decided_at: Date.now(),
      result,
    });
    if (updated) notifyApprovalResult(request, 'failed', operator, result);
    return updated;
  };

  if (!isAdminEmail(operator)) {
    return reject('仅超级管理员可审批通过');
  }

  const tool = findTool(request.tool);
  if (!tool) {
    return reject(`未知工具：${request.tool}`);
  }

  const isAdmin = isAdminEmail(operator);
  const permissions: string[] = await getUserPermissionsByEmail(operator, isAdmin);
  const required = tool.requiredPermissions ?? [];
  if (required.length > 0 && !required.some((p) => permissions.includes(p))) {
    return reject(`审批人权限不足（需 ${required.join(' 或 ')}）`);
  }

  // 统一收口：落终态 + 把结果回写到发起人的会话（没有会话 ID 时静默跳过）
  const finish = (status: ApprovalStatus, result: string): ApprovalRequest | null => {
    const updated = updateApproval(id, {
      status,
      decided_by: operator,
      decided_at: Date.now(),
      result,
    });
    if (updated) notifyApprovalResult(request, status, operator, result);
    return updated;
  };

  const context: ToolContext = { userEmail: operator, userPermissions: permissions };

  try {
    const result = await tool.invoke(request.args ?? {}, context);
    return finish(result.ok ? 'executed' : 'failed', result.summary ?? JSON.stringify(result.data).slice(0, 300));
  } catch (err) {
    return finish('failed', (err as Error).message);
  }
};

/**
 * 审批单是否处于可决策状态
 * @param {ApprovalStatus} status - 当前状态
 * @returns {boolean} pending 时返回 true
 */
export const isPending = (status: ApprovalStatus): boolean => status === 'pending';

/** 透出可审批工具白名单（定义下沉到 types 层，避免与 tools/ 形成循环依赖） */
export { APPROVABLE_TOOLS } from '@/types/ai-chat';
