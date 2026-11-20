import path from 'path';
import { CACHE_DIR } from '@/utils/paths';

/** AI 会话存储目录（按用户邮箱分子目录） */
export const AI_CONVERSATIONS_DIR = path.join(CACHE_DIR, 'ai-conversations');

/** AI 运行追踪存储目录（按月分文件的 JSONL，append-only） */
export const AI_TRACES_DIR = path.join(CACHE_DIR, 'ai-traces');

/** AI 长期记忆存储目录（按用户邮箱一个 JSON 文件） */
export const AI_MEMORY_DIR = path.join(CACHE_DIR, 'ai-memory');

/** AI 副作用操作审批单文件 */
export const AI_APPROVALS_FILE = path.join(CACHE_DIR, 'ai-approvals.json');

/** LLM 服务提供方（custom 为用户在配置页新增的自定义模型） */
export type LlmProvider = 'zhipu' | 'custom';

/** 可选模型选项 */
export interface LlmModelOption {
  /** 后端请求使用的模型 ID */
  id: string;
  /** 前端展示名称 */
  label: string;
  /** 描述（可选，展示于下拉项辅助信息） */
  description?: string;
  /** 是否免费 */
  free?: boolean;
  /** 是否享有赠送资源包额度（非真免费，但有官方赠送的额度可消耗） */
  bonusQuota?: boolean;
  /** 是否支持 SSE 流式调用（默认 true；图像/视频生成类模型通常不支持） */
  streamable?: boolean;
  /** 是否支持图片理解（多模态输入），默认 false */
  vision?: boolean;
  /** 服务提供方（默认 zhipu）；用于在 request 时路由到不同 baseUrl/apiKey */
  provider?: LlmProvider;
  /** 所属配置组 ID（供聊天下拉按组展示） */
  groupId?: string;
  /** 所属配置组名称 */
  groupName?: string;
}

/**
 * 多模态消息内容片段（OpenAI 兼容）
 * @description 文本片段 + 图片片段；图片 url 支持 http(s) 链接或 data:image/...;base64 形式
 */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** 单会话最大保留消息数（超出滑动窗口截断） */
export const MAX_MESSAGES_PER_CONVERSATION = 50;

/** 单次响应最大 token 数 */
export const DEFAULT_MAX_TOKENS = 4096;

/** 单条消息最多携带的图片数量 */
export const MAX_IMAGES_PER_MESSAGE = 4;

/**
 * 单张图片 Data URL 允许的最大字符数
 * @description base64 后体积约为原图的 1.37 倍，8M 字符 ≈ 5.8MB 原图
 */
export const MAX_IMAGE_DATA_URL_CHARS = 8_000_000;

/**
 * AI Chat 发送接口的请求体大小上限
 * @description /api/ai-chat/send 会携带 base64 图片，远超 express.json() 默认的 100kb
 */
export const AI_CHAT_SEND_BODY_LIMIT = '32mb';

/** 用户只上传图片、未输入文字时的兜底提问 */
export const DEFAULT_IMAGE_QUESTION = '请看一下这张图片';

/** Agent Loop 最大循环轮次（防止 tool_call 死循环） */
export const MAX_AGENT_LOOP_ITERATIONS = 8;

/** 单次工具调用超时（毫秒） */
export const TOOL_CALL_TIMEOUT_MS = 30_000;

/** 单个执行计划允许的最大步骤数（超出部分由 LLM 自行合并） */
export const MAX_PLAN_STEPS = 6;

/**
 * 一次会话内允许的最大自我反思轮次
 * @description 每轮反思若判定「未完成」会驱动 Agent 继续跑，必须设上限防止无限递归烧 token
 */
export const MAX_REFLECTION_ROUNDS = 2;

// ──────────────────────────
// 规划 / 反思类型（L3 能力）
// ──────────────────────────

/** 计划步骤状态 */
export type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** 执行计划中的单个步骤 */
export interface AgentPlanStep {
  /** 步骤 ID（LLM 生成，形如 s1/s2） */
  id: string;
  /** 步骤标题（一句话，面向用户） */
  title: string;
  /** 本步骤预期使用的工具名（可选，纯对话步骤无工具） */
  tool?: string;
  /** 当前状态 */
  status: PlanStepStatus;
}

