import {
  MAX_PLAN_STEPS,
  type AgentPlan,
  type AgentPlanStep,
  type AgentReflection,
  type ChatMessage,
  type PlanStepStatus,
} from '@/types/ai-chat';
import { chatCompletion } from './llm-client';
import { extractMessageText } from './content';

// ──────────────────────────
// 内部工具
// ──────────────────────────

/**
 * 从 LLM 输出中抠出第一个 JSON 对象
 * @param {string} raw - 模型原始输出（可能带 ```json 围栏或前后废话）
 * @returns {Record<string, unknown> | null} 解析成功的对象；失败返回 null
 * @description 先用围栏匹配，再退化到「首个 { 到最后一个 }」的贪心截取，
 *   最后 JSON.parse；任一环节失败都返回 null，由调用方降级处理。
 */
export const extractJsonObject = (raw: string): Record<string, unknown> | null => {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * 取会话中最后一条用户消息文本
 * @param {ChatMessage[]} messages - 完整会话消息
 * @returns {string} 最后一条用户消息（找不到返回空串）
 */
const lastUserText = (messages: ChatMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return extractMessageText(messages[i].content);
  }
  return '';
};

// ──────────────────────────
// 规划（Planning）
// ──────────────────────────

/**
 * 构造规划器的 system / user 消息
 * @param {string} userText - 用户诉求原文
 * @param {string[]} toolNames - 本次可用工具名清单
 * @returns {ChatMessage[]} 供 chatCompletion 使用的消息列表
 */
const buildPlannerMessages = (userText: string, toolNames: string[]): ChatMessage[] => {
  const system: ChatMessage = {
    role: 'system',
    content: [
      '你是任务规划器。把用户诉求拆解成有序、可执行的步骤，只输出 JSON，不要任何解释文字。',
      '输出格式：',
      '{"goal":"一句话目标","steps":[{"id":"s1","title":"步骤标题","tool":"工具名或省略"}]}',
      '约束：',
      `1. 步骤数 1-${MAX_PLAN_STEPS}；能一步直达的就不要拆多步`,
      '2. tool 只能从给定工具清单里选，纯分析/总结步骤不要带 tool',
      '3. title 用简体中文，一句话说清「做什么」，不要写「调用工具」这类空话',
      '4. 用户只是闲聊、提问常识或让你解释概念时，返回空 steps：{"goal":"...","steps":[]}',
      `可用工具：${toolNames.join('、') || '（无）'}`,
    ].join('\n'),
  };
  return [system, { role: 'user', content: userText }];
};

/**
 * 调用 LLM 生成执行计划
 * @param {string} userText - 用户诉求原文
 * @param {string[]} toolNames - 本次可用工具名清单
 * @param {string | undefined} model - 模型 ID
 * @returns {Promise<AgentPlan | null>} 计划；规划失败（超时/非 JSON/空输出）返回 null
 * @description 规划是「尽力而为」的增强：任何异常都吞掉并返回 null，
 *   由 Agent Loop 降级为无计划直跑，保证主链路不受影响。
 */
export const generatePlan = async (
  userText: string,
  toolNames: string[],
  model: string | undefined,
  signal?: AbortSignal,
): Promise<AgentPlan | null> => {
  if (!userText.trim()) return null;
  try {
    const result = await chatCompletion(
      buildPlannerMessages(userText, toolNames),
      undefined,
      model,
      signal,
    );
    const parsed = extractJsonObject(result.content);
    if (!parsed) return null;

    const goal = typeof parsed.goal === 'string' ? parsed.goal.trim() : '';
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps: AgentPlanStep[] = rawSteps
      .slice(0, MAX_PLAN_STEPS)
      .map((s, idx): AgentPlanStep | null => {
        if (!s || typeof s !== 'object') return null;
        const item = s as Record<string, unknown>;
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!title) return null;
        const id = typeof item.id === 'string' && item.id ? item.id : `s${idx + 1}`;
        const tool = typeof item.tool === 'string' && toolNames.includes(item.tool)
          ? item.tool
          : undefined;
        return { id, title, tool, status: 'pending' as PlanStepStatus };
      })
      .filter((s): s is AgentPlanStep => s !== null);

    return { goal: goal || userText.slice(0, 60), steps, planned: true };
  } catch {
    return null;
  }
};

/**
 * 把计划渲染成注入上下文的提示文本
 * @param {AgentPlan} plan - 执行计划
 * @returns {ChatMessage} 一条 system 消息，供拼进会话上下文
 * @description 以 system 角色注入而非 user，避免污染「用户说了什么」的语义；
 *   同时明确「可按实际情况调整」，防止模型被计划绑死、遇到异常也不敢改道。
 */
