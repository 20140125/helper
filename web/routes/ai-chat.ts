import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  listConversations,
  readConversation,
  createConversation,
  deleteConversation,
  writeConversation,
  replaceMessages,
  validateLlmConfig,
  getAvailableModels,
  isVisionModel,
  sanitizeImageDataUrls,
  buildUserContent,
  getAvailableTools,
  buildSystemPrompt,
  runAgentLoop,
  handleGenerativeModel,
  isGenerativeModel,
  listSkills,
  appendRunTrace,
  listRunTraces,
  summarizeTraces,
  startInspectionNow,
  getInspectorStatus,
  handleIncomingMessage,
  verifyWebhookToken,
  readMemory,
  clearMemory,
  pickMemoryForPrompt,
  rememberFromTurn,
  extractMessageText,
  listApprovals,
  updateApproval,
  executeApproval,
  notifyApprovalResult,
  isAdminEmail,
  listSkillMetas,
  findSkillDoc,
  findSkillDocByTool,
} from './utils';
import { Permission } from '@/types/permission';
import {
  DEFAULT_IMAGE_QUESTION,
  MAX_IMAGE_DATA_URL_CHARS,
  MAX_IMAGES_PER_MESSAGE,
} from '@/types/ai-chat';
import type {
  AgentRunTrace,
  ChatMessage,
  CreateConversationBody,
  SendMessageBody,
} from '@/types/ai-chat';

const router = Router();

/**
 * 外部渠道消息入口路由器
 * @description 单独一个 Router：它不能被 withPermission 包裹（外部渠道没有登录态与权限），
 *   安全性由 AI_CHAT_WEBHOOK_TOKEN 令牌校验保证，且在 server.ts 中于鉴权中间件白名单放行。
 */
export const aiWebhookRouter = Router();

/**
 * 外部渠道消息入口（群内 @机器人 → 跑 Agent → 推回群）
 * @route POST /api/ai-chat/webhook
 * @header X-AI-Webhook-Token - 与环境变量 AI_CHAT_WEBHOOK_TOKEN 比对
 * @body {{ text: string; sender?: string; reply?: boolean; model?: string }}
 */
aiWebhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const token = req.headers['x-ai-webhook-token'] as string | undefined;
  if (!verifyWebhookToken(token)) {
    return returnResponse(
      res,
      ErrorCode.FORBIDDEN,
      {} as Record<string, unknown>,
      '令牌校验失败：请配置 AI_CHAT_WEBHOOK_TOKEN 并在请求头携带 X-AI-Webhook-Token',
    );
  }
  const { text, sender, reply, model } = (req.body ?? {}) as {
    text?: string;
    sender?: string;
    reply?: boolean;
    model?: string;
  };
  if (!text?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {} as Record<string, unknown>, 'text 不能为空');
  }
  console.log(`[ai-webhook] 收到外部消息（sender=${sender ?? 'unknown'}）`);
  const result = await handleIncomingMessage({ text, sender, reply, model });
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { result } as Record<string, unknown>,
    result.ok ? '处理完成' : result.error || '未产出回答',
  );
});

// ──────────────────────────
// 工具：从 req 中取出当前用户上下文
// ──────────────────────────

/**
 * 从 req 中读取当前用户邮箱与权限列表
 * @param {Request} req - Express 请求对象
 * @returns {{ email: string; permissions: string[] }} 用户上下文
 * @description 全局 JWT 中间件已通过 attachUserInfo 把 userEmail / userPermissions 挂到 req 上
 */
const getUser = (req: Request): { email: string; permissions: string[] } => {
  return {
    email: req.userEmail ?? '',
    permissions: (req.userPermissions ?? []) as string[],
  };
};

// ──────────────────────────
// 1. 列出会话
// ──────────────────────────

/**
 * 获取当前用户的会话列表
 * @route GET /conversations
 */
router.get('/conversations', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const summaries = listConversations(email);
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { conversations: summaries } as Record<string, unknown>,
    '',
  );
});

// ──────────────────────────
// 2. 读取单个会话详情
// ──────────────────────────

/**
 * 获取指定会话的完整消息列表
 * @route GET /conversations/:id
 */
router.get('/conversations/:id', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const conv = readConversation(email, req.params.id);
  if (!conv) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '会话不存在');
  }
  return returnResponse(res, ErrorCode.SUCCESS, { conversation: conv } as Record<string, unknown>, '');
});

