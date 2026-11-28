import type { ApiResponse } from './api';

/** AI 回话管理页的运行列表条目 */
export interface AiChatAdminRun {
  /** 运行 ID */
  run_id: string;
  /** 发起用户邮箱 */
  user: string;
  /** 所属会话 ID */
  conversation_id: string;
  /** 使用的模型 */
  model: string;
  /** 开始时间戳（ms） */
  started_at: number;
  /** 端到端耗时（ms） */
  duration_ms: number;
  /** 迭代轮次 */
  iterations: number;
  /** 提示 token */
  prompt_tokens: number;
  /** 补全 token */
  completion_tokens: number;
  /** 总 token */
  total_tokens: number;
  /** 工具调用次数 */
  tool_calls: number;
  /** 工具失败次数 */
  tool_failures: number;
  /** 估算成本（元） */
  cost_cny: number;
  /** 运行异常原因 */
  error: string;
}

/** 单次工具调用的追踪明细 */
export interface AiChatAdminToolCall {
  /** tool_call ID */
  id: string;
  /** 工具名 */
  name: string;
  /** 是否成功 */
  ok: boolean;
  /** 执行耗时（ms） */
  duration_ms: number;
  /** 参数 JSON 字符数 */
  args_chars: number;
  /** 参数原文（旧记录无此字段） */
  args?: string;
  /** 结果摘要（旧记录无此字段） */
  result?: string;
  /** 失败原因（旧记录无此字段） */
  error?: string;
  /** 是否降级重试过 */
  retried?: boolean;
}

/** 单轮迭代的追踪明细 */
export interface AiChatAdminStep {
  /** 第几轮迭代（从 0 开始） */
  iteration: number;
  /** 本轮 token 用量 */
  usage: {
    /** 提示 token */
    prompt_tokens: number;
    /** 补全 token */
    completion_tokens: number;
    /** 总 token */
    total_tokens: number;
  };
  /** 本轮的工具调用明细 */
  tool_calls: AiChatAdminToolCall[];
}

/** 一次运行的完整追踪 */
export interface AiChatAdminTrace {
  /** 运行 ID */
  run_id: string;
  /** 发起用户 */
  user: string;
  /** 会话 ID */
  conversation_id: string;
  /** 模型 */
  model: string;
  /** 开始时间戳（ms） */
  started_at: number;
  /** 结束时间戳（ms） */
  ended_at: number;
  /** 端到端耗时（ms） */
  duration_ms: number;
  /** 迭代轮次 */
  iterations: number;
  /** 提示 token */
  prompt_tokens: number;
  /** 补全 token */
  completion_tokens: number;
  /** 总 token */
  total_tokens: number;
  /** 工具调用次数 */
  tool_calls: number;
  /** 工具失败次数 */
  tool_failures: number;
  /** 是否启用规划与反思 */
  planning_enabled: boolean;
  /** 自我反思轮次 */
  reflections: number;
  /** 估算成本（元） */
  cost_cny: number;
  /** 运行异常原因 */
  error: string;
  /** 逐轮明细 */
  steps: AiChatAdminStep[];
}

/** 管理页展示的一条会话消息 */
export interface AiChatAdminMessage {
  /** 会话内序号 */
  seq: number;
  /** 角色 */
  role: string;
  /** 正文（多模态内容为 JSON 文本） */
  content: string;
  /** assistant 消息的工具调用列表（JSON 文本） */
  tool_calls: string | null;
  /** tool 消息对应的 tool_call_id */
  tool_call_id: string | null;
  /** tool 消息的工具名 */
  name: string | null;
  /** 提示 token */
  prompt_tokens: number;
  /** 补全 token */
  completion_tokens: number;
  /** 总 token */
  total_tokens: number;
  /** 创建时间戳（ms） */
  created_at: number;
}

/** 运行详情关联信息 */
export interface AiChatAdminDetail {
  /** 完整追踪 */
  trace: AiChatAdminTrace;
  /** 所属会话 */
  conversation: {
    /** 会话 ID */
    id: string;
    /** 会话标题 */
    title: string;
    /** 所属用户 */
    user: string;
  };
  /** 会话消息流水 */
  messages: AiChatAdminMessage[];
}

/** 工具调用汇总（前端按 steps 聚合） */
export interface AiChatAdminToolStat {
  /** 工具名 */
  name: string;
  /** 调用次数 */
  calls: number;
  /** 失败次数 */
  failures: number;
  /** 平均耗时（ms） */
  avg_duration_ms: number;
  /** 成功率（0~1） */
  success_rate: number;
}

/** 运行列表查询参数 */
export interface AiChatAdminRunsParams {
  /** 统计天数 */
  days?: number;
  /** 范围：me / all */
  scope?: string;
  /** 关键词 */
  keyword?: string;
  /** 页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
}

/** 运行列表响应 */
export type AiChatAdminRunsResponse = ApiResponse<{
  /** 当前页记录 */
  items: AiChatAdminRun[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 后端实际生效的范围 */
  scope: string;
  /** 后端实际生效的天数 */
  days: number;
}>;

/** 运行详情响应 */
export type AiChatAdminDetailResponse = ApiResponse<AiChatAdminDetail>;
