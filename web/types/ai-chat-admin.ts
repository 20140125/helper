/**
 * AI 回话管理页数据类型
 * @description 后端接口契约：运行列表来自 hp_ai_run_traces，
 *   详情由运行追踪、会话信息与 hp_ai_messages 消息流水组装而成。
 */

import type { AgentRunTrace } from './ai-chat';

/** 运行列表的一条记录（不含 steps，避免列表接口传输大 JSON） */
export interface AiChatAdminRunRow {
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
  /** 运行异常原因（正常结束为空串） */
  error: string;
}

/** 运行列表查询条件 */
export interface AiChatAdminRunQuery {
  /** 限定用户邮箱；空串表示不限用户（仅管理员可用） */
  user?: string;
  /** 起始时间戳（ms，含） */
  from: number;
  /** 结束时间戳（ms，含） */
  to: number;
  /** 关键词：匹配运行 ID / 会话 ID / 用户 / 模型 / 错误 */
  keyword?: string;
  /** 页码，从 1 开始 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 是否只返回有落盘回话的运行（默认 true；false 时包含无回话的中断/空跑） */
  onlyWithMessages?: boolean;
}

/** 运行列表分页结果 */
export interface AiChatAdminRunPage {
  /** 当前页记录 */
  items: AiChatAdminRunRow[];
  /** 符合条件的总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** 管理页展示的一条会话消息 */
export interface AiChatAdminMessage {
  /** 会话内消息序号 */
  seq: number;
  /** 角色：system / user / assistant / tool */
  role: string;
  /** 消息正文；多模态内容为内容片段 JSON 文本 */
  content: string;
  /** assistant 消息附带的工具调用列表（JSON 文本） */
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
  /** 消息创建时间戳（ms） */
  created_at: number;
}

/** 运行详情：追踪 + 会话信息 + 消息流水 */
export interface AiChatAdminRunDetail {
  /** 完整运行追踪，含逐轮 steps 与工具调用明细 */
  trace: AgentRunTrace;
  /** 所属会话信息 */
  conversation: {
    /** 会话 ID */
    id: string;
    /** 会话标题 */
    title: string;
    /** 所属用户 */
    user: string;
  };
  /** 会话消息（按 seq 升序，最多 200 条） */
  messages: AiChatAdminMessage[];
}
