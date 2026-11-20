import {
  SIDE_EFFECT_TOOLS,
  type ChatMessage,
  type ToolContext,
  type ToolImpl,
} from '@/types/ai-chat';
import { getAvailableTools } from './tools';
import { buildSystemPrompt } from './system-prompt';
import { runAgentLoop } from './agent-loop';
import { listSkillMetas } from './skill-docs';

/**
 * 子 Agent（Sub-Agent）
 * @description 存在的唯一理由：**上下文隔离**。
 *   主 Agent 连续查 5 个工具后，几万字的原始 JSON 会一直挂在它的上下文里推高 token、
 *   稀释注意力。子 Agent 拿一个独立的小循环去完成子任务（比如「把近三天日志里的报错摘出来」），
 *   只把结论（几百字）交回主 Agent，主上下文保持干净。
 */

/** 子 Agent 最大迭代轮次（比主循环小：子任务应当几步内收敛） */
const SUB_AGENT_MAX_ITERATIONS = 4;

/** 子 Agent 不允许使用的工具：副作用工具、联网搜索、以及它自己（防止递归委派） */
const SUB_AGENT_FORBIDDEN_TOOLS = new Set<string>([
  ...SIDE_EFFECT_TOOLS,
  'web_search',
  'delegate_task',
]);

/** 子 Agent 输入 */
export interface SubAgentInput {
  /** 子任务描述（写给子 Agent 的指令，应包含足够的约束与输出要求） */
  task: string;
  /** 执行上下文（用户与权限） */
  context: ToolContext;
  /** 允许子 Agent 使用的工具名（不传则用全部只读工具） */
  allowedToolNames?: string[];
  /** 指定模型 */
  model?: string;
}

/** 子 Agent 结果 */
export interface SubAgentResult {
  /** 是否成功产出结论 */
  ok: boolean;
  /** 结论正文（回传给主 Agent） */
  answer: string;
  /** 子 Agent 内部的工具调用次数 */
  tool_calls: number;
  /** 子 Agent 实际迭代轮次 */
  iterations: number;
}

/**
 * 跑一个子 Agent
 * @param {SubAgentInput} input - 子 Agent 输入
 * @returns {Promise<SubAgentResult>} 子 Agent 结论
 * @description 子 Agent 的 system prompt 由主 prompt 拼接「只做子任务 + 只回结论」的约束构成，
 *   不复用会话历史——复用就失去了隔离的意义。
 */
export const runSubAgent = async (input: SubAgentInput): Promise<SubAgentResult> => {
  const allReadOnly: ToolImpl[] = getAvailableTools(input.context.userPermissions)
    .filter((t) => !SUB_AGENT_FORBIDDEN_TOOLS.has(t.name));
  const allowed = input.allowedToolNames?.filter(Boolean) ?? [];
  const tools: ToolImpl[] = allowed.length > 0
    ? allReadOnly.filter((t) => allowed.includes(t.name))
    : allReadOnly;

  // 子 Agent 只给只读类技能说明书：它本就被禁用副作用工具，不该被 action / mutation 文档带偏
  const system = `${buildSystemPrompt(
    tools.length > 0,
    tools.map((t) => t.name),
    undefined,
    listSkillMetas(input.context.userPermissions, 'read'),
  )}\n`
    + '## 你正在作为子 Agent 执行一个子任务\n'
    + '- 只完成下面这一件事，不扩展范围、不向用户提问\n'
    + '- 最后只输出**结论本身**（要点列表或短段落），不要写「我是子 Agent」之类的过程说明\n'
    + '- 结论控制在 300 字以内；查不到就如实说查不到\n';

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: input.task },
  ];

  let answer = '';
  let toolCalls = 0;
  let iterations = 0;

  for await (const ev of runAgentLoop({
    messages,
    context: input.context,
    tools,
    enableTools: tools.length > 0,
    enablePlanning: false,
    model: input.model,
    maxIterations: SUB_AGENT_MAX_ITERATIONS,
    conversationId: 'sub-agent',
  })) {
    if (ev.type === 'content_delta') answer += ev.delta;
    if (ev.type === 'iteration_end') iterations += 1;
    if (ev.type === 'tool_call_result') toolCalls += 1;
    if (ev.type === 'error') answer += `\n（子任务执行出错：${ev.message}）`;
  }

  return {
    ok: answer.trim().length > 0,
    answer: answer.trim(),
    tool_calls: toolCalls,
    iterations,
  };
};
