import {
  MAX_AGENT_LOOP_ITERATIONS,
  MAX_REFLECTION_ROUNDS,
  MUTATION_TOOLS,
  SIDE_EFFECT_TOOLS,
  type AgentPlan,
  type AgentReflection,
  type AgentRunTrace,
  type ChatMessage,
  type ChatToolCall,
  type IterationTrace,
  type PlanStepStatus,
  type ToolCallTrace,
  type ToolContext,
  type ToolImpl,
  type ToolResult,
} from '@/types/ai-chat';
import { cancelPendingApprovals, createApproval, isStrictSideEffects, listApprovals } from './approval-store';
import {
  chatCompletionStream,
  chatCompletion,
  isModelStreamable,
  getLlmConfigForModel,
  type UsageInfo,
} from './llm-client';
import { buildToolDefinitions, findTool } from './tools';
import {
  advancePlanStep,
  formatPlanAsMessage,
  formatReflectionAsMessage,
  generatePlan,
  lastAssistantText,
  lastUserText,
  runReflection,
  skipRestPlanSteps,
} from './planning';
import { estimateCost } from './trace-stats';
import { detectInjection, wrapToolResult } from './guard';

/** Agent Loop 事件类型 */
export type AgentEvent =
  | { type: 'content_delta'; delta: string }
  /** 模型思考过程的增量文本（与正文分开推送，消费方独立折叠展示） */
  | { type: 'reasoning_delta'; delta: string }
  /** 反思判定未完成后会重写整份回答：此前吐出的内容作废，消费方应清空已累积文本 */
  | { type: 'content_reset' }
  | { type: 'tool_call_start'; tool_call_id: string; name: string }
  | { type: 'tool_call_args_delta'; tool_call_id: string; delta: string }
  | { type: 'tool_call_executing'; tool_call_id: string; name: string; arguments: string }
  | { type: 'tool_call_result'; tool_call_id: string; name: string; ok: boolean; data: unknown; summary?: string; duration_ms: number }
  | { type: 'plan_start'; goal: string; steps: { id: string; title: string; tool?: string }[] }
  | { type: 'plan_step'; step_id: string; title: string; status: PlanStepStatus }
  | { type: 'reflection'; round: number; complete: boolean; missing: string; hint: string }
  | { type: 'iteration_end'; iteration: number; finish_reason: string }
  | { type: 'iteration_usage'; iteration: number; usage: UsageInfo }
  | { type: 'final_messages'; messages: ChatMessage[] }
  | { type: 'notice'; message: string }
  | { type: 'error'; message: string }
  | { type: 'run_trace'; trace: AgentRunTrace };

/** Agent Loop 输入 */
export interface RunAgentLoopInput {
  /** 完整的对话消息（含 system prompt） */
  messages: ChatMessage[];
  /** 用户上下文（用于工具调用鉴权） */
  context: ToolContext;
  /** 可用的工具列表（已按用户权限过滤） */
  tools: ToolImpl[];
  /** 是否启用工具（false 时退化为纯对话） */
  enableTools: boolean;
  /** 本次会话使用的模型 ID（可选，不传则后端采默认值） */
  model?: string;
  /** 所属会话 ID（仅用于 Trace 归因，不影响对话逻辑） */
  conversationId?: string;
  /** 最大迭代轮次（子 Agent 用较小的值控制成本，不传用 MAX_AGENT_LOOP_ITERATIONS） */
  maxIterations?: number;
  /** 终止信号 */
  signal?: AbortSignal;
  /**
   * 是否启用 L3「规划 → 执行 → 反思」能力（默认 false）
   * @description 仅当 enableTools=true 且工具列表非空时生效；
   *   规划/反思的额外 LLM 调用失败时静默降级，不影响主链路。
   */
  enablePlanning?: boolean;
}

/** 单轮 LLM 流式输出累积结果 */
interface IterationStreamResult {
  assistantContent: string;
  partialToolCalls: Map<number, { id: string; name: string; arguments: string }>;
  finishReason: string;
  /** OpenAI usage（部分厂商可能不返回） */
  usage?: UsageInfo;
}

/**
 * 判断错误是否为客户端 abort 引起
 * @param {unknown} err - 错误对象
 * @param {AbortSignal} [signal] - 终止信号
 * @returns {boolean} 是否属于 abort 错误
 */
