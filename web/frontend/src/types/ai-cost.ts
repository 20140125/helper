/**
 * AI 成本看板类型定义
 * @description 与后端 `web/types/ai-chat.ts` 的 Trace 聚合结构一一对应，
 *   数据来源为 `GET /api/ai-chat/stats`。
 */

/** 按天聚合桶 */
export interface AiCostDayBucket {
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
export interface AiCostModelBucket {
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
export interface AiCostToolBucket {
  /** 工具名 */
  name: string;
  /** 调用次数 */
  calls: number;
  /** 失败次数 */
  failures: number;
  /** 平均耗时（ms） */
  avg_duration_ms: number;
}

/** 统计汇总 */
export interface AiCostSummary {
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
  /** 平均端到端耗时（ms） */
  avg_duration_ms: number;
  /** P95 端到端耗时（ms） */
  p95_duration_ms: number;
  /** 工具调用总次数 */
  tool_calls: number;
  /** 工具失败率（0~1） */
  tool_failure_rate: number;
  /** 按天聚合 */
  by_day: AiCostDayBucket[];
  /** 按模型聚合 */
  by_model: AiCostModelBucket[];
  /** 按工具聚合 */
  by_tool: AiCostToolBucket[];
}

/** 单次巡检结果（对应后端 runInspection 的返回） */
export interface AiInspectionResult {
  /** 是否成功产出简报 */
  ok: boolean;
  /** 巡检简报正文（Markdown） */
  brief: string;
  /** 端到端耗时（ms） */
  duration_ms: number;
  /** 本次调用的工具次数 */
  tool_calls: number;
  /** 失败原因（ok=false 时有值） */
  error?: string;
  /** 推送结果（仅 push=true 时有值） */
  push_result?: {
    /** 是否推送成功 */
    ok: boolean;
    /** 推送结果描述 */
    message: string;
  };
}

/** 手动巡检接口的响应体（后台异步执行，只回执是否已发起） */
export interface AiInspectionResponse {
  /** 响应码 */
  code: number;
  /** 响应数据 */
  data: {
    /** 是否成功发起（已在跑时为 false） */
    started: boolean;
  };
  /** 响应消息 */
  message: string;
}

/** 定时巡检的调度状态（对应后端 `GET /api/ai-chat/inspect/status`） */
export interface AiInspectionStatus {
  /** 是否启用定时巡检 */
  enabled: boolean;
  /** 是否正在执行 */
  running: boolean;
  /** 生效的时间配置（cron 表达式或 HH:mm） */
  schedule: string;
  /** 人类可读的调度描述 */
  scheduleText: string;
  /** 是否推送简报到企微群 */
  push: boolean;
  /** 执行身份邮箱 */
  email: string;
  /** 最近一次执行时间（ISO；从未执行为空串） */
  lastRunAt: string;
  /** 最近一次执行结果：idle 未跑过 / ok 成功 / fail 失败 */
  lastStatus: 'idle' | 'ok' | 'fail';
  /** 最近一次失败原因 */
  lastError: string;
  /** 最近一次执行摘要 */
  lastSummary: string;
  /** 下一次预计执行时间（ISO；未启用时为空串） */
  nextRunAt: string;
  /** 当日连续失败次数 */
  failCount: number;
  /** 最近一次巡检的产出（含简报正文）；未跑过时为 null */
  lastResult: AiInspectionRunRecord | null;
}

/** 最近一次巡检的产出（后端状态接口里的 lastResult） */
export interface AiInspectionRunRecord {
  /** 是否成功产出简报 */
  ok: boolean;
  /** 简报正文（Markdown） */
  report: string;
  /** 失败原因（成功为空串） */
  error: string;
  /** 端到端耗时（ms） */
  duration_ms: number;
  /** 消耗 token 总数 */
  total_tokens: number;
  /** 工具调用次数 */
  tool_calls: number;
  /** 是否已推送到企微群 */
  pushed: boolean;
  /** 本次执行时间（ISO） */
  run_at: string;
  /** 是否手动触发 */
  manual: boolean;
}

/** 巡检调度状态接口的响应体 */
export interface AiInspectionStatusResponse {
  /** 响应码 */
  code: number;
  /** 响应数据 */
  data: {
    /** 调度状态 */
    status: AiInspectionStatus;
  };
  /** 响应消息 */
  message: string;
}

/** 统计接口的响应体 */
export interface AiCostStatsResponse {
  /** 响应码 */
  code: number;
  /** 响应数据 */
  data: {
    /** 统计范围（me=仅自己 / all=全量） */
    scope: string;
    /** 统计天数 */
    days: number;
    /** 汇总结果 */
    summary: AiCostSummary;
  };
  /** 响应消息 */
  message: string;
}