// ──────────────────────────
// 3. 创建会话
// ──────────────────────────

/**
 * 创建新会话
 * @route POST /conversations
 * @body {CreateConversationBody}
 */
router.post('/conversations', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const { title } = (req.body ?? {}) as CreateConversationBody;
  const conv = createConversation(email, title);
  return returnResponse(res, ErrorCode.SUCCESS, { conversation: conv } as Record<string, unknown>, '创建成功');
});

// ──────────────────────────
// 4. 删除会话
// ──────────────────────────

/**
 * 删除指定会话
 * @route DELETE /conversations/:id
 */
router.delete('/conversations/:id', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const ok = deleteConversation(email, req.params.id);
  if (!ok) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '会话不存在');
  }
  return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '删除成功');
});

// ──────────────────────────
// 4.1 分支会话（从某条消息处 fork 出新会话）
// ──────────────────────────

/**
 * 从指定消息位置分支出新会话
 * @route POST /conversations/:id/fork
 * @body {{ at?: number }}
 * @description 复制原会话前 at 条消息到新会话（默认全部），用于「从这里换个问法试试」：
 *   保留上文、丢弃后续走向，避免为了试另一种思路而重开一轮把上下文全丢了。
 */
router.post('/conversations/:id/fork', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const source = readConversation(email, req.params.id);
  if (!source) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '会话不存在');
  }
  // at 的口径是「第几条可见消息」（与前端 UI 消息一一对应：排除 system 与 tool），
  // 因为前端拿不到被过滤掉的 tool 消息数量，按下标直接切会错位。
  const visible = source.messages.filter((m) => m.role !== 'system' && m.role !== 'tool');
  const rawAt = Number((req.body as { at?: number } | undefined)?.at);
  const at = Number.isFinite(rawAt)
    ? Math.max(0, Math.min(Math.floor(rawAt), visible.length))
    : visible.length;

  // 切点取第 at 条可见消息在原始数组中的位置：它之前的 tool 消息都归属更早的 assistant，配对不会被切断
  const cutIndex = at >= visible.length
    ? source.messages.length
    : source.messages.indexOf(visible[at]);

  const forked = createConversation(email, `${source.title}（分支）`);
  forked.messages = source.messages.slice(0, cutIndex);
  writeConversation(forked);

  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { conversation: forked } as Record<string, unknown>,
    `已分支前 ${at} 条消息`,
  );
});

// ──────────────────────────
// 5. 健康检查（前端用于判断 LLM 是否已配置）
// ──────────────────────────

/**
 * AI Chat 配置健康检查
 * @route GET /health
 */
router.get('/health', (_req: Request, res: Response) => {
  const err = validateLlmConfig();
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { healthy: !err, message: err ?? 'LLM 配置正常' } as Record<string, unknown>,
    '',
  );
});

// ────────────────────────
// 5.1 可用模型列表（前端输入框模型选择器使用）
// ────────────────────────

/**
 * 获取可选模型列表
 * @route GET /models
 */
router.get('/models', (_req: Request, res: Response) => {
  const { models, default: defaultModel } = getAvailableModels();
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { models, default: defaultModel } as Record<string, unknown>,
    '',
  );
});

/**
 * 列出当前用户可用的 AI 工具（供输入框「指定工具」下拉使用）
 * @route GET /tools
 * @description 与 /send 用同一套权限过滤（getAvailableTools + 用户权限码），
 *   保证「下拉里看得见的」就是「这一轮真能用的」；web_search 默认不收进下拉，
 *   它由输入框的联网搜索开关控制。
 */
router.get('/tools', (req: Request, res: Response) => {
  const { permissions } = getUser(req);
  const tools = getAvailableTools(permissions)
    .filter((t: { name: string }) => t.name !== 'web_search')
    .map((t: { name: string; description: string }) => ({ name: t.name, description: t.description }));
  return returnResponse(res, ErrorCode.SUCCESS, { tools } as Record<string, unknown>, '');
});

// ──────────────────────────
// 5.2 运行统计（成本 / 延迟 / 工具失败率）
// ──────────────────────────

/** 拥有其中任一权限即视为管理员，可查看全量统计（普通用户只能看自己） */
const ADMIN_LIKE_PERMISSIONS = ['rbac:view', 'rbac:edit'];

