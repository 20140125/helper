import { readAiModelGroups } from '@/utils/ai-model-config';
import {
  type AgentRunTrace,
  type TraceDayBucket,
  type TraceModelBucket,
  type TraceSummary,
  type TraceToolBucket,
} from '@/types/ai-chat';

/**
 * 读取模型单价表（元 / 百万 token）
 * @returns {Record<string, { prompt: number; completion: number }>} 按模型 ID 索引的单价
 * @description 代码中不再内置任何模型单价：唯一来源是「系统配置 → AI 模型与记忆」里每个配置组的
 *   「模型单价表」，形如 {"glm-4.6":{"prompt":2,"completion":6}}；全局 .env 的旧配置作为兼容底表，
 *   同型号以配置组为准。只接受非负有限数值，脏数据与解析失败一律忽略，未配置的模型按 0（免费）计。
 */
const readCustomPricing = (): Record<string, { prompt: number; completion: number }> => {
  const merged: Record<string, { prompt: number; completion: number }> = {};
  /**
   * 合并一份单价表
   * @param {unknown} raw - 待合并的单价表对象
   * @returns {void}
   */
  const assignPricing = (raw: unknown): void => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    Object.entries(raw as Record<string, unknown>).forEach(([id, item]) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const price = item as Record<string, unknown>;
      const prompt = Number(price.prompt);
      const completion = Number(price.completion);
      if (!Number.isFinite(prompt) || !Number.isFinite(completion) || prompt < 0 || completion < 0) return;
      merged[id] = { prompt, completion };
    });
  };

  const raw = process.env.AI_COST_PRICING_JSON ?? '';
  if (raw.trim()) {
    try {
      assignPricing(JSON.parse(raw));
    } catch {
      // 旧全局配置损坏时忽略，不影响配置组单价
    }
  }
  readAiModelGroups().forEach((group) => assignPricing(group.pricing ?? {}));
  return merged;
};

/**
 * 估算一次调用的 token 成本（元）
 * @param {string} model - 模型 ID
 * @param {number} promptTokens - 提示 token 数
 * @param {number} completionTokens - 补全 token 数
 * @returns {number} 估算成本（元，保留 6 位小数）；未在配置里填写单价的模型按 0（免费）计
 */
export const estimateCost = (model: string, promptTokens: number, completionTokens: number): number => {
  const pricing = readCustomPricing()[model];
  if (!pricing) return 0;
  const cost = (promptTokens / 1_000_000) * pricing.prompt + (completionTokens / 1_000_000) * pricing.completion;
  return Number(cost.toFixed(6));
};

/**
 * 计算 P95（升序序列取 95 分位，向下取整索引）
 * @param {number[]} values - 数值序列（会被排序）
 * @returns {number} P95 值；空数组返回 0
 */
const percentile95 = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return Math.round(sorted[idx]);
};

/**
 * 生成本地日期字符串（YYYY-MM-DD）
 * @param {number} ts - 时间戳（ms）
 * @returns {string} 日期字符串
 */
const toDateKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 把 Trace 列表聚合为看板所需的统计结果
 * @param {AgentRunTrace[]} traces - Trace 列表
 * @returns {TraceSummary} 聚合结果（含按天/按模型/按工具三个维度）
 */
export const summarizeTraces = (traces: AgentRunTrace[]): TraceSummary => {
  const dayMap = new Map<string, TraceDayBucket>();
  const modelMap = new Map<string, { runs: number; total_tokens: number; cost_cny: number; durations: number[] }>();
  const toolMap = new Map<string, { calls: number; failures: number; total_ms: number }>();
  const durations: number[] = [];

  let promptTokens = 0;
  let completionTokens = 0;
  let costCny = 0;
  let toolCalls = 0;
  let toolFailures = 0;

  for (const trace of traces) {
    promptTokens += trace.prompt_tokens;
    completionTokens += trace.completion_tokens;
    costCny += trace.cost_cny;
    toolCalls += trace.tool_calls;
    toolFailures += trace.tool_failures;
    durations.push(trace.duration_ms);

    // 按天
    const date = toDateKey(trace.started_at);
    const day = dayMap.get(date) ?? { date, runs: 0, total_tokens: 0, cost_cny: 0 };
    day.runs += 1;
    day.total_tokens += trace.total_tokens;
    day.cost_cny = Number((day.cost_cny + trace.cost_cny).toFixed(6));
    dayMap.set(date, day);

    // 按模型（历史数据可能缺 model，归入 unknown 桶，避免看板出现空行）
    const modelKey = trace.model || 'unknown';
    const model = modelMap.get(modelKey)
      ?? { runs: 0, total_tokens: 0, cost_cny: 0, durations: [] };
    model.runs += 1;
    model.total_tokens += trace.total_tokens;
    model.cost_cny = Number((model.cost_cny + trace.cost_cny).toFixed(6));
    model.durations.push(trace.duration_ms);
    modelMap.set(modelKey, model);

    // 按工具（同理：name 缺失归入 unknown，而不是渲染出一行空白）
    for (const step of trace.steps ?? []) {
      for (const call of step.tool_calls ?? []) {
        const toolKey = call.name || 'unknown';
        const tool = toolMap.get(toolKey) ?? { calls: 0, failures: 0, total_ms: 0 };
        tool.calls += 1;
        tool.failures += call.ok ? 0 : 1;
        tool.total_ms += call.duration_ms;
        toolMap.set(toolKey, tool);
      }
    }
  }

  const byDay: TraceDayBucket[] = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const byModel: TraceModelBucket[] = Array.from(modelMap.entries())
    .map(([model, v]): TraceModelBucket => ({
      model,
      runs: v.runs,
      total_tokens: v.total_tokens,
      cost_cny: v.cost_cny,
      avg_duration_ms: v.durations.length ? Math.round(v.durations.reduce((a, b) => a + b, 0) / v.durations.length) : 0,
    }))
    .sort((a, b) => b.total_tokens - a.total_tokens);
  const byTool: TraceToolBucket[] = Array.from(toolMap.entries())
    .map(([name, v]): TraceToolBucket => ({
      name,
      calls: v.calls,
      failures: v.failures,
      avg_duration_ms: v.calls ? Math.round(v.total_ms / v.calls) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);

  return {
    runs: traces.length,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    cost_cny: Number(costCny.toFixed(6)),
    avg_duration_ms: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    p95_duration_ms: percentile95(durations),
    tool_calls: toolCalls,
    tool_failure_rate: toolCalls ? Number((toolFailures / toolCalls).toFixed(4)) : 0,
    by_day: byDay,
    by_model: byModel,
    by_tool: byTool,
  };
};