const isAbortError = (err: unknown, signal?: AbortSignal): boolean => {
  if (signal?.aborted) return true;
  const e = err as Error;
  if (e?.name === 'AbortError') return true;
  if (typeof e?.message === 'string' && /aborted/i.test(e.message)) return true;
  return false;
};

/**
 * 处理非流式 chatCompletion 的响应，填充累积结果并产出事件
 * @param {object} result - chatCompletion 返回值
 * @param {Map} partialToolCalls - 累积 Map（在函数内被填充）
 * @returns {AsyncGenerator<AgentEvent, { content: string; usage?: UsageInfo }>} 事件流 + content/usage
 */
async function* collectNonStreamingResult(
  result: Awaited<ReturnType<typeof chatCompletion>>,
  partialToolCalls: Map<number, { id: string; name: string; arguments: string }>,
): AsyncGenerator<AgentEvent, { content: string; usage?: UsageInfo }> {
  const content = result.content ?? '';
  if (content) {
    yield { type: 'content_delta', delta: content };
  }
  if (result.tool_calls && result.tool_calls.length > 0) {
    for (let i = 0; i < result.tool_calls.length; i += 1) {
      const tc = result.tool_calls[i];
      partialToolCalls.set(i, {
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      });
      yield { type: 'tool_call_start', tool_call_id: tc.id, name: tc.function.name };
      yield { type: 'tool_call_args_delta', tool_call_id: tc.id, delta: tc.function.arguments };
    }
  }
  return { content, usage: result.usage };
}

/**
 * 跑完单轮 LLM 流，按事件 yield 给上层，最终返回累积结果
 * @param {ChatMessage[]} conversationMessages - 当前对话上下文
 * @param {ToolDefinition[] | undefined} toolDefs - 工具协议定义
 * @param {AbortSignal | undefined} signal - 终止信号
 * @param {string | undefined} model - 模型 ID
 * @returns {AsyncGenerator<AgentEvent, IterationStreamResult | null>} 中间事件流；abort 时返回 null
 */
async function* streamOneIteration(
  conversationMessages: ChatMessage[],
  toolDefs: ReturnType<typeof buildToolDefinitions> | undefined,
  signal: AbortSignal | undefined,
  model: string | undefined,
): AsyncGenerator<AgentEvent, IterationStreamResult | null> {
  const partialToolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let assistantContent = '';
  let finishReason = '';
  let usage: UsageInfo | undefined;

  // 检查模型是否支持流式调用
  const streamable = await isModelStreamable(model ?? '');

  try {
    if (streamable) {
      // 重试提示先缓存：回调发生在 await 期间、无法直接 yield，拿到流后第一时间补发
      const pendingNotices: string[] = [];
      for await (const chunk of chatCompletionStream(
        conversationMessages,
        toolDefs,
        signal,
        model,
        (attempt, delayMs, reason) => {
          const cause = reason === 'rate_limit' ? '模型限流（429）' : '网络异常';
          const seconds = Math.ceil(delayMs / 1000);
          pendingNotices.push(`${cause}，正在重试第 ${attempt} 次（${seconds}s 后）…`);
        },
      )) {
        while (pendingNotices.length > 0) {
          yield { type: 'notice', message: pendingNotices.shift() as string };
        }
        if (chunk.content_delta) {
          assistantContent += chunk.content_delta;
          yield { type: 'content_delta', delta: chunk.content_delta };
        }
        if (chunk.reasoning_delta) {
          yield { type: 'reasoning_delta', delta: chunk.reasoning_delta };
        }
        if (chunk.tool_call_delta) {
          yield* mergeToolCallDelta(partialToolCalls, chunk.tool_call_delta);
        }
        if (chunk.finish_reason) {
          finishReason = chunk.finish_reason;
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }
    } else {
      // 非流式调用：一次性获取完整响应，转为事件流
      const result = await chatCompletion(conversationMessages, toolDefs, model);
      const collected = yield* collectNonStreamingResult(result, partialToolCalls);
      assistantContent = collected.content;
      usage = collected.usage;
      finishReason = 'stop';
    }
  } catch (err) {
    if (isAbortError(err, signal)) {
      return null;
    }
    yield { type: 'error', message: `LLM 请求失败：${(err as Error).message}` };
    return null;
  }

  return { assistantContent, partialToolCalls, finishReason, usage };
}

/**
 * 合并一段 tool_call 增量到累积 Map，并产出对应事件
 * @param {Map} partialToolCalls - 累积 Map
 * @param {object} delta - 单条 tool_call 增量
 * @returns {Generator<AgentEvent>} 增量对应的事件
 */
function* mergeToolCallDelta(
  partialToolCalls: Map<number, { id: string; name: string; arguments: string }>,
  delta: { index: number; id?: string; name?: string; arguments?: string },
): Generator<AgentEvent> {
  const { index, id, name, arguments: argsDelta } = delta;
  const existing = partialToolCalls.get(index) ?? { id: '', name: '', arguments: '' };
  if (id) existing.id = id;
  if (name) existing.name = name;
  if (argsDelta) existing.arguments += argsDelta;
  partialToolCalls.set(index, existing);

  if (id) {
    yield { type: 'tool_call_start', tool_call_id: id, name: name ?? existing.name };
  }
  if (argsDelta) {
    yield {
      type: 'tool_call_args_delta',
      tool_call_id: existing.id,
      delta: argsDelta,
    };
  }
}

/**
 * 把累积 Map 中的 tool_call 转换为最终的 ChatToolCall[]
 * @param {Map} partialToolCalls - 累积 Map
 * @returns {ChatToolCall[]} 已按 index 排序的 tool_calls 列表
 */
const buildToolCalls = (
  partialToolCalls: Map<number, { id: string; name: string; arguments: string }>,
): ChatToolCall[] => {
  return Array.from(partialToolCalls.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, tc]): ChatToolCall => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.arguments || '{}' },
    }))
    .filter((tc) => tc.id && tc.function.name);
};