/** Agent 执行计划（规划阶段产出，贯穿整个 Loop 维护状态） */
export interface AgentPlan {
  /** 本次任务目标（由用户诉求提炼） */
  goal: string;
  /** 步骤列表 */
  steps: AgentPlanStep[];
  /** 是否由规划器真实产出（false 表示降级为「无计划直跑」） */
  planned: boolean;
}

/** 自我反思结论（Loop 收尾时产出，决定是否补跑） */
export interface AgentReflection {
  /** 第几轮反思（从 1 开始） */
  round: number;
  /** 是否已经充分回答用户问题 */
  complete: boolean;
  /** 还缺什么（complete=true 时为空串） */
  missing: string;
  /** 给下一轮的补充指令（complete=true 时为空串） */
  hint: string;
}

// ──────────────────────────
// 消息与会话类型
// ──────────────────────────

/** 聊天消息角色 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** OpenAI 兼容的 tool_call 结构（assistant 消息附带） */
export interface ChatToolCall {
  /** tool_call 唯一 ID */
  id: string;
  /** 类型固定为 function */
  type: 'function';
  /** 函数调用详情 */
  function: {
    /** 函数名 */
    name: string;
    /** 参数 JSON 字符串 */
    arguments: string;
  };
}

/** 聊天消息（OpenAI 兼容） */
export interface ChatMessage {
  /** 角色 */
  role: ChatRole;
  /**
   * 消息内容
   * @description 纯文本为字符串；携带图片的多模态消息为内容片段数组
   *   （如 [{ type: 'text' }, { type: 'image_url' }]）
   */
  content: string | ChatContentPart[];
  /** assistant 触发的工具调用列表 */
  tool_calls?: ChatToolCall[];
  /** tool 角色专用：对应的 tool_call_id */
  tool_call_id?: string;
  /** tool 角色专用：工具名称（便于前端展示） */
  name?: string;
  /** 消息创建时间戳（ms） */
  created_at?: number;
  /**
   * 本条 assistant 消息累计的 token 用量
   * @description 仅 assistant 角色携带；多轮 tool_calls 场景下后端会把每轮 iteration_usage 累加到此处，
   *   随会话 JSON 一起落盘，便于刷新后恢复展示。剥离 OpenAI 协议字段时（stripInternalFields）会被丢弃，不会上行。
   */
  usage?: {
    /** 提示 token 用量 */
    prompt_tokens: number;
    /** 补全 token 用量 */
    completion_tokens: number;
    /** 总 token 用量 */
    total_tokens: number;
  };
}

/** 单个会话 */
export interface ChatConversation {
  /** 会话 ID */
  id: string;
  /** 会话标题（默认取首条用户消息前 20 字） */
  title: string;
  /** 所属用户邮箱 */
  user: string;
  /** 消息列表（不含 system prompt） */
  messages: ChatMessage[];
  /** 创建时间戳（ms） */
  created_at: number;
  /** 更新时间戳（ms） */
  updated_at: number;
}

/** 会话摘要（列表用） */
export interface ChatConversationSummary {
  id: string;
  title: string;
  message_count: number;
  created_at: number;
  updated_at: number;
}

// ──────────────────────────
// 工具相关类型
// ──────────────────────────

/** OpenAI 兼容的 tool 定义（system 注入给 LLM） */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/** 工具执行上下文（每次调用注入） */
export interface ToolContext {
  /** 当前用户邮箱 */
  userEmail: string;
  /** 当前用户拥有的全部权限码 */
  userPermissions: string[];
  /**
   * 当前会话 ID（由 agent-loop 注入）
   * @description 建审批单时写进 approval.conversation_id，审批出结果后据此把结果
   *   回写到发起人的那条对话里，避免「规则已建但用户不知道」。
   */
  conversationId?: string;
  /**
   * 本轮对话已创建的审批单 ID（由 agent-loop 收集）
   * @description request_approval 建单后把 id 塞进来；一旦本轮 LLM 回复失败
   *   （限流 / 网络异常 / 用户中止），loop 会把这些仍 pending 的单统一作废——
   *   否则用户没看到任何回复，不知道单已建，只会反复重试造成重复审批单。
   */
  createdApprovalIds?: string[];
}

