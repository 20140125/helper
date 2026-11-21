import {
  SIDE_EFFECT_TOOLS,
  type AgentRunTrace,
  type ChatMessage,
  type ToolContext,
  type ToolImpl,
} from '@/types/ai-chat';
import { getAvailableTools } from './tools';
import { buildSystemPrompt } from './system-prompt';
import { runAgentLoop } from './agent-loop';
import { appendRunTrace } from './trace-store';
import { listSkillMetas } from './skill-docs';
import { notifyAllWebhooks } from '@/utils/wecom-notify';

/**
 * 定时巡检任务
 * @description 「主动式 Agent」的核心：不需要用户提问，由调度器定时拉起一次只读巡检，
 *   让 Agent 自己调工具收集系统事实、产出简报，并（可选）推送到企业微信群。
 *   与会话链路的区别：不写会话、不带 web_search、只保留只读工具。
 */

/** 巡检输入 */
export interface InspectionInput {
  /** 以哪个用户的身份执行（决定可用工具与数据可见范围） */
  userEmail: string;
  /** 该用户的权限码列表 */
  userPermissions: string[];
  /** 是否把简报推送到企微群（默认 false） */
  push?: boolean;
  /** 指定模型（不传走默认） */
  model?: string;
  /** 额外关注点（追加到巡检指令末尾，用于临时定向排查） */
  focus?: string;
}

/** 巡检结果 */
export interface InspectionResult {
  /** 是否成功产出简报 */
  ok: boolean;
  /** 简报正文（Markdown） */
  report: string;
  /** 失败原因（成功时为空串） */
  error: string;
  /** 本次运行的 Trace ID */
  run_id: string;
  /** 端到端耗时（ms） */
  duration_ms: number;
  /** 消耗 token 总数 */
  total_tokens: number;
  /** 工具调用次数 */
  tool_calls: number;
  /** 是否已推送到企微群 */
  pushed: boolean;
}

/**
 * 生成「当前时间」文案（Asia/Shanghai）
 * @param {Date} now - 当前时刻
 * @returns {string} 形如「2026-10-22 星期四 10:18」
 * @description 巡检是无人值守任务，模型不知道「今天」是几号：不给锚点它会凭训练数据编一个日期
 *   （实测出现过把今天写成 2025-06-20 的简报），所以指令里必须带上真实时间。
 */
const formatNowText = (now: Date): string => {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    weekday: 'long',
  }).formatToParts(now);
  const pick = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('weekday')} ${pick('hour')}:${pick('minute')}`;
};

/**
 * 构造巡检指令
 * @param {string} [focus] - 额外关注点
 * @returns {string} 巡检指令正文
 * @description 检查清单写死在指令里，让 Agent 每次都按同一套口径巡检，
 *   避免「今天查这个明天查那个」导致简报不可比。
 *   开头注入当前时间：日期是简报的基准，必须由系统给出而不是模型推断。
 */
export const buildInspectionPrompt = (focus?: string): string => {
  const base = [
    '现在执行一次【系统健康巡检】（定时自动触发，不是用户提问）。',
    `当前时间：${formatNowText(new Date())}（Asia/Shanghai）。简报里凡涉及「今天/明天/昨天」一律以它为准。`,
    '请按需调用只读工具收集真实数据，产出一份运维简报。',
    '',
    '## 检查清单',
    '1. 守护进程与 Web 服务是否在运行（query_service_status / query_system_status）',
    '2. 最近日志里是否有 ERROR / WARN / 失败记录（query_logs）',
    '3. 自定义提醒规则是否启用、今天是否有规则该触发却没触发（query_rules）',
    '4. 今天/明天是否为节假日或调休工作日（必须调用 query_workday：不传 date 即从今天开始；禁止凭模型知识推断日期与星期）',
    '',
    '## 输出要求',
    '- Markdown，结论先行，全文不超过 400 字',
    '- 无异常：一句话说明「一切正常」即可，不要凑字数',
    '- 有异常：按严重程度列出，每条给出具体处理建议（可执行的操作）',
    '- 只陈述工具返回的事实，禁止编造数据（含日期、星期、PID、数值）',
    '- 直接给出简报正文，不要写「我来执行一次巡检」这类开场白与过程说明',
  ].join('\n');
  return focus?.trim() ? `${base}\n\n## 本次额外关注\n${focus.trim()}` : base;
};

/**
 * 执行一次巡检
 * @param {InspectionInput} input - 巡检输入
 * @returns {Promise<InspectionResult>} 巡检结果
 * @description 只保留只读工具：巡检是无人值守的自动任务，绝不能让它顺手发消息或跑脚本。
 *   推送走本函数末尾的显式步骤（由 push 参数控制），不交给 LLM 决定。
 */
export const runInspection = async (input: InspectionInput): Promise<InspectionResult> => {
  const context: ToolContext = {
    userEmail: input.userEmail,
    userPermissions: input.userPermissions,
  };
  // 巡检只保留只读工具：副作用工具（发消息/跑脚本/启停服务）一律剔除
  const tools: ToolImpl[] = getAvailableTools(input.userPermissions)
    .filter((t) => !SIDE_EFFECT_TOOLS.includes(t.name))
    .filter((t) => t.name !== 'web_search');

  const messages: ChatMessage[] = [
    // 巡检无人值守，只注入只读类技能说明书
    {
      role: 'system',
      content: buildSystemPrompt(
        true,
        tools.map((t) => t.name),
        undefined,
        listSkillMetas(input.userPermissions, 'read'),
      ),
    },
    { role: 'user', content: buildInspectionPrompt(input.focus) },
  ];

  let report = '';
  let trace: AgentRunTrace | null = null;

  try {
    for await (const ev of runAgentLoop({
      messages,
      context: { ...context, allowedSkillEffects: ['read'] },
      tools,
      enableTools: true,
      enablePlanning: true,
      model: input.model,
      conversationId: `inspect_${new Date().toISOString().slice(0, 10)}`,
    })) {
      if (ev.type === 'content_delta') report += ev.delta;
      // 反思重跑会重写整份简报：收到 reset 就丢弃上一轮，避免最终正文重复两遍
      if (ev.type === 'content_reset') report = '';
      if (ev.type === 'error') report += `\n\n> 巡检过程中出错：${ev.message}`;
      if (ev.type === 'run_trace') trace = ev.trace;
    }
  } catch (err) {
    return {
      ok: false,
      report: '',
      error: (err as Error).message,
      run_id: '',
      duration_ms: 0,
      total_tokens: 0,
      tool_calls: 0,
      pushed: false,
    };
  }

  if (trace) appendRunTrace(trace);

  let pushed = false;
  if (input.push && report.trim()) {
    try {
      pushed = await notifyAllWebhooks(`## 🤖 贾维斯定时巡检\n\n${report.trim()}`);
    } catch (err) {
      console.warn(`[ai-inspect] 推送失败：${(err as Error).message}`);
    }
  }

  return {
    ok: report.trim().length > 0,
    report: report.trim(),
    error: '',
    run_id: trace?.run_id ?? '',
    duration_ms: trace?.duration_ms ?? 0,
    total_tokens: trace?.total_tokens ?? 0,
    tool_calls: trace?.tool_calls ?? 0,
    pushed,
  };
};