/**
 * 安全 JSON.parse，失败时返回空对象
 * @param {string} raw - 原始 JSON 字符串
 * @returns {Record<string, unknown>} 解析结果
 */
const safeParseArgs = (raw: string): Record<string, unknown> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/**
 * 校验工具是否可被当前用户调用
 * @param {ToolImpl | undefined} tool - 工具实例
 * @param {string} name - 工具名
 * @param {ToolContext} context - 上下文
 * @returns {string | null} 错误信息；null 表示通过
 */
const checkToolPermission = (
  tool: ToolImpl | undefined,
  name: string,
  context: ToolContext,
): string | null => {
  if (!tool) {
    return `未知工具：${name}`;
  }
  const required = tool.requiredPermissions ?? [];
  if (required.length === 0) return null;
  const ok = required.some((p) => context.userPermissions.includes(p));
  return ok ? null : `权限不足，无法调用工具 ${name}（需 ${required.join(' 或 ')}）`;
};

/** 不做降级重试的工具：副作用工具（重复推送/重复执行不可接受）+ 联网搜索（重复计费） */
const NO_RETRY_TOOLS = new Set<string>([...SIDE_EFFECT_TOOLS, 'web_search']);

/** 单个 tool_call 的执行Outcome（含写回 LLM 的内容、Trace、待转发事件） */
interface ToolExecOutcome {
  /** 对应的 tool_call */
  tc: ChatToolCall;
  /** 写回 LLM 的 tool 消息内容 */
  content: string;
  /** 本次调用的追踪记录 */
  trace: ToolCallTrace;
  /** 待转发的事件（执行中 / 结果），并发场景下先缓存后按序 yield */
  events: AgentEvent[];
}

/**
 * 只保留 schema 声明的必填参数，生成降级用的参数副本
 * @param {ToolImpl} tool - 工具实现
 * @param {Record<string, unknown>} args - 原始参数
 * @returns {Record<string, unknown> | null} 降级参数；无需降级（本来就没传可选参数）返回 null
 * @description 工具失败的常见原因是「可选参数取值不对」（如 skill_key 拼错、type 枚举值臆造），
 *   而多数工具的必填参数为空或不传时会返回「可选清单」。降级策略由此而来：
 *   先按 LLM 给的完整参数试一次，失败则剥掉可选参数再试一次，让工具自己告诉 LLM 有哪些可选值。
 */