/**
 * 获取 AI 运行统计
 * @route GET /stats?days=7&scope=me|all
 * @description 数据源为 .cache/ai-traces/*.jsonl（每次 /send 追加一行）；
 *   scope=all 需要管理员权限，否则静默降级为 me，不让普通用户探测他人用量。
 */
router.get('/stats', (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), 90) : 7;
  const canSeeAll = ADMIN_LIKE_PERMISSIONS.some((p) => permissions.includes(p));
  const scope = req.query.scope === 'all' && canSeeAll ? 'all' : 'me';

  const to = Date.now();
  const from = to - days * 24 * 60 * 60 * 1000;
  const traces = listRunTraces({
    user: scope === 'all' ? undefined : email,
    from,
    to,
    limit: 5000,
  });
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { scope, days, summary: summarizeTraces(traces) } as Record<string, unknown>,
    '',
  );
});

// ──────────────────────────
// 5.3 主动巡检（手动触发一次系统健康巡检）
// ──────────────────────────

/**
 * 手动触发一次系统健康巡检（后台执行，立即返回）
 * @route POST /inspect
 * @body {{ push?: boolean; focus?: string; model?: string }}
 * @description 一轮巡检要跑完整 Agent（多轮 LLM + 工具调用），耗时几十秒到几分钟，
 *   同步等待必然撞上网关/浏览器超时——因此本接口只「点火」后立即返回，
 *   调用方轮询 `GET /inspect/status`（running=false 时取 lastResult 即为本次简报）。
 *   与定时任务共用一把锁，避免手动与定时同时跑导致重复推送。推送简报需 webhook:edit 权限。
 */
router.post('/inspect', (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const { push = false, focus = '', model } = (req.body ?? {}) as {
    push?: boolean;
    focus?: string;
    model?: string;
  };
  if (push && !permissions.includes(Permission.WEBHOOK_EDIT)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '权限不足：推送到企微群需要 webhook:edit 权限');
  }

  const { started, error } = startInspectionNow({
    userEmail: email,
    push: Boolean(push),
    focus,
    model,
  });
  if (!started) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, error || '巡检未能发起');
  }
  return returnResponse(res, ErrorCode.SUCCESS, { started } as Record<string, unknown>, '巡检已在后台启动');
});

/**
 * 查询定时巡检的调度状态
 * @route GET /inspect/status
 * @description 回答三个高频疑问：到底开没开、上次什么时候跑的、下一次什么时候跑。
 *   只读接口，任何登录用户都能看，便于排查「配了却没跑」这类问题。
 */
router.get('/inspect/status', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { status: getInspectorStatus() } as Record<string, unknown>,
    'ok',
  );
});

// ──────────────────────────
// 5.4 长期记忆（查看 / 清空）
// ──────────────────────────

/**
 * 查看当前用户的长期记忆
 * @route GET /memory
 * @description 记忆由每轮对话结束后自动沉淀；这里暴露出来是为了可审计——
 *   用户有权知道模型记住了自己什么，也有权一键清空。
 */
router.get('/memory', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { memory: readMemory(email) } as Record<string, unknown>,
    '',
  );
});

// ──────────────────────────
// 5.5 副作用操作审批（Human-in-the-loop）
// ──────────────────────────

/**
 * 查看审批单列表
 * @route GET /approvals?status=pending
 */
router.get('/approvals', (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  if (!permissions.includes(Permission.AI_APPROVALS_VIEW)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '权限不足：查看审批单需要 ai-approvals:view 权限');
  }
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const approvals = listApprovals().filter((a) => (status ? a.status === status : true));
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { approvals } as Record<string, unknown>,
    '',
  );
});

/**
 * 通过并执行一张审批单
 * @route POST /approvals/:id/approve
 * @description 执行身份取审批人（谁批准谁负责），权限也按审批人的算；
 *   权限不足会把单子置为 failed 并写清原因，而不是静默失败。
 */
router.post('/approvals/:id/approve', async (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  if (!permissions.includes(Permission.AI_APPROVALS_EDIT)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '权限不足：审批操作需要 ai-approvals:edit 权限');
  }
  // 审批权只给超级管理员：普通管理员可以建单，但拍板必须由超级管理员完成
  if (!isAdminEmail(email)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '仅超级管理员可审批');
  }
  const updated = await executeApproval(req.params.id, email);
  if (!updated) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '审批单不存在');
  }
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { approval: updated } as Record<string, unknown>,
    updated.status === 'executed' ? '已执行' : updated.result || '执行失败',
  );
});

