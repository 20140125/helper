import {
  SIDE_EFFECT_TOOLS,
  type AgentRunTrace,
  type ChatMessage,
  type ToolContext,
  type ToolImpl,
} from '@/types/ai-chat';
import { getAvailableTools } from './tools';
import { buildSystemPrompt } from './system-prompt';
import { runAgentLoop } from './agent-loop';
import { appendRunTrace } from './trace-store';
import { listSkillMetas } from './skill-docs';
import { notifyAllWebhooks } from '@/utils/wecom-notify';
import { getUserPermissionsByEmail } from '@/utils/rbac';
import { isAdminEmail } from '@/utils/auth';

/**
 * 外部渠道消息接入（群内 @机器人 → Agent → 回复）
 * @description 【能力边界要讲清楚】企业微信「群机器人」Webhook 是**单向**的：只能推，不能收。
 *   要接收群消息必须是自建应用回调 / 第三方 bot 转发到本服务的公网 URL。
 *   因此这里实现的是「通用消息入口」：任何渠道把消息 POST 进来，我们跑一次 Agent，
 *   再把回答推回已配置的机器人（即回到群里）。对企业微信而言，接收端那一步仍需回调转发。
 */

/** 外部消息输入 */
export interface IncomingMessageInput {
  /** 消息正文 */
  text: string;
  /** 发送者标识（仅用于日志与 Trace 归因） */
  sender?: string;
  /** 是否把回答推回群（默认 true） */
  reply?: boolean;
  /** 指定模型（不传走默认） */
  model?: string;
}

/** 外部消息处理结果 */
export interface IncomingMessageResult {
  /** 是否成功产出回答 */
  ok: boolean;
  /** 回答正文 */
  reply: string;
  /** 失败原因（成功为空串） */
  error: string;
  /** 本次运行 Trace ID */
  run_id: string;
  /** 消耗 token */
  total_tokens: number;
  /** 是否已推回群 */
  replied: boolean;
}

/**
 * 校验外部消息入口的调用令牌
 * @param {string | undefined} token - 请求携带的令牌
 * @returns {boolean} 通过返回 true
 * @description 未配置 AI_CHAT_WEBHOOK_TOKEN 时入口保持关闭（返回 false），避免裸奔的公网写接口。
 */
export const verifyWebhookToken = (token: string | undefined): boolean => {
  const expected = (process.env.AI_CHAT_WEBHOOK_TOKEN ?? '').trim();
  if (!expected) return false;
  return Boolean(token) && token === expected;
};

/**
 * 取外部消息的执行身份
 * @returns {string} 身份邮箱（AI_CHAT_WEBHOOK_EMAIL，未配置回退 MAIL_USERNAME）
 */
const resolveOperatorEmail = (): string =>
  (process.env.AI_CHAT_WEBHOOK_EMAIL ?? '').trim() || (process.env.MAIL_USERNAME ?? '').trim();

/**
 * 处理一条外部渠道消息：跑一次 Agent 并把回答推回群
 * @param {IncomingMessageInput} input - 消息输入
 * @returns {Promise<IncomingMessageResult>} 处理结果
 * @description 默认**剔除副作用工具**：群消息来自不可控来源，绝不能让群友一句话就触发推送/跑脚本。
 *   确需开启时用 AI_CHAT_WEBHOOK_ALLOW_SIDE_EFFECTS=true，并自行承担风险。
 */
export const handleIncomingMessage = async (
  input: IncomingMessageInput,
): Promise<IncomingMessageResult> => {
  const text = (input.text ?? '').trim();
  if (!text) {
    return { ok: false, reply: '', error: '消息内容为空', run_id: '', total_tokens: 0, replied: false };
  }

  const email = resolveOperatorEmail();
  if (!email) {
    return { ok: false, reply: '', error: '未配置 AI_CHAT_WEBHOOK_EMAIL / MAIL_USERNAME，无法确定执行身份', run_id: '', total_tokens: 0, replied: false };
  }

  const isAdmin = isAdminEmail(email);
  const permissions = getUserPermissionsByEmail(email, isAdmin);
  const context: ToolContext = { userEmail: email, userPermissions: permissions };

  const allowSideEffects = (process.env.AI_CHAT_WEBHOOK_ALLOW_SIDE_EFFECTS ?? '').trim() === 'true';
  const tools: ToolImpl[] = getAvailableTools(permissions)
    .filter((t) => t.name !== 'web_search')
    .filter((t) => allowSideEffects || !SIDE_EFFECT_TOOLS.includes(t.name));

  const messages: ChatMessage[] = [
    // 群消息默认只给只读类技能说明书，开了副作用开关才放开 action / mutation 类
    {
      role: 'system',
      content: buildSystemPrompt(
        true,
        tools.map((t) => t.name),
        undefined,
        listSkillMetas(permissions, allowSideEffects ? undefined : 'read'),
      ),
    },
    { role: 'user', content: text },
  ];

  let reply = '';
  let trace: AgentRunTrace | null = null;
  try {
    for await (const ev of runAgentLoop({
      messages,
      context: { ...context, allowedSkillEffects: allowSideEffects ? undefined : ['read'] },
      tools,
      enableTools: true,
      enablePlanning: false,
      model: input.model,
      conversationId: `webhook_${new Date().toISOString().slice(0, 10)}`,
    })) {
      if (ev.type === 'content_delta') reply += ev.delta;
      if (ev.type === 'run_trace') trace = ev.trace;
    }
  } catch (err) {
    return { ok: false, reply: '', error: (err as Error).message, run_id: '', total_tokens: 0, replied: false };
  }

  if (trace) appendRunTrace(trace);

  let replied = false;
  if ((input.reply ?? true) && reply.trim()) {
    try {
      replied = await notifyAllWebhooks(reply.trim());
    } catch (err) {
      console.warn(`[ai-webhook] 回复推送失败：${(err as Error).message}`);
    }
  }

  return {
    ok: reply.trim().length > 0,
    reply: reply.trim(),
    error: '',
    run_id: trace?.run_id ?? '',
    total_tokens: trace?.total_tokens ?? 0,
    replied,
  };
};