export const formatPlanAsMessage = (plan: AgentPlan): ChatMessage => {
  const lines: string[] = ['## 执行计划（规划器产出，可按实际结果调整，不必死守）'];
  lines.push(`目标：${plan.goal}`);
  if (plan.steps.length > 0) {
    plan.steps.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.title}${s.tool ? `（工具：${s.tool}）` : ''}`);
    });
  } else {
    lines.push('（本轮无需工具调用，直接回答即可）');
  }
  return { role: 'system', content: lines.join('\n') };
};

/**
 * 按工具调用结果推进计划步骤状态
 * @param {AgentPlan} plan - 执行计划（原地修改）
 * @param {string} toolName - 刚执行完的工具名
 * @param {boolean} ok - 工具是否成功
 * @returns {AgentPlanStep | null} 被更新的步骤；无匹配返回 null
 * @description 匹配策略：优先找「声明了该 tool 且仍 pending」的步骤，
 *   找不到则退化为「第一个 pending 步骤」，避免 LLM 换工具时计划卡在 pending。
 */
export const advancePlanStep = (
  plan: AgentPlan,
  toolName: string,
  ok: boolean,
): AgentPlanStep | null => {
  const step = plan.steps.find((s) => s.tool === toolName && s.status === 'pending')
    ?? plan.steps.find((s) => s.status === 'pending');
  if (!step) return null;
  step.status = ok ? 'done' : 'failed';
  return step;
};

/**
 * 把计划中仍未推进的步骤标记为跳过
 * @param {AgentPlan} plan - 执行计划（原地修改）
 * @returns {AgentPlanStep[]} 被标记的步骤列表
 */
export const skipRestPlanSteps = (plan: AgentPlan): AgentPlanStep[] => {
  const skipped: AgentPlanStep[] = [];
  for (const s of plan.steps) {
    if (s.status === 'pending' || s.status === 'running') {
      s.status = 'skipped';
      skipped.push(s);
    }
  }
  return skipped;
};

// ──────────────────────────
// 反思（Reflection）
// ──────────────────────────

/**
 * 构造反思器的消息列表
 * @param {string} userText - 用户原始诉求
 * @param {string} draftAnswer - Agent 当前给出的草稿回答
 * @param {string[]} toolNames - 可用工具名
 * @returns {ChatMessage[]} 供 chatCompletion 使用的消息列表
 */
const buildReflectionMessages = (
  userText: string,
  draftAnswer: string,
  toolNames: string[],
): ChatMessage[] => {
  const system: ChatMessage = {
    role: 'system',
    content: [
      '你是质检员。判断「草稿回答」是否已经真正解决了用户诉求，只输出 JSON，不要解释文字。',
      '输出格式：',
      '{"complete":true|false,"missing":"还缺什么（一句话，complete 时留空）","hint":"下一步具体该做什么（complete 时留空）"}',
      '判定规则：',
      '1. 用户要查询而回答里没有真实数据、或回答含糊其辞/让用户自己去查 → complete=false',
      '2. 用户要执行动作而回答只是描述流程、没有真正调用工具 → complete=false',
      '3. 已经用工具拿到结果并做了总结 → complete=true',
      '4. 闲聊、概念解释、纯文本创作类 → complete=true',
      '5. hint 必须是可执行的下一步（如「调用 query_logs 查最近 1 小时 ERROR 日志」），不要写空话',
      `可建议的工具：${toolNames.join('、') || '（无）'}`,
    ].join('\n'),
  };
  const user: ChatMessage = {
    role: 'user',
    content: `用户诉求：\n${userText}\n\n草稿回答：\n${(draftAnswer || '（空）').slice(-4000)}`,
  };
  return [system, user];
};

/**
 * 对当前草稿回答做一次自我反思
 * @param {string} userText - 用户原始诉求
 * @param {string} draftAnswer - Agent 当前草稿回答
 * @param {string[]} toolNames - 可用工具名
 * @param {number} round - 第几轮反思（从 1 开始）
 * @param {string | undefined} model - 模型 ID
 * @returns {Promise<AgentReflection | null>} 反思结论；失败返回 null
 * @description 与规划同理：任何异常都吞掉返回 null，Loop 侧按「无反思」处理直接收尾。
 */
export const runReflection = async (
  userText: string,
  draftAnswer: string,
  toolNames: string[],
  round: number,
  model: string | undefined,
  signal?: AbortSignal,
): Promise<AgentReflection | null> => {
  try {
    const result = await chatCompletion(
      buildReflectionMessages(userText, draftAnswer, toolNames),
      undefined,
      model,
      signal,
    );
    const parsed = extractJsonObject(result.content);
    if (!parsed) return null;
    const complete = parsed.complete === true;
    return {
      round,
      complete,
      missing: typeof parsed.missing === 'string' ? parsed.missing.trim() : '',
      hint: typeof parsed.hint === 'string' ? parsed.hint.trim() : '',
    };
  } catch {
    return null;
  }
};

/**
 * 把反思结论渲染成注入上下文的提示文本
 * @param {AgentReflection} reflection - 反思结论
 * @returns {ChatMessage} 一条 system 消息（仅 complete=false 时有意义）
 */
export const formatReflectionAsMessage = (reflection: AgentReflection): ChatMessage => {
  const lines: string[] = [
    `## 自我反思（第 ${reflection.round} 轮）：上一条回答不充分，请补做`,
  ];
  if (reflection.missing) lines.push(`缺口：${reflection.missing}`);
  if (reflection.hint) lines.push(`下一步：${reflection.hint}`);
  lines.push('请立即执行上述下一步（必要时调用工具），然后直接给用户最终结论。');
  return { role: 'system', content: lines.join('\n') };
};

/**
 * 从会话消息中提取最后一条 assistant 的正文
 * @param {ChatMessage[]} messages - 会话消息
 * @returns {string} 最后一条 assistant 文本（找不到返回空串）
 */
export const lastAssistantText = (messages: ChatMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'assistant') return extractMessageText(messages[i].content);
  }
  return '';
};

export { lastUserText };