const buildMinimalArgs = (
  tool: ToolImpl,
  args: Record<string, unknown>,
): Record<string, unknown> | null => {
  const required = tool.parameters.required ?? [];
  const minimal: Record<string, unknown> = {};
  for (const key of required) {
    if (args[key] !== undefined) minimal[key] = args[key];
  }
  const dropped = Object.keys(args).filter((k) => !required.includes(k));
  return dropped.length > 0 ? minimal : null;
};

/**
 * 执行单个 tool_call（非生成器版本，便于并发）
 * @param {ChatToolCall} tc - 待执行的 tool_call
 * @param {ToolContext} context - 上下文
 * @returns {Promise<ToolExecOutcome>} 执行结果（不抛异常，错误转为 ok=false）
 * @description 只读工具失败时会做一次「只保留必填参数」的降级重试；
 *   副作用工具（发消息/跑脚本/启停服务）与联网搜索不重试——重复推送和重复计费都不可接受。
 */
const executeToolCallOnce = async (
  tc: ChatToolCall,
  context: ToolContext,
): Promise<ToolExecOutcome> => {
  const started = Date.now();
  const tool = findTool(tc.function.name);
  const permErr = checkToolPermission(tool, tc.function.name, context);
  if (permErr) {
    return {
      tc,
      content: wrapToolResult(tc.function.name, JSON.stringify({ ok: false, error: permErr })),
      trace: { id: tc.id, name: tc.function.name, ok: false, duration_ms: 0, args_chars: tc.function.arguments.length },
      events: [{ type: 'tool_call_result', tool_call_id: tc.id, name: tc.function.name, ok: false, data: permErr, duration_ms: 0 }],
    };
  }

  const events: AgentEvent[] = [
    { type: 'tool_call_executing', tool_call_id: tc.id, name: tc.function.name, arguments: tc.function.arguments },
  ];

  const parsedArgs = safeParseArgs(tc.function.arguments);

  // create_rule 的 preview=true 只解析展示、不写盘，严格模式下不能当写操作拦截，
  // 否则用户看不到解析结果，也就无从确认。
  const isRulePreview = tc.function.name === 'create_rule'
    && (parsedArgs.preview === true || parsedArgs.preview === 'true');

  // 严格模式：增删改类工具不当场执行，先建审批单等超级管理员拍板。
  // 推送/跑脚本/启停服务属于「动作」，不占用审批队列，仍受 consent 与权限码约束。
  // 审批通过后走 executeApproval → tool.invoke，不经过本函数，因此不会二次建单。
  if (isStrictSideEffects() && MUTATION_TOOLS.includes(tc.function.name) && !isRulePreview) {
    // 审批单只留业务字段：preview_token 是一次性短时效凭证，审批可能隔很久才发生，
    // 带着它执行会因过期而失败；预览一致性在用户确认那一刻已经校验过。
    const approvalArgs = { ...parsedArgs };
    if (tc.function.name === 'create_rule') {
      delete approvalArgs.preview;
      delete approvalArgs.preview_token;
    }
    // 防重：同工具 + 同参数的待审批单已存在时直接复用（用户没看到回复就重试是重复单的主要来源）
    const argsJson = JSON.stringify(approvalArgs);
    const duplicate = (await listApprovals()).find(
      (a) => a.status === 'pending' && a.tool === tc.function.name && JSON.stringify(a.args ?? {}) === argsJson,
    );
    if (duplicate) {
      const dupHint = `已有同内容的待审批单 ${duplicate.id}，未重复创建，等它被审批即可`;
      return {
        tc,
        content: wrapToolResult(
          tc.function.name,
          JSON.stringify({ ok: true, approval_id: duplicate.id, status: duplicate.status, duplicate: true, hint: dupHint }),
        ),
        trace: {
          id: tc.id,
          name: tc.function.name,
          ok: true,
          duration_ms: 0,
          args_chars: tc.function.arguments.length,
        },
        events: [
          {
            type: 'tool_call_result',
            tool_call_id: tc.id,
            name: tc.function.name,
            ok: true,
            data: dupHint,
            duration_ms: 0,
          },
        ],
      };
    }

    const rawReason = typeof parsedArgs.reason === 'string' ? parsedArgs.reason.trim() : '';
    const approval = await createApproval({
      user: context.userEmail,
      conversationId: context.conversationId ?? '',
      tool: tc.function.name,
      args: approvalArgs,
      reason: rawReason || `严格模式：${tc.function.name} 需人工审批`,
    });
    // 登记到本轮上下文：若本轮 LLM 回复失败（限流/中止），失败出口会把这些单统一作废
    context.createdApprovalIds?.push(approval.id);
    const hint = `已创建审批单 ${approval.id}，需超级管理员在 Web「AI 审批」页通过后才会执行`;
    return {
      tc,
      content: wrapToolResult(
        tc.function.name,
        JSON.stringify({ ok: true, approval_id: approval.id, status: approval.status, hint }),
      ),
      trace: {
        id: tc.id,
        name: tc.function.name,
        ok: true,
        duration_ms: 0,
        args_chars: tc.function.arguments.length,
      },
      events: [
        {
          type: 'tool_call_result',
          tool_call_id: tc.id,
          name: tc.function.name,
          ok: true,
          data: hint,
          duration_ms: 0,
        },
      ],
    };
  }

  try {
    let result: ToolResult = await tool!.invoke(parsedArgs, context);
    let retried = false;
    // 降级重试：仅只读工具，且原始参数里确实带了可选参数时才值得再试一次
    if (!result.ok && !NO_RETRY_TOOLS.has(tc.function.name)) {
      const minimal = buildMinimalArgs(tool!, parsedArgs);
      if (minimal) {
        retried = true;
        const retry = await tool!.invoke(minimal, context);
        if (retry.ok) {
          result = {
            ...retry,
            summary: `${retry.summary ?? ''}（已降级重试：仅保留必填参数）`.trim(),
          };
        }
      }
    }
    // 工具返回是不可信输入：清洗注入句式后统一包裹边界，防止数据通道劫持模型
    const injectionHits = detectInjection(typeof result.data === 'string' ? result.data : JSON.stringify(result.data ?? ''));
    if (injectionHits.length > 0) {
      console.warn(`[ai-guard] 工具 ${tc.function.name} 返回疑似提示注入：${injectionHits.join('、')}`);
    }
    const duration = Date.now() - started;
    events.push({
      type: 'tool_call_result',
      tool_call_id: tc.id,
      name: tc.function.name,
      ok: result.ok,
      data: result.data,
      summary: result.summary,
      duration_ms: duration,
    });
    return {
      tc,
      content: wrapToolResult(tc.function.name, JSON.stringify({ ok: result.ok, data: result.data, summary: result.summary })),
      trace: {
        id: tc.id,
        name: tc.function.name,
        ok: result.ok,
        duration_ms: duration,
        args_chars: tc.function.arguments.length,
        retried,
      },
      events,
    };
  } catch (err) {
    const errMsg = (err as Error).message;
    const duration = Date.now() - started;
    events.push({
      type: 'tool_call_result',
      tool_call_id: tc.id,
      name: tc.function.name,
      ok: false,
      data: errMsg,
      duration_ms: duration,
    });
    return {
      tc,
      content: wrapToolResult(tc.function.name, JSON.stringify({ ok: false, error: errMsg })),
      trace: { id: tc.id, name: tc.function.name, ok: false, duration_ms: duration, args_chars: tc.function.arguments.length },
      events,
    };
  }
};

