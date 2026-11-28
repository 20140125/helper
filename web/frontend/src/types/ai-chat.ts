import type { ApiResponse } from './api';

// ──────────────────────────
// 消息与会话类型（前端用，与后端 web/types/ai-chat.ts 对齐）
// ──────────────────────────

/**
 * 聊天消息角色枚举
 * @description 枚举值与后端 JSON 字符串完全一致（'system' / 'user' / 'assistant' / 'tool'），
 *   故跨 SSE / REST 收发可直接 `as ChatRole` 断言、无需运行时转换。
 *   选择普通 enum 而非 const enum：项目 tsconfig 启用了 isolatedModules，
 *   const enum 在跨文件引用时会被 TS 拒绝；普通 enum 会在运行时生成对象，
 *   带来 ChatRole.User === 'user' 的字符串值，前后端互通无缝。
 *   选择 enum 而非字符串字面量联合：把魔法字符串收口在一处定义，
 *   消费方写 `m.role === ChatRole.Assistant` 比 `=== 'assistant'`
 *   更安全（拼写错误能被 TS 直接抓住，重命名也能跟随）。
 */
export enum ChatRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool',
}

/** 工具调用（OpenAI 兼容） */
export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 多模态消息内容片段（与后端 web/types/ai-chat.ts 对齐）
 * @description 文本片段 + 图片片段；图片 url 为 data:image/...;base64 形式
 */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/** 聊天消息 */