/**
 * 驳回一张审批单
 * @route POST /approvals/:id/reject
 */
router.post('/approvals/:id/reject', (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  if (!permissions.includes(Permission.AI_APPROVALS_EDIT)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '权限不足：审批操作需要 ai-approvals:edit 权限');
  }
  // 驳回同样属于审批决策，权限口径与通过保持一致
  if (!isAdminEmail(email)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '仅超级管理员可审批');
  }
  const updated = updateApproval(req.params.id, {
    status: 'rejected',
    decided_by: email,
    decided_at: Date.now(),
  });
  if (!updated) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '审批单不存在');
  }
  // 回写到发起人的会话：驳回也是结论，不告诉发起人他同样会一直重试
  notifyApprovalResult(updated, 'rejected', email, '审批未通过');
  return returnResponse(res, ErrorCode.SUCCESS, { approval: updated } as Record<string, unknown>, '已驳回');
});

/**
 * 清空当前用户的长期记忆
 * @route DELETE /memory
 */
router.delete('/memory', (req: Request, res: Response) => {
  const { email } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  clearMemory(email);
  return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '已清空');
});

// ──────────────────────────
// 6. 流式发送消息（SSE）
// ──────────────────────────

/**
 * 写入一条 SSE 事件
 * @param {Response} res - Express Response 对象
 * @param {string} event - 事件名
 * @param {unknown} data - 数据负载（会被 JSON 序列化）
 * @returns {void}
 */
const writeSse = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * 配置 SSE 响应头并附加客户端断开监听
 * @param {Response} res - Express Response 对象
 * @returns {AbortController} 监听 res.close 的终止控制器
 * @description 仅在客户端真正断开（响应未完成而 socket 关闭）时才 abort：
 *   使用 res.on('close') + res.writableEnded 判定，而非 req.on('close')：
 *   Express 4 / Node 20 下 req 的 'close' 事件在 POST 请求 body 读完后会立即触发，
 *   此时 socket 实际仍存活，但若用 req.on('close') 监听就会误判为客户端断开，
 *   导致 abortController 提前 abort，LLM fetch 抛 AbortError 被 agent-loop
 *   静默 return（catch 内 signal.aborted 命中），最终前端只收到 meta+done，
 *   一个 delta 都没有。
 */
const setupSseResponse = (res: Response): AbortController => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });
  return abortController;
};

/** AgentEvent → SSE event 名 + 字段映射的简单查表 */
const AGENT_EVENT_TO_SSE: Record<string, { event: string; pick: (ev: Record<string, unknown>) => Record<string, unknown> }> = {
  content_delta: { event: 'delta', pick: (ev) => ({ delta: ev.delta }) },
  reasoning_delta: { event: 'reasoning', pick: (ev) => ({ delta: ev.delta }) },
  tool_call_start: { event: 'tool_start', pick: (ev) => ({ id: ev.tool_call_id, name: ev.name }) },
  tool_call_args_delta: { event: 'tool_args', pick: (ev) => ({ id: ev.tool_call_id, delta: ev.delta }) },
  tool_call_executing: {
    event: 'tool_executing',
    pick: (ev) => ({ id: ev.tool_call_id, name: ev.name, arguments: ev.arguments }),
  },
  tool_call_result: {
    event: 'tool_result',
    pick: (ev) => ({ id: ev.tool_call_id, name: ev.name, ok: ev.ok, data: ev.data, summary: ev.summary }),
  },
  iteration_end: {
    event: 'iteration_end',
    pick: (ev) => ({ iteration: ev.iteration, finish_reason: ev.finish_reason }),
  },
  iteration_usage: {
    event: 'iteration_usage',
    pick: (ev) => ({ iteration: ev.iteration, usage: ev.usage }),
  },
  plan_start: {
    event: 'plan_start',
    pick: (ev) => ({ goal: ev.goal, steps: ev.steps }),
  },
  plan_step: {
    event: 'plan_step',
    pick: (ev) => ({ step_id: ev.step_id, title: ev.title, status: ev.status }),
  },
  reflection: {
    event: 'reflection',
    pick: (ev) => ({ round: ev.round, complete: ev.complete, missing: ev.missing, hint: ev.hint }),
  },
  notice: { event: 'notice', pick: (ev) => ({ message: ev.message }) },
  error: { event: 'error', pick: (ev) => ({ message: ev.message }) },
};