/**
 * 批量执行本轮的全部 tool_call：只读工具并发，副作用工具串行
 * @param {ChatToolCall[]} toolCalls - 本轮待执行的调用列表
 * @param {ToolContext} context - 上下文
 * @returns {AsyncGenerator<AgentEvent, ToolExecOutcome[]>} 事件流；最终返回按入参顺序排列的结果
 * @description 并发的意义：LLM 常在同一轮吐出多条互不依赖的 query_* 调用，
 *   串行会让总耗时等于各次之和（工具多为本地文件/进程查询，IO 等待占大头）。
 *   副作用工具（发消息/跑脚本/启停服务）保持串行，避免并行放大成重复推送。
 */
async function* runToolCalls(
  toolCalls: ChatToolCall[],
  context: ToolContext,
): AsyncGenerator<AgentEvent, ToolExecOutcome[]> {
  const readOnly = toolCalls.filter((tc) => !SIDE_EFFECT_TOOLS.includes(tc.function.name));
  const sideEffect = toolCalls.filter((tc) => SIDE_EFFECT_TOOLS.includes(tc.function.name));

  const settled: ToolExecOutcome[] = [];

  if (readOnly.length > 0) {
    const results = await Promise.all(readOnly.map((tc) => executeToolCallOnce(tc, context)));
    for (const outcome of results) {
      yield* outcome.events;
      settled.push(outcome);
    }
  }

  for (const tc of sideEffect) {
    const outcome = await executeToolCallOnce(tc, context);
    yield* outcome.events;
    settled.push(outcome);
  }

  // 按 tool_calls 原始顺序还原，保证写入上下文的 tool 消息顺序与调用声明一致
  const byId = new Map(settled.map((o) => [o.tc.id, o]));
  return toolCalls.map((tc) => byId.get(tc.id)).filter((o): o is ToolExecOutcome => Boolean(o));
}