/** 工具执行结果 */
export interface ToolResult {
  /** 是否成功 */
  ok: boolean;
  /** 结果数据（成功时）或错误描述（失败时） */
  data: unknown;
  /** 可选的人类可读摘要，用于前端展示 */
  summary?: string;
}

/** 工具触发样例（同时供人类参考 + 注入到 description 末尾让 LLM 学习触发条件） */
export interface ToolExample {
  /** 用户的典型自然语言提问 */
  user: string;
  /** 命中本工具时应使用的参数（不含工具名，工具名以 ToolImpl.name 为准） */
  args: Record<string, unknown>;
}

/** 工具实现接口 */
export interface ToolImpl {
  /** 工具名（与 LLM 调用名称一致，必须英文蛇形） */
  name: string;
  /** 描述（给 LLM 看，决定它何时选用） */
  description: string;
  /** 参数 JSON Schema */
  parameters: ToolDefinition['function']['parameters'];
  /** 调用此工具所需的权限码（任一即可），不填则无需特殊权限 */
  requiredPermissions?: string[];
  /** 触发样例（可选；buildToolDefinitions 会把它们序列化拼到 description 末尾给 LLM 看） */
  examples?: ToolExample[];
  /** 执行实现 */
  invoke: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

// ──────────────────────────
// 请求体 / 响应体类型
// ──────────────────────────

/** 发送消息请求体 */
export interface SendMessageBody {
  /** 会话 ID（不填则后端自动创建） */
  conversation_id?: string;
  /** 用户输入文本 */
  message: string;
  /** 是否启用工具调用（默认 true） */
  enable_tools?: boolean;
  /** 是否允许 LLM 按需调用「联网搜索」工具，默认 false；为 true 时才会将 web_search 工具加入可用工具列表 */
  enable_web_search?: boolean;
  /**
   * 是否启用 L3 规划 + 反思能力，默认 false
   * @description true 时 Agent 会先产出执行计划，并在收尾前自我反思；
   *   判定未完成时自动补跑（受 MAX_REFLECTION_ROUNDS 限制）。
   *   关闭后退化为 L2 单循环直跑，省掉规划/反思的额外 LLM 调用。
   */
  enable_planning?: boolean;
  /**
   * 用户在输入框显式选择的技能 key（可选）
   * @description 传值时本轮只保留 card_skill 工具，并在 system prompt 中锁定该 skill_key，
   *   AI 不再自行挑选技能；不传（空）则由 AI 按语义自行判断。
   */
  pinned_skill?: string;
  /** 本次请求使用的模型 ID（可选，不传则使用后端默认） */
  model?: string;
  /**
   * 本轮随消息一起上传的图片（可选）
   * @description 元素为 data:image/...;base64 形式的 Data URL；
   *   非空时后端会把用户消息组装成多模态内容（文本 + 图片片段），
   *   并在当前模型不支持看图时自动切换到默认视觉模型。
   */
  images?: string[];
}

/** 创建会话请求体 */
export interface CreateConversationBody {
  /** 可选标题（不填后端用「新对话」） */
  title?: string;
}

/** 通用响应（仅类型注释用） */
export interface AiChatResponse {
  code: number;
  data: Record<string, unknown>;
  message: string;
}

// ──────────────────────────
// 视频生成相关类型（异步任务模式）
// ──────────────────────────

/** 视频生成结果 */
export interface VideoGenerationResult {
  /** 视频 URL 列表 */
  video_urls: string[];
  /** 封面图 URL 列表（与 video_urls 一一对应） */
  cover_urls: string[];
}

/** 视频生成进度回调事件 */
export type VideoProgressEvent =
  | { type: 'submitted'; task_id: string }
  | { type: 'polling'; task_id: string; elapsed_ms: number };

// ──────────────────────────
// 运行追踪（Trace）/ 成本可观测
// ──────────────────────────

/** 单次工具调用的追踪记录 */
export interface ToolCallTrace {
  /** tool_call ID */
  id: string;
  /** 工具名 */
  name: string;
  /** 工具是否执行成功 */
  ok: boolean;
  /** 执行耗时（毫秒） */
  duration_ms: number;
  /** 参数 JSON 字符数（用于观察参数规模是否异常） */
  args_chars: number;
  /** 是否走了一次「只保留必填参数」的降级重试 */
  retried?: boolean;
}

/** 单轮迭代的追踪记录 */
export interface IterationTrace {
  /** 第几轮迭代（从 0 开始） */
  iteration: number;
  /** 本轮 token 用量 */
  usage: {
    /** 提示 token */
    prompt_tokens: number;
    /** 补全 token */
    completion_tokens: number;
    /** 合计 token */
    total_tokens: number;
  };
  /** 本轮执行的工具调用明细 */
  tool_calls: ToolCallTrace[];
}

/** 一次 Agent 运行的完整追踪（append-only 落盘，用于成本/延迟/失败率分析） */
export interface AgentRunTrace {
  /** 运行唯一 ID */
  run_id: string;
  /** 发起用户邮箱 */
  user: string;
  /** 所属会话 ID */
  conversation_id: string;
  /** 实际使用的模型 ID */
  model: string;
  /** 开始时间戳（ms） */
  started_at: number;
  /** 结束时间戳（ms） */
  ended_at: number;
  /** 端到端耗时（ms） */
  duration_ms: number;
  /** 迭代轮次数 */
  iterations: number;
  /** 累计提示 token */
  prompt_tokens: number;
  /** 累计补全 token */
  completion_tokens: number;
  /** 累计总 token */
  total_tokens: number;
  /** 工具调用总次数 */
  tool_calls: number;
  /** 工具调用失败次数 */
  tool_failures: number;
  /** 是否启用了 L3 规划 + 反思 */
  planning_enabled: boolean;
  /** 实际发生的自我反思轮次 */
  reflections: number;
  /** 估算成本（元；免费模型为 0） */
  cost_cny: number;
  /** 异常原因（正常结束为空串） */
  error: string;
  /** 逐轮明细 */
  steps: IterationTrace[];
}

/**
 * Trace 查询过滤条件
 * @description 时间范围含两端；user 为空表示不限用户（供管理员看全量）
 */
export interface TraceQuery {
  /** 用户邮箱（空串表示不限） */
  user?: string;
  /** 起始时间戳（ms，含） */
  from?: number;
  /** 结束时间戳（ms，含） */
  to?: number;
  /** 最多返回条数（按时间倒序截断） */
  limit?: number;
}

/** Trace 聚合结果（成本看板用） */
export interface TraceSummary {
  /** 运行次数 */
  runs: number;
  /** 累计提示 token */
  prompt_tokens: number;
  /** 累计补全 token */
  completion_tokens: number;
  /** 累计总 token */
  total_tokens: number;
  /** 估算总成本（元） */
  cost_cny: number;
  /** 端到端耗时平均值（ms） */
  avg_duration_ms: number;
  /** 端到端耗时 P95（ms） */
  p95_duration_ms: number;
  /** 工具调用总次数 */
  tool_calls: number;
  /** 工具失败率（0~1） */
  tool_failure_rate: number;
  /** 按天聚合（YYYY-MM-DD 升序） */
  by_day: TraceDayBucket[];
  /** 按模型聚合（按 token 降序） */
  by_model: TraceModelBucket[];
  /** 按工具聚合（按调用次数降序） */
  by_tool: TraceToolBucket[];
}

/** 按天聚合桶 */
export interface TraceDayBucket {
  /** 日期（YYYY-MM-DD） */
  date: string;
  /** 当天运行次数 */
  runs: number;
  /** 当天总 token */
  total_tokens: number;
  /** 当天估算成本（元） */
  cost_cny: number;
}

/** 按模型聚合桶 */
export interface TraceModelBucket {
  /** 模型 ID */
  model: string;
  /** 运行次数 */
  runs: number;
  /** 总 token */
  total_tokens: number;
  /** 估算成本（元） */
  cost_cny: number;
  /** 平均耗时（ms） */
  avg_duration_ms: number;
}

/** 按工具聚合桶 */
export interface TraceToolBucket {
  /** 工具名 */
  name: string;
  /** 调用次数 */
  calls: number;
  /** 失败次数 */
  failures: number;
  /** 平均耗时（ms） */
  avg_duration_ms: number;
}

/** Trace 文件最多保留的月数（更早的按月文件由 pruneTraceFiles 清理） */
export const AI_TRACE_KEEP_MONTHS = 6;

// ──────────────────────────
// 长期记忆（跨会话）
// ──────────────────────────

/** 单条记忆 */
export interface MemoryItem {
  /** 记忆 ID */
  id: string;
  /** 记忆正文（一句可独立理解的事实） */
  content: string;
  /** 来源会话 ID（便于追溯与排障） */
  source: string;
  /** 创建时间戳（ms） */
  created_at: number;
  /** 最近一次命中（被注入）的时间戳（ms） */
  updated_at: number;
  /** 累计被注入次数（用于淘汰低价值记忆） */
  hits: number;
}

/** 某个用户的长期记忆集合 */
export interface UserMemory {
  /** 用户邮箱 */
  user: string;
  /** 记忆条目（新的在前） */
  items: MemoryItem[];
  /** 最近更新时间戳（ms） */
  updated_at: number;
}

// ──────────────────────────
// 副作用操作审批（Human-in-the-loop）
// ──────────────────────────

/** 审批单状态 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

/** 一张副作用操作审批单 */
export interface ApprovalRequest {
  /** 审批单 ID */
  id: string;
  /** 发起人邮箱 */
  user: string;
  /** 来源会话 ID */
  conversation_id: string;
  /** 待执行的工具名（副作用工具） */
  tool: string;
  /** 工具参数 */
  args: Record<string, unknown>;
  /** 申请理由（LLM 或用户给出） */
  reason: string;
  /** 当前状态 */
  status: ApprovalStatus;
  /** 创建时间戳（ms） */
  created_at: number;
  /** 决策时间戳（ms） */
  decided_at?: number;
  /** 决策人邮箱 */
  decided_by?: string;
  /** 执行结果摘要 */
  result?: string;
}

/** 单个用户最多保留的记忆条数（超出按「命中次数 + 时间」淘汰最旧的） */
export const MAX_MEMORY_ITEMS = 50;

/** 单轮对话最多抽取的记忆条数（防止 LLM 把整段对话都记下来） */
export const MAX_MEMORY_PER_TURN = 3;

/**
 * 副作用工具名白名单
 * @description 这些工具会产生外部影响（发消息、跑脚本、启停服务）。
 *   Agent Loop 对它们**强制串行执行**，其余只读工具才允许并发——
 *   避免 LLM 一次吐出多条副作用调用时被并行放大成重复推送/重复执行。
 */
export const SIDE_EFFECT_TOOLS: string[] = [
  'send_wecom_message',
  'trigger_script',
  'manage_service',
  'create_rule',
  'annual_update',
  'manage_rule',
  'update_config',
  'manage_rbac',
  'manage_logs',
  'manage_cache',
  'manage_webhook',
];

/**
 * 增删改类工具（会写入 / 变更持久化数据）
 * @description 严格模式下**只有这类工具**需要先建审批单。
 *   推送消息、跑脚本、启停服务属于「动作」而非数据变更，不该强制走审批——
 *   它们仍受 consent 短语与权限码约束，但不占用审批队列。
 *   本列表是 SIDE_EFFECT_TOOLS 的子集，新增写工具时记得同步登记。
 */
export const MUTATION_TOOLS: string[] = [
  'create_rule',
  'manage_rule',
  'update_config',
  'manage_rbac',
  'manage_logs',
  'manage_cache',
  'manage_webhook',
  'annual_update',
];

/**
 * 可发起审批的工具（副作用工具白名单）
 * @description 与严格模式的强制建单不同：这里覆盖全部副作用工具——
 *   用户明确说「先别执行 / 等我确认 / 走审批」时，推送、跑脚本、启停服务也允许挂起等确认；
 *   严格模式自动建单的只有 MUTATION_TOOLS（增删改）。
 * @note 必须定义在 types 层：approval-store 会 import ./tools（含 request-approval-tool），
 *   若本常量定义在 approval-store 内，就会形成循环依赖，导致 request_approval 加载失败。
 */
export const APPROVABLE_TOOLS: string[] = [...SIDE_EFFECT_TOOLS];