/** Agent Loop 事件泵的输出：最终消息列表 + 本次运行 Trace */
interface PumpResult {
  /** 完整消息列表（用于落盘）；为空则未收到 final_messages */
  finalMessages: ChatMessage[] | null;
  /** 本次运行追踪（用于成本/延迟统计）；Loop 异常时也可能为 null */
  trace: AgentRunTrace | null;
}

/**
 * 把 Agent Loop 事件流转发到 SSE 客户端，并收集 final_messages 与 run_trace
 * @param {Response} res - Express Response 对象
 * @param {AsyncIterable<any>} generator - runAgentLoop 返回的事件流
 * @returns {Promise<PumpResult>} 最终消息列表 + 运行追踪
 */
const pumpAgentEventsToSse = async (
  res: Response,
  generator: AsyncIterable<{ type: string; messages?: ChatMessage[]; trace?: AgentRunTrace } & Record<string, unknown>>,
): Promise<PumpResult> => {
  let finalMessages: ChatMessage[] | null = null;
  let trace: AgentRunTrace | null = null;
  for await (const ev of generator) {
    if (ev.type === 'final_messages' && ev.messages) {
      finalMessages = ev.messages;
      continue;
    }
    if (ev.type === 'run_trace' && ev.trace) {
      trace = ev.trace;
      // 把本次运行的成本/耗时摘要回传前端，便于气泡尾部展示「本次消耗」
      writeSse(res, 'trace', {
        run_id: trace.run_id,
        model: trace.model,
        duration_ms: trace.duration_ms,
        total_tokens: trace.total_tokens,
        cost_cny: trace.cost_cny,
        tool_calls: trace.tool_calls,
        tool_failures: trace.tool_failures,
      });
      continue;
    }
    const mapping = AGENT_EVENT_TO_SSE[ev.type];
    if (mapping) {
      writeSse(res, mapping.event, mapping.pick(ev));
    }
  }
  return { finalMessages, trace };
};

/**
 * 校验 /send 入参并补齐默认值
 * @param {Request} req - Express 请求对象
 * @returns {{ ok: true; body: SendMessageBody & { message: string; enable_tools: boolean } } | { ok: false; message: string }} 校验结果
 */
const parseSendBody = (
  req: Request,
): { ok: true; body: { conversation_id?: string; message: string; enable_tools: boolean; enable_web_search: boolean; enable_planning: boolean; pinned_skill: string; model?: string; images: string[] } }
  | { ok: false; message: string } => {
  const {
    conversation_id: convId,
    message,
    enable_tools = true,
    enable_web_search = false,
    // 默认关闭 L3 规划 + 反思（省掉两次额外 LLM 调用、降低免费模型限流风险）；前端可在输入框工具栏开启
    enable_planning = false,
    // 用户在输入框显式选择的技能；空串 / 未注册的值一律按「AI 自行判断」处理
    pinned_skill = '',
    model,
    images: rawImages,
  } = (req.body ?? {}) as SendMessageBody;

  // 只接受 data:image/...;base64 形式的图片，其余（含外链）一律丢弃，避免 SSRF 与超限
  const allImages = sanitizeImageDataUrls(rawImages);
  const oversized = allImages.filter((url) => url.length > MAX_IMAGE_DATA_URL_CHARS);
  if (oversized.length > 0) {
    return { ok: false, message: `单张图片不能超过 ${Math.floor(MAX_IMAGE_DATA_URL_CHARS / 1_000_000)}MB，请压缩后重试` };
  }
  const images = allImages.slice(0, MAX_IMAGES_PER_MESSAGE);
  if (allImages.length > MAX_IMAGES_PER_MESSAGE) {
    console.warn(`[ai-chat] 图片数量 ${allImages.length} 超过上限，仅保留前 ${MAX_IMAGES_PER_MESSAGE} 张`);
  }

  // 允许「只发图片不打字」，此时必须有图片
  if (!message?.trim() && images.length === 0) {
    return { ok: false, message: 'message 不能为空' };
  }
  return {
    ok: true,
    body: {
      conversation_id: convId,
      message: message.trim(),
      enable_tools: Boolean(enable_tools),
      enable_web_search: Boolean(enable_web_search),
      enable_planning: Boolean(enable_planning),
      pinned_skill: String(pinned_skill ?? '').trim(),
      model,
      images,
    },
  };
};