/** Trace 草稿：循环过程中边跑边累积，收尾统一 finalize */
interface TraceDraft {
  /** 运行唯一 ID */
  runId: string;
  /** 发起用户 */
  user: string;
  /** 会话 ID */
  conversationId: string;
  /** 模型 ID */
  model: string;
  /** 开始时间戳 */
  startedAt: number;
  /** 迭代轮次数 */
  iterations: number;
  /** 累计提示 token */
  promptTokens: number;
  /** 累计补全 token */
  completionTokens: number;
  /** 工具调用次数 */
  toolCalls: number;
  /** 工具失败次数 */
  toolFailures: number;
  /** 是否启用规划 */
  planningEnabled: boolean;
  /** 反思轮次 */
  reflections: number;
  /** 异常原因 */
  error: string;
  /** 逐轮明细 */
  steps: IterationTrace[];
}

/**
 * 创建 Trace 草稿
 * @param {RunAgentLoopInput} input - Agent Loop 输入
 * @returns {Promise<TraceDraft>} 初始草稿
 */
const createTraceDraft = async (input: RunAgentLoopInput): Promise<TraceDraft> => ({
  runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  user: input.context.userEmail,
  conversationId: input.conversationId ?? '',
  // 归因兜底：调用方没指定模型时（巡检、子 Agent 等）记实际生效的默认模型，
  // 否则成本看板会出现「未知模型」空桶
  model: input.model ?? (await getLlmConfigForModel(input.model)).model,
  startedAt: Date.now(),
  iterations: 0,
  promptTokens: 0,
  completionTokens: 0,
  toolCalls: 0,
  toolFailures: 0,
  planningEnabled: Boolean(input.enablePlanning),
  reflections: 0,
  error: '',
  steps: [],
});

/**
 * 把 Trace 草稿收尾为落盘结构
 * @param {TraceDraft} draft - 草稿
 * @returns {Promise<AgentRunTrace>} 完整运行追踪
 */
const finalizeTrace = async (draft: TraceDraft): Promise<AgentRunTrace> => {
  const endedAt = Date.now();
  return {
    run_id: draft.runId,
    user: draft.user,
    conversation_id: draft.conversationId,
    model: draft.model,
    started_at: draft.startedAt,
    ended_at: endedAt,
    duration_ms: endedAt - draft.startedAt,
    iterations: draft.iterations,
    prompt_tokens: draft.promptTokens,
    completion_tokens: draft.completionTokens,
    total_tokens: draft.promptTokens + draft.completionTokens,
    tool_calls: draft.toolCalls,
    tool_failures: draft.toolFailures,
    planning_enabled: draft.planningEnabled,
    reflections: draft.reflections,
    cost_cny: await estimateCost(draft.model, draft.promptTokens, draft.completionTokens),
    error: draft.error,
    steps: draft.steps,
  };
};

/**
 * 运行 Agent 多轮循环（本体）
 * @param {RunAgentLoopInput} input - 输入
 * @param {TraceDraft} draft - Trace 草稿（边跑边写入）
 * @returns {AsyncGenerator<AgentEvent>} 事件流生成器
 * @description 每次迭代：调用 LLM → 解析增量 → 若有 tool_calls 则执行工具并把结果作为 tool 消息追加 → 继续下一轮，直到 finish_reason 不是 tool_calls 或达到上限
 */