export interface ChatMessage {
  /** 消息角色，枚举值见 ChatRole */
  role: ChatRole;
  /**
   * 消息内容
   * @description 纯文本为字符串；带图消息为内容片段数组（文本 + 图片）
   */
  content: string | ChatContentPart[];
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
  name?: string;
  created_at?: number;
  /**
   * 本条 assistant 消息累计的 token 用量（后端 Agent Loop 多轮累加后落盘）
   * @description 仅 assistant 角色携带；用于刷新页面后从历史会话还原 token 展示
   */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** 单个会话 */
export interface ChatConversation {
  id: string;
  title: string;
  user: string;
  messages: ChatMessage[];
  created_at: number;
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
// 工具调用 UI 展示态（前端独有）
// ──────────────────────────

/** 工具调用执行状态 */
export type ToolCallStatus = 'pending' | 'executing' | 'success' | 'failed';

/** 计划步骤状态（后端 PlanStepStatus 的前端镜像） */
export type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** UI 层的单个计划步骤 */
export interface UiPlanStep {
  /** 步骤 ID */
  id: string;
  /** 步骤标题 */
  title: string;
  /** 预期使用的工具名 */
  tool?: string;
  /** 当前状态 */
  status: PlanStepStatus;
}

/** UI 层的执行计划（由 SSE plan_start 事件建立，plan_step 事件推进状态） */
export interface UiPlan {
  /** 任务目标 */
  goal: string;
  /** 步骤列表 */
  steps: UiPlanStep[];
}

/** UI 层的自我反思记录（由 SSE reflection 事件追加） */
export interface UiReflection {
  /** 第几轮 */
  round: number;
  /** 是否判定为已完成 */
  complete: boolean;
  /** 还缺什么 */
  missing: string;
  /** 下一步指令 */
  hint: string;
}

/** UI 层的工具调用记录（合并多个流事件后） */
export interface UiToolCall {
  /** 调用 ID */
  id: string;
  /** 工具名 */
  name: string;
  /** 参数（流式累积的 JSON 字符串） */
  arguments: string;
  /** 当前状态 */
  status: ToolCallStatus;
  /** 执行结果数据（成功或失败） */
  result?: unknown;
  /** 人类可读摘要 */
  summary?: string;
}

/** UI 层的消息（assistant/user/tool 三种） */
export interface UiMessage {
  /** 临时 ID（前端生成） */
  id: string;
  /** 角色（仅 assistant/user，tool 不在 UI 单独展示） */
  role: ChatRole.Assistant | ChatRole.User;
  /** 文本内容（流式累积） */
  content: string;
  /** 模型思考过程（流式累积，仅支持输出思考字段的模型才有） */
  reasoning?: string;
  /** 随消息一起发送的图片 Data URL 列表（user 消息可能有，刷新后从历史还原） */
  images?: string[];
  /** 关联的工具调用列表（assistant 才有） */
  tool_calls: UiToolCall[];
  /** 是否流式生成中 */
  streaming: boolean;
  /** 创建时间戳 */
  created_at: number;
  /** 本轮会话累计的 token 用量（仅 assistant，多次迭代会累加） */
  usage?: {
    /** 本轮会话的 token 用量 */
    prompt_tokens: number;
    /** 补全 token 用量 */
    completion_tokens: number;
    /** 总 token 用量 */
    total_tokens: number;
  };
  /** L3 执行计划（仅 assistant，开启规划模式且有计划时才有） */
  plan?: UiPlan;
  /** L3 自我反思记录（仅 assistant，每轮反思追加一条） */
  reflections?: UiReflection[];
  /** 过程提示（仅 assistant，如模型限流重试中） */
  notices?: string[];
}

// ──────────────────────────
// 请求体 / 响应类型
// ──────────────────────────

/** 创建会话请求体 */
export interface CreateConversationPayload {
  title?: string;
}

/** 发送消息请求体 */
export interface SendMessagePayload {
  conversation_id?: string;
  message: string;
  enable_tools?: boolean;
  /** 是否允许 LLM 按需调用「联网搜索」工具，默认 false */
  enable_web_search?: boolean;
  /**
   * 是否启用 L3「规划 → 执行 → 反思」能力，默认 false
   * @description 关闭后 Agent 退化为单循环直跑，省掉规划/反思的额外 LLM 调用
   */
  enable_planning?: boolean;
  /**
   * 用户在输入框显式选择的技能 key（可选）
   * @description 传值时后端本轮只保留 card_skill 并锁定该 skill_key；
   *   不传（空）则由 AI 按语义自行判断使用哪个技能。
   */
  pinned_skill?: string;
  /** 本次请求使用的模型 ID（可选，不传则后端采默认值） */
  model?: string;
  /** 本轮随消息一起上传的图片（data:image/...;base64 形式的 Data URL） */
  images?: string[];
}

/** LLM 服务提供方（前后端一致；custom 为用户在配置页新增的自定义模型） */
export type LlmProvider = 'zhipu' | 'custom';

/** LLM 模型选项（前后端一致） */
export interface LlmModelOption {
  /** 后端请求使用的模型 ID */
  id: string;
  /** 前端展示名称 */
  label: string;
  /** 描述（可选） */
  description?: string;
  /** 是否免费 */
  free?: boolean;
  /** 是否享有赠送资源包额度（非真免费，但有官方赠送的额度可消耗） */
  bonusQuota?: boolean;
  /** 是否支持 SSE 流式调用（默认 true；图像/视频生成类模型通常不支持） */
  streamable?: boolean;
  /** 是否支持图片理解（多模态输入），默认 false */
  vision?: boolean;
  /** 服务提供方（默认 zhipu） */
  provider?: LlmProvider;
  /** 所属配置组 ID（供聊天下拉按组展示） */
  groupId?: string;
  /** 所属配置组名称 */
  groupName?: string;
}

/** 聊天下拉里按配置组聚合后的模型分组 */
export interface LlmModelGroupSection {
  /** 分组 key（配置组 ID，未分组使用固定值） */
  key: string;
  /** 分组标题 */
  label: string;
  /** 该组下的模型 */
  models: LlmModelOption[];
}

/** 单个工具元数据（健康检查/SSE meta 返回） */
export interface AiToolMeta {
  name: string;
  description: string;
}

// ──────────────────────────
// SSE 事件回调集合（前端流式处理用）
// ──────────────────────────

/** 流式发送消息的事件回调集合 */
export interface SendMessageEventHandlers {
  /** 收到 meta 事件（第一条），返回会话 ID 与可用工具 */
  onMeta?: (payload: SseMetaPayload) => void;
  /** 收到文本增量 */
  onDelta?: (payload: SseDeltaPayload) => void;
  /** 收到模型思考过程的增量（与正文分开） */
  onReasoning?: (payload: SseReasoningPayload) => void;
  /** 工具调用开始 */
  onToolStart?: (payload: SseToolStartPayload) => void;
  /** 工具调用参数增量 */
  onToolArgs?: (payload: SseToolArgsPayload) => void;
  /** 工具准备执行 */
  onToolExecuting?: (payload: SseToolExecutingPayload) => void;
  /** 工具调用结果 */
  onToolResult?: (payload: SseToolResultPayload) => void;
  /** Agent 一轮迭代结束 */
  onIterationEnd?: (payload: SseIterationEndPayload) => void;
  /** Agent 一轮迭代的 token 用量（部分厂商可能不返回） */
  onIterationUsage?: (payload: SseIterationUsagePayload) => void;
  /** L3：规划器产出执行计划 */
  onPlanStart?: (payload: SsePlanStartPayload) => void;
  /** L3：计划中某个步骤的状态推进 */
  onPlanStep?: (payload: SsePlanStepPayload) => void;
  /** L3：收尾前的自我反思结论 */
  onReflection?: (payload: SseReflectionPayload) => void;
  /** 过程提示（如模型限流、正在重试） */
  onNotice?: (payload: SseNoticePayload) => void;
  /** 整个会话结束 */
  onDone?: (payload: SseDonePayload) => void;
  /** 出错 */
  onError?: (payload: SseErrorPayload) => void;
}

// ──────────────────────────
// 接口响应
// ──────────────────────────

export interface ConversationsListResponse {
  code: number;
  data: { conversations: ChatConversationSummary[] };
  message: string;
}

export interface ConversationResponse {
  code: number;
  data: {
    /** 会话（messages 为当前页，按时间升序） */
    conversation: ChatConversation;
    /** 是否还有更早的消息可向上翻 */
    has_more?: boolean;
    /** 下一页游标（本次返回的最早消息 seq） */
    next_before?: number | null;
  };
  message: string;
}

export interface AiChatHealthResponse {
  code: number;
  data: { healthy: boolean; message: string };
  message: string;
}

/** 可用模型列表响应 */
export interface ModelsListResponse {
  code: number;
  data: { models: LlmModelOption[]; default: string };
  message: string;
}

/** 单个可用工具（下拉展示用：工具名 + 后端声明的中文说明） */
export interface AiChatToolOption {
  name: string;
  description: string;
}

/** 可用工具列表响应（GET /api/ai-chat/tools） */
export interface AiChatToolsResponse {
  code: number;
  data: { tools: AiChatToolOption[] };
  message: string;
}

// ──────────────────────────
// SSE 事件载荷类型
// ──────────────────────────

/** SSE 事件名 */
export type SseEventName =
  | 'meta'
  | 'delta'
  | 'reasoning'
  | 'tool_start'
  | 'tool_args'
  | 'tool_executing'
  | 'tool_result'
  | 'plan_start'
  | 'plan_step'
  | 'reflection'
  | 'iteration_end'
  | 'iteration_usage'
  | 'notice'
  | 'done'
  | 'error';

/** 各 SSE 事件对应的载荷类型 */
export interface SseMetaPayload {
  conversation_id: string;
  title: string;
  available_tools: AiToolMeta[];
}

export interface SseDeltaPayload {
  delta: string;
}

/** 模型思考过程的增量载荷 */
export interface SseReasoningPayload {
  /** 本帧新增的思考文本 */
  delta: string;
}

export interface SseToolStartPayload {
  id: string;
  name: string;
}

export interface SseToolArgsPayload {
  id: string;
  delta: string;
}

export interface SseToolExecutingPayload {
  id: string;
  name: string;
  arguments: string;
}

export interface SseToolResultPayload {
  id: string;
  name: string;
  ok: boolean;
  data: unknown;
  summary?: string;
}

export interface SseIterationEndPayload {
  iteration: number;
  finish_reason: string;
}

/** L3：规划器产出的执行计划 */
export interface SsePlanStartPayload {
  goal: string;
  steps: Array<{ id: string; title: string; tool?: string }>;
}

/** L3：单个计划步骤的状态推进 */
export interface SsePlanStepPayload {
  step_id: string;
  title: string;
  status: PlanStepStatus;
}

/** L3：自我反思结论 */
export interface SseReflectionPayload {
  round: number;
  complete: boolean;
  missing: string;
  hint: string;
}

export interface SseIterationUsagePayload {
  iteration: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SseDonePayload {
  conversation_id: string;
}

/** 过程提示（如模型限流、正在重试） */
export interface SseNoticePayload {
  message: string;
}

export interface SseErrorPayload {
  message: string;
}

/** 审批单状态（与后端 types/ai-chat.ts 的 ApprovalStatus 对齐） */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

/** 一张副作用操作审批单（Human-in-the-loop：LLM 建单、人工通过后由审批人身份执行） */
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
  /** 申请理由 */
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

/** GET /api/ai-chat/approvals 响应 */
export type ApprovalsResponse = ApiResponse<{ approvals: ApprovalRequest[] }>;

/** POST /api/ai-chat/approvals/:id/approve 与 /reject 响应 */
export type ApprovalActionResponse = ApiResponse<{ approval: ApprovalRequest }>;