/**
 * 流式发送消息接口（Server-Sent Events）
 * @route POST /send
 * @body {SendMessageBody}
 * @description SSE 协议：每个事件包含 event 名（meta/delta/tool/done/error）+ JSON 数据
 */
router.post('/send', async (req: Request, res: Response) => {
  const { email, permissions } = getUser(req);
  if (!email) {
    return returnResponse(res, ErrorCode.UNAUTHORIZED, {}, '未识别到用户身份');
  }
  const parsed = parseSendBody(req);
  if (!parsed.ok) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, parsed.message);
  }
  const { conversation_id: convId, message, enable_tools, enable_web_search, enable_planning, pinned_skill, images } = parsed.body;

  // 上传了图片但当前模型不支持看图 → 自动切到配置里首个支持看图的模型，并告知前端
  let model = parsed.body.model;
  let visionSwitched = false;
  if (images.length > 0 && !isVisionModel(model)) {
    const visionModel = getAvailableModels().models.find((m) => m.vision)?.id;
    if (visionModel) {
      model = visionModel;
      visionSwitched = true;
    }
  }

  // 校验 LLM_API_KEY 是否已配置
  const llmErr = validateLlmConfig(model);
  if (llmErr) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, llmErr);
  }

  // 检查是否为文生图/文生视频模型，走专用业务流程（不进 Agent Loop）
  if (isGenerativeModel(model)) {
    setupSseResponse(res);
    await handleGenerativeModel(res, email, convId, message, model);
    return;
  }

  // 1) 获取或创建会话
  let conv = convId ? readConversation(email, convId) : null;
  if (!conv) {
    conv = createConversation(email);
  }

  // 2) 将用户消息追加到会话（有图片时组装成多模态内容：文本片段 + 图片片段）
  const userText = message || DEFAULT_IMAGE_QUESTION;
  conv.messages.push({
    role: 'user',
    content: buildUserContent(userText, images),
    created_at: Date.now(),
  });

  // 3) 准备工具列表 + system prompt
  //    web_search 工具需要用户在输入框工具栏手动开启「联网搜索」开关（enable_web_search=true）才会被加入，
  //    避免 LLM 在默认场景下频繁调用联网接口产生额外费用。
  const allTools = enable_tools ? getAvailableTools(permissions) : [];
  const availableTools = enable_web_search
    ? allTools
    : allTools.filter((t: { name: string }) => t.name !== 'web_search');

  // 用户在输入框显式指定了能力 → 本轮只保留对应工具并锁死调用：
  //   - "skill:<key>"：只留 card_skill，并锁定 skill_key（老格式「裸 key」同样按技能处理）
  //   - "tool:<name>"：只留该工具，强制本轮调它（新增的增删改工具也能这样精确指定）
  // 未选择 / 值未注册 / 无该工具权限时一律退化为「AI 自行判断」，不阻断对话。
  const PINNED_TOOL_PREFIX = 'tool:';
  let pinnedSkill = '';
  let pinnedTool = '';
  if (pinned_skill.startsWith(PINNED_TOOL_PREFIX)) {
    const wanted = pinned_skill.slice(PINNED_TOOL_PREFIX.length).trim();
    if (availableTools.some((t: { name: string }) => t.name === wanted)) {
      pinnedTool = wanted;
    } else {
      console.warn(`[ai-chat] 忽略无权限或不存在的 pinned tool=${wanted}，按自动模式处理`);
    }
  } else if (pinned_skill) {
    const known = listSkills().skills.find((s) => s.key === pinned_skill);
    if (!known) {
      console.warn(`[ai-chat] 忽略未知的 pinned_skill=${pinned_skill}，按自动模式处理`);
    } else if (!availableTools.some((t: { name: string }) => t.name === 'card_skill')) {
      console.warn(`[ai-chat] pinned_skill=${pinned_skill} 但当前用户无 card_skill 权限，按自动模式处理`);
    } else {
      pinnedSkill = pinned_skill;
    }
  }
  const finalTools = pinnedSkill
    ? availableTools.filter((t: { name: string }) => t.name === 'card_skill')
    : pinnedTool
      ? availableTools.filter((t: { name: string }) => t.name === pinnedTool)
      : availableTools;

  // 长期记忆：取本用户热度最高的若干条注入 system prompt（内部会计一次命中）
  const memories = pickMemoryForPrompt(email);
  // md 技能索引：主会话按用户权限全量注入（含 action / mutation 类说明书）。
  // pinned 场景工具列表被裁到只剩一个，load_skill 已不在其中，此时不注入索引（否则模型会去调不存在的工具）
  const pinned = Boolean(pinnedSkill || pinnedTool);
  const basePrompt = buildSystemPrompt(
    enable_tools,
    finalTools.map((t: { name: string; }) => t.name),
    memories,
    pinned ? [] : listSkillMetas(permissions),
  );
  // pinned_skill 时工具表只剩 card_skill，调不到 load_skill，
  // 因此把 card-skill 说明书直接拼进提示词，保证模型仍拿得到 key 与参数口径
  const cardSkillDoc = pinnedSkill ? findSkillDoc('card-skill') : undefined;
  const pinnedToolDoc = pinnedTool ? findSkillDocByTool(pinnedTool) : undefined;
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: pinnedSkill
      ? `${basePrompt}\n\n## 本轮用户已指定技能\n用户已在输入框选择技能「${pinnedSkill}」。`
        + `本轮必须调用 card_skill，且 skill_key 固定为 "${pinnedSkill}"，不要再自行挑选其它技能或工具；`
        + '若该技能确实无法回答用户的问题，如实说明并建议换一个技能。'
        + (cardSkillDoc ? `\n\n${cardSkillDoc.body}` : '')
      : pinnedTool
        ? `${basePrompt}\n\n## 本轮用户已指定工具\n用户已在输入框选择工具「${pinnedTool}」，本轮你只有这一个工具可用。`
          + `本轮必须调用 ${pinnedTool}，按它的参数要求作答，不要声称没有相关工具；`
          + `若它确实回答不了用户的问题，如实说明原因并建议用户切回「自动」换个工具。`
          + (pinnedToolDoc ? `\n\n${pinnedToolDoc.body}` : '')
        : basePrompt,
  };

  // 4) 配置 SSE 响应头 + abort 监听
  const abortController = setupSseResponse(res);

  // 5) 立即发送 meta 事件，告知前端会话 ID 与可用工具
  writeSse(res, 'meta', {
    conversation_id: conv.id,
    title: conv.title,
    available_tools: finalTools.map((t: { name: string; description: string }) => ({ name: t.name, description: t.description })),
    pinned_skill: pinnedSkill,
  });

  // 模型被自动切换时给用户一个可见提示（前端以过程提示形式展示在气泡内）
  if (visionSwitched) {
    writeSse(res, 'notice', { message: `当前模型不支持看图，已自动切换为 ${model}` });
  }

  // 6) 跑 Agent Loop，按事件转发到 SSE
  try {
    const generator = runAgentLoop({
      messages: [systemPrompt, ...conv.messages],
      context: { userEmail: email, userPermissions: permissions },
      tools: finalTools,
      enableTools: enable_tools,
      enablePlanning: enable_planning,
      model,
      conversationId: conv.id,
      signal: abortController.signal,
    });
    const { finalMessages, trace } = await pumpAgentEventsToSse(res, generator);

    // 7) 落盘：把 system 之外的最终消息列表写回会话（去掉 system prompt）
    if (finalMessages) {
      replaceMessages(email, conv.id, finalMessages.filter((m) => m.role !== 'system'));
    }
    // 8) Trace 落盘：成本 / 延迟 / 工具失败率的可观测数据源（失败不影响响应）
    if (trace) {
      appendRunTrace(trace);
    }
    // 9) 长期记忆沉淀：异步执行，不阻塞本次响应；失败只记日志
    if (finalMessages) {
      const lastAssistant = [...finalMessages].reverse().find((m) => m.role === 'assistant');
      void rememberFromTurn({
        userEmail: email,
        conversationId: conv.id,
        userText: userText,
        assistantText: lastAssistant ? extractMessageText(lastAssistant.content) : '',
        model,
      });
    }
    writeSse(res, 'done', { conversation_id: conv.id });
  } catch (err) {
    writeSse(res, 'error', { message: (err as Error).message });
  } finally {
    res.end();
  }
});

export default router;