async function* runLoopBody(
  input: RunAgentLoopInput,
  draft: TraceDraft,
): AsyncGenerator<AgentEvent> {
  const { context, tools, enableTools, signal, model } = input;
  const conversationMessages: ChatMessage[] = [...input.messages];
  const toolDefs = enableTools && tools.length > 0 ? buildToolDefinitions(tools) : undefined;

  // 本轮新建的审批单：回复成功送达就保留；一旦回复失败（限流/异常/中止）统一作废。
  // 否则用户什么都看不到，只会反复重试，审批列表里堆一摞重复单。
  context.createdApprovalIds ??= [];
  // 会话 ID 注入上下文：建审批单时带上，审批出结果后据此把结果回写到本条对话
  context.conversationId ??= input.conversationId ?? '';
  const discardPendingApprovals = async () => {
    if (context.createdApprovalIds && context.createdApprovalIds.length > 0) {
      await cancelPendingApprovals(
        context.createdApprovalIds,
        '本轮 AI 回复未成功送达（限流/异常/中止），审批单已自动作废，请重新发起',
      );
      context.createdApprovalIds = [];
    }
  };

  // 多轮工具调用累加 usage：循环结束（或 break 退出）时把累计值写到最后一条 assistant 消息上，随 final_messages 落盘
  let aggregatedUsage: UsageInfo | undefined;
  let lastAssistantMessage: ChatMessage | undefined;

  // ── L3 前置：规划 ──
  // 仅「开了工具 + 工具非空」时才规划；纯对话场景规划没有意义，白白多一次 LLM 调用。
  const planningEnabled = (input.enablePlanning ?? false) && enableTools && tools.length > 0;
  const toolNames = tools.map((t) => t.name);
  const userGoal = lastUserText(conversationMessages);
  let plan: AgentPlan | null = null;
  let reflectionCount = 0;
  let usedTools = false;

  if (planningEnabled) {
    plan = await generatePlan(userGoal, toolNames, model, signal);
    if (plan) {
      yield {
        type: 'plan_start',
        goal: plan.goal,
        steps: plan.steps.map((s) => ({ id: s.id, title: s.title, tool: s.tool })),
      };
      conversationMessages.push(formatPlanAsMessage(plan));
    }
  }

  const maxIterations = input.maxIterations ?? MAX_AGENT_LOOP_ITERATIONS;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (signal?.aborted) {
      draft.error = '会话已被终止';
      yield { type: 'error', message: draft.error };
      await discardPendingApprovals();
      return;
    }
    draft.iterations += 1;

    const streamResult = yield* streamOneIteration(conversationMessages, toolDefs, signal, model);
    if (!streamResult) {
      // 客户端 abort 或上游错误，事件已 yield，直接结束。
      // 本轮已建的审批单一并作废：用户没看到任何回复，留着只会诱导重复申请。
      await discardPendingApprovals();
      return;
    }

    yield { type: 'iteration_end', iteration, finish_reason: streamResult.finishReason || 'stop' };
    if (streamResult.usage) {
      yield { type: 'iteration_usage', iteration, usage: streamResult.usage };
      aggregatedUsage = {
        prompt_tokens: (aggregatedUsage?.prompt_tokens ?? 0) + (streamResult.usage.prompt_tokens ?? 0),
        completion_tokens: (aggregatedUsage?.completion_tokens ?? 0) + (streamResult.usage.completion_tokens ?? 0),
        total_tokens: (aggregatedUsage?.total_tokens ?? 0) + (streamResult.usage.total_tokens ?? 0),
      };
      draft.promptTokens += streamResult.usage.prompt_tokens ?? 0;
      draft.completionTokens += streamResult.usage.completion_tokens ?? 0;
    }
    // 本轮明细（usage 缺失时补零，保证 steps 与 iterations 一一对应）
    const iterationTrace: IterationTrace = {
      iteration,
      usage: {
        prompt_tokens: streamResult.usage?.prompt_tokens ?? 0,
        completion_tokens: streamResult.usage?.completion_tokens ?? 0,
        total_tokens: streamResult.usage?.total_tokens ?? 0,
      },
      tool_calls: [],
    };
    draft.steps.push(iterationTrace);

    const toolCalls = buildToolCalls(streamResult.partialToolCalls);
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: streamResult.assistantContent,
      created_at: Date.now(),
    };
    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls;
    }
    conversationMessages.push(assistantMessage);
    lastAssistantMessage = assistantMessage;

    if (toolCalls.length === 0 || !enableTools) {
      // ── L3 收尾：自我反思 ──
      // 模型已经给出「最终回答」但还没返回给用户，先让质检员判一次分：
      // 判定未完成时把缺口注入上下文并 continue（受 MAX_REFLECTION_ROUNDS 与迭代上限双重约束）。
      let needRetry = false;
      // 只有「本轮本该用工具」才反思：纯闲聊 / 规划器判定无需工具时直接收尾，
      // 否则每句「你好」都要多花一次反思调用，纯粹烧 token。
      const worthReflecting = usedTools || Boolean(plan && plan.steps.length > 0);
      if (
        planningEnabled
        && worthReflecting
        && reflectionCount < MAX_REFLECTION_ROUNDS
        && iteration + 1 < MAX_AGENT_LOOP_ITERATIONS
        && !signal?.aborted
      ) {
        reflectionCount += 1;
        draft.reflections = reflectionCount;
        const reflection: AgentReflection | null = await runReflection(
          userGoal,
          lastAssistantText(conversationMessages),
          toolNames,
          reflectionCount,
          model,
          signal,
        );
        if (reflection) {
          yield {
            type: 'reflection',
            round: reflection.round,
            complete: reflection.complete,
            missing: reflection.missing,
            hint: reflection.hint,
          };
          if (!reflection.complete && reflection.hint) {
            conversationMessages.push(formatReflectionAsMessage(reflection));
            needRetry = true;
          }
        }
      }
      if (needRetry) {
        // 下一轮会重写整份回答，已吐出的正文作废：不通知消费方清空，
        // 最终文本就会变成「第一轮 + 第二轮」拼接的重复内容
        yield { type: 'content_reset' };
        continue;
      }
      break;
    }

    usedTools = true;
    // 只读工具并发、副作用工具串行；事件在内部按序 yield，UI 表现与串行一致
    const outcomes = yield* runToolCalls(toolCalls, context);
    for (const outcome of outcomes) {
      conversationMessages.push({
        role: 'tool',
        content: outcome.content,
        tool_call_id: outcome.tc.id,
        name: outcome.tc.function.name,
        created_at: Date.now(),
      });
      iterationTrace.tool_calls.push(outcome.trace);
      draft.toolCalls += 1;
      if (!outcome.trace.ok) draft.toolFailures += 1;
      // 计划推进：把刚执行完的工具结果映射到计划步骤上，失败也如实标记
      if (plan) {
        const step = advancePlanStep(plan, outcome.tc.function.name, outcome.trace.ok);
        if (step) {
          yield { type: 'plan_step', step_id: step.id, title: step.title, status: step.status };
        }
      }
    }
  }

  // 收尾：计划里没跑到的步骤统一标记 skipped，避免前端一直显示「准备中」
  if (plan) {
    for (const step of skipRestPlanSteps(plan)) {
      yield { type: 'plan_step', step_id: step.id, title: step.title, status: step.status };
    }
  }

  // 把多轮累加的 usage 落到最后一条 assistant 消息上，随 final_messages 一起持久化
  if (lastAssistantMessage && aggregatedUsage) {
    lastAssistantMessage.usage = aggregatedUsage;
  }

  yield { type: 'final_messages', messages: conversationMessages };
}

/**
 * 运行 Agent 多轮循环（对外入口）
 * @param {RunAgentLoopInput} input - 输入
 * @returns {AsyncGenerator<AgentEvent>} 事件流生成器
 * @description 在 runLoopBody 外面套一层 Trace 收口：无论正常结束、被 abort 还是抛异常，
 *   都会在最后 yield 一条 run_trace 事件，保证每次运行都留下可观测记录（成本/延迟/失败率）。
 */
export async function* runAgentLoop(input: RunAgentLoopInput): AsyncGenerator<AgentEvent> {
  const draft = await createTraceDraft(input);
  try {
    yield* runLoopBody(input, draft);
  } catch (err) {
    draft.error = (err as Error).message;
    yield { type: 'error', message: draft.error };
    if (input.context.createdApprovalIds?.length) {
      await cancelPendingApprovals(
        input.context.createdApprovalIds,
        `本轮 AI 回复异常中断（${draft.error}），审批单已自动作废，请重新发起`,
      );
    }
  } finally {
    yield { type: 'run_trace', trace: await finalizeTrace(draft) };
  }
}
