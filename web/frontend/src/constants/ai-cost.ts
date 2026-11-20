import type { AiCostSummary } from '@/types/ai-cost';

/** 可选统计天数（后端按 1~90 夹紧） */
export const AI_COST_DAYS_OPTIONS: { label: string; value: number }[] = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
];

/** 统计范围选项值 */
export const AI_COST_SCOPE_ME = 'me';
export const AI_COST_SCOPE_ALL = 'all';

/** 拥有任一权限即可查看全量统计（与后端 ADMIN_LIKE_PERMISSIONS 保持一致） */
export const AI_COST_ADMIN_PERMISSIONS: string[] = ['rbac:view', 'rbac:edit'];

/** 手动巡检后轮询状态的间隔（ms）：巡检是后台异步跑的，前端靠轮询取结果 */
export const AI_INSPECTION_POLL_INTERVAL_MS = 2000;

/** 轮询最大轮次：150 轮 × 2s ≈ 5 分钟，超时就不再等（结果仍可在状态行查看） */
export const AI_INSPECTION_POLL_MAX_ROUNDS = 150;

/** 空汇总：首屏与加载失败时的兜底，避免模板里到处判空 */
export const EMPTY_AI_COST_SUMMARY: AiCostSummary = {
  runs: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  cost_cny: 0,
  avg_duration_ms: 0,
  p95_duration_ms: 0,
  tool_calls: 0,
  tool_failure_rate: 0,
  by_day: [],
  by_model: [],
  by_tool: [],
};
