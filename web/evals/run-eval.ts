/**
 * AI Agent 单轮评测脚本
 *
 * @description 用真实 LLM 跑 `evals/cases.json` 里的样本，只断言「工具选择 + 参数 + consent」，
 *   **不执行任何工具**（尤其不执行副作用工具），所以可以在本地反复跑而不会动到生产状态。
 *
 *   这是 09-10《评测与测试》里「单轮评测集」这一层的落地实现：
 *   改了 system-prompt / 工具 description / 模型之后跑一次，和 baseline.json 对比，
 *   工具选择准确率、拒答正确率、平均 token 三个数一起看，退化就回滚。
 *
 * 用法（在 web/ 目录下）：
 *   npm run eval                        # 跑全量样本
 *   npm run eval -- --category=read     # 只跑某一类（chat/read/sideeffect/safety/multi/unknown）
 *   npm run eval -- --id=read-01        # 只跑某一条
 *   npm run eval -- --limit=10          # 只跑前 N 条
 *   npm run eval -- --model=glm-4-flash-250414
 *   npm run eval -- --verbose           # 打印模型原始回复，便于人工看 bad case
 *   npm run eval -- --update-baseline   # 跑完把结果写进 baseline.json / baseline.md
 *   npm run eval -- --delay=0           # 关闭样本间隔（限流宽松时用，跑得更快）
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 环境变量必须在业务模块 import 之前加载（与 server.ts 保持一致的加载顺序）
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });

import { chatCompletion, buildToolDefinitions, getAvailableTools, buildSystemPrompt, validateLlmConfig } from '@/utils/ai-chat';
import { checkConsent } from '@/utils/ai-chat/tools/_consent-guard';
import { Permission } from '@/types/permission';
import type { ChatMessage, ToolDefinition, ToolImpl } from '@/types/ai-chat';

// ──────────────────────────
// 常量
// ──────────────────────────

/** 副作用工具的标志参数：参数 schema 里带它，就说明这个调用会改变系统状态 */
const CONSENT_ARG = 'user_consent_phrase';

/** 样本之间的默认间隔（毫秒）：免费模型限流较激进，串行 + 间隔最稳 */
const DEFAULT_CASE_DELAY_MS = 300;

/** 样本集路径 */
const CASES_FILE = path.resolve(__dirname, 'cases.json');
/** 结果输出目录 */
const RESULTS_DIR = path.resolve(__dirname, 'results');
/** 基线（机器可读，用于对比） */
const BASELINE_JSON = path.resolve(__dirname, 'baseline.json');
/** 基线（人读，用于提交进仓库看趋势） */
const BASELINE_MD = path.resolve(__dirname, 'baseline.md');

// ──────────────────────────
// 类型
// ──────────────────────────

/** 参数断言支持的操作符（避免写死具体数值导致样本易碎） */
interface ArgOperators {
  /** 大于等于 */
  $gte?: number;
  /** 小于等于 */
  $lte?: number;
  /** 字符串包含 */
  $contains?: string;
}

/** 单条评测样本 */
interface EvalCase {
  /** 样本 ID（唯一，便于 --id 单跑与 bad case 引用） */
  id: string;
  /** 分类：chat / read / sideeffect / safety / multi / unknown */
  category: string;
  /** 用户输入（模拟真实口语，不要写成工具名） */
  input: string;
  /** 期望调用的工具名集合（必须全部出现，不校验顺序） */
  expect_tools?: string[];
  /** 禁止调用的工具名集合，`["*"]` 表示禁止任何工具 */
  forbid_tools?: string[];
  /** 是否期望触发副作用工具并携带合法 consent */
  expect_consent?: boolean;
  /** 参数断言：{ 工具名: { 参数名: 期望值 | 操作符 } } */
  expect_args?: Record<string, Record<string, unknown>>;
  /** 这条样本为什么存在（bad case 来源 / 设计意图） */
  note?: string;
}

/** 一次样本运行的结果 */
interface CaseResult {
  /** 样本 ID */
  id: string;
  /** 分类 */
  category: string;
  /** 用户输入 */
  input: string;
  /** 是否通过 */
  passed: boolean;
  /** 失败原因列表 */
  failures: string[];
  /** 模型实际调用的工具名 */
  called_tools: string[];
  /** 模型原始文本回复（verbose 时打印，落盘时截断） */
  content: string;
  /** 耗时（毫秒） */
  latency_ms: number;
  /** 本次消耗的总 token */
  total_tokens: number;
  /**
   * 是否为「基础设施失败」而非断言失败
   * @description LLM 限流 / 网络异常时没有拿到模型决策，此时根本没发生过「工具选择」，
   *   把它算进准确率会让一次 429 看起来像模型能力退化——必须单独计数
   */
  errored: boolean;
}

/** 一次评测运行的汇总报表 */
interface RunReport {
  /** 运行时间戳（ISO） */
  generated_at: string;
  /** 使用的模型 ID */
  model: string;
  /** 样本总数 */
  case_count: number;
  /** 通过数 */
  passed: number;
  /** 基础设施失败数（限流 / 网络异常，未拿到模型决策） */
  error_count: number;
  /** 总通过率（0~1，分母已剔除基础设施失败） */
  pass_rate: number;
  /** 工具选择准确率：有 expect_tools 的样本中全部命中的比例 */
  tool_selection_accuracy: number;
  /** 拒答正确率：有 forbid_tools 的样本中未越界的比例 */
  refusal_accuracy: number;
  /** consent 正确率：涉及副作用调用的样本中 consent 合法的比例 */
  consent_accuracy: number;
  /** 平均耗时（毫秒） */
  avg_latency_ms: number;
  /** 总 token */
  total_tokens: number;
  /** 分类维度统计 */
  by_category: Record<string, { count: number; passed: number }>;
}

/** 命令行选项 */
interface EvalOptions {
  /** 指定模型 ID，不传则用后端默认 */
  model?: string;
  /** 只跑该分类 */
  category?: string;
  /** 只跑该样本 ID */
  id?: string;
  /** 只跑前 N 条 */
  limit?: number;
  /** 打印模型原始回复 */
  verbose: boolean;
  /** 跑完更新基线文件 */
  updateBaseline: boolean;
  /** 样本间隔（毫秒） */
  delayMs: number;
}

// ──────────────────────────
// 命令行参数
// ──────────────────────────

/**
 * 解析命令行参数
 * @param {string[]} argv - process.argv 切片（不含 node 与脚本路径）
 * @returns {EvalOptions} 解析后的选项
 * @description 支持 `--k=v` 形式与 `--verbose` / `--update-baseline` 这类开关；
 *   未知参数直接忽略，避免手滑打错时脚本静默跑出意外结果（会在控制台提示）
 */
const parseArgs = (argv: string[]): EvalOptions => {
  const options: EvalOptions = { verbose: false, updateBaseline: false, delayMs: DEFAULT_CASE_DELAY_MS };
  const get = (key: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${key}=`));
    return hit ? hit.slice(key.length + 3) : undefined;
  };
  options.model = get('model');
  options.category = get('category');
  options.id = get('id');
  const limit = get('limit');
  if (limit) options.limit = Number(limit);
  const delay = get('delay');
  if (delay !== undefined) options.delayMs = Number(delay);
  options.verbose = argv.includes('--verbose');
  options.updateBaseline = argv.includes('--update-baseline');
  return options;
};

// ──────────────────────────
// 样本加载
// ──────────────────────────

/**
 * 读取并校验样本集
 * @param {string} file - cases.json 绝对路径
 * @returns {EvalCase[]} 样本列表
 * @throws 文件缺失或不是数组时抛错
 */
const loadCases = (file: string): EvalCase[] => {
  if (!fs.existsSync(file)) {
    throw new Error(`样本集不存在：${file}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error('cases.json 顶层必须是数组');
  }
  const cases = raw as EvalCase[];
  const ids = new Set<string>();
  cases.forEach((c) => {
    if (!c.id || !c.input) throw new Error(`样本缺少 id 或 input：${JSON.stringify(c).slice(0, 80)}`);
    if (ids.has(c.id)) throw new Error(`样本 id 重复：${c.id}`);
    ids.add(c.id);
  });
  return cases;
};

// ──────────────────────────
// 工具准备
// ──────────────────────────

/**
 * 判断工具是否为副作用工具
 * @param {ToolImpl} tool - 工具实现
 * @returns {boolean} 参数 schema 含 user_consent_phrase 时返回 true
 * @description 用「参数里有没有 consent 短语」来判定，而不是维护一份工具名名单：
 *   新增副作用工具只要遵循命名约定就自动被识别，评测不需要跟着改
 */
const isSideEffectTool = (tool: ToolImpl): boolean => {
  const props = (tool.parameters?.properties ?? {}) as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(props, CONSENT_ARG);
};

/**
 * 构建评测用的工具列表
 * @returns {{ tools: ToolImpl[]; definitions: ToolDefinition[] }} 工具实现与协议定义
 * @description 按「全权限用户 + 未开启联网搜索」的默认场景组装：
 *   与线上 /send 在 enable_web_search=false 时的工具集合保持一致，评测才有意义
 */
const prepareTools = (): { tools: ToolImpl[]; definitions: ToolDefinition[] } => {
  const allPermissions = Object.values(Permission) as string[];
  const tools = getAvailableTools(allPermissions).filter((t) => t.name !== 'web_search');
  return { tools, definitions: buildToolDefinitions(tools) };
};

// ──────────────────────────
// 断言
// ──────────────────────────

/**
 * 校验单个实参是否满足期望
 * @param {unknown} actual - 模型实际传入的参数值
 * @param {unknown} expected - 期望值：字符串按「包含」匹配，数字/布尔严格相等，对象走操作符
 * @returns {boolean} 满足返回 true
 * @description 字符串用包含而不是相等，是因为 LLM 常写 `birthday_reminder.sh` 而期望只写 `birthday`；
 *   数值用操作符（$gte/$lte）而不是定值，是因为「这周」到底传 5 还是 7 本就允许有自由度
 */
/**
 * 大小写不敏感的包含判断
 * @param {unknown} actual - 实际值
 * @param {string} expected - 期望子串
 * @returns {boolean} 命中返回 true
 * @description LLM 写 `email` 还是 `EMAIL` 纯看心情，而配置键本身是大写；
 *   断言关心的是「查对了那一类」，不是大小写，故统一忽略。
 */
const includesIgnoreCase = (actual: unknown, expected: string): boolean => {
  const a = String(actual ?? '');
  return a.includes(expected) || a.toLowerCase().includes(expected.toLowerCase());
};

const matchValue = (actual: unknown, expected: unknown): boolean => {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    const ops = expected as ArgOperators;
    if (typeof ops.$gte === 'number' && !(Number(actual) >= ops.$gte)) return false;
    if (typeof ops.$lte === 'number' && !(Number(actual) <= ops.$lte)) return false;
    if (typeof ops.$contains === 'string' && !includesIgnoreCase(actual, ops.$contains)) return false;
    return ops.$gte !== undefined || ops.$lte !== undefined || ops.$contains !== undefined;
  }
  if (typeof expected === 'string') return includesIgnoreCase(actual, expected);
  return actual === expected;
};

/**
 * 解析工具调用参数
 * @param {string} raw - 模型返回的 arguments JSON 字符串
 * @returns {{ ok: true; args: Record<string, unknown> } | { ok: false; error: string }} 解析结果
 * @description 流式场景下 arguments 是碎片拼接出来的，非法 JSON 是真实存在的失败模式，
 *   这里如实记为断言失败，而不是静默吞掉
 */
const parseArgsJson = (raw: string): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } => {
  try {
    const parsed = JSON.parse(raw || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: '参数不是对象' };
    return { ok: true, args: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: `参数不是合法 JSON：${String(raw).slice(0, 60)}` };
  }
};

/**
 * 对单条样本执行全部断言
 * @param {EvalCase} item - 样本
 * @param {Array<{ name: string; args: Record<string, unknown>; parseError?: string }>} calls - 模型实际发起的工具调用
 * @param {Set<string>} sideEffectNames - 副作用工具名集合
 * @returns {string[]} 失败原因列表（空数组表示通过）
 * @description 四类断言：禁止工具 / 期望工具 / 参数 / consent。
 *   其中 consent 是**全局不变量**：只要调用了副作用工具，就必须带合法 consent，
 *   不需要每条样本都写一遍，避免漏写导致防线被悄悄绕过
 */
const assertCase = (
  item: EvalCase,
  calls: Array<{ name: string; args: Record<string, unknown>; parseError?: string }>,
  sideEffectNames: Set<string>,
): string[] => {
  const failures: string[] = [];
  const push = (msg: string): void => {
    if (!failures.includes(msg)) failures.push(msg);
  };
  const called = calls.map((c) => c.name);

  // 1) 禁止调用的工具
  const forbid = item.forbid_tools ?? [];
  if (forbid.includes('*')) {
    if (called.length > 0) push(`禁止调用任何工具，实际调用了 ${called.join(', ')}`);
  } else {
    forbid.filter((t) => called.includes(t)).forEach((t) => push(`调用了禁止的工具 ${t}`));
  }

  // 2) 期望调用的工具
  (item.expect_tools ?? []).forEach((t) => {
    if (!called.includes(t)) push(`未调用预期工具 ${t}（实际：${called.join(', ') || '无'}）`);
  });

  // 3) 参数断言
  Object.entries(item.expect_args ?? {}).forEach(([toolName, expects]) => {
    const target = calls.find((c) => c.name === toolName);
    if (!target) return;
    if (target.parseError) {
      push(`${toolName} ${target.parseError}`);
      return;
    }
    Object.entries(expects).forEach(([key, expected]) => {
      if (!matchValue(target.args[key], expected)) {
        push(`${toolName} 参数 ${key} 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(target.args[key])}`);
      }
    });
  });

  // 4) consent 全局不变量
  const sideCalls = calls.filter((c) => sideEffectNames.has(c.name));
  sideCalls.forEach((c) => {
    if (c.parseError) {
      push(`${c.name} ${c.parseError}`);
      return;
    }
    const phrase = typeof c.args[CONSENT_ARG] === 'string' ? c.args[CONSENT_ARG] as string : '';
    const verdict = checkConsent(phrase, 'exec');
    if (!verdict.ok) push(`${c.name} ${verdict.reason}`);
  });
  if (item.expect_consent && sideCalls.length === 0) {
    push('期望触发副作用工具并携带 consent，实际未调用任何副作用工具');
  }

  return failures;
};

// ──────────────────────────
// 执行
// ──────────────────────────

/**
 * 跑一条样本：只取模型的工具调用决策，不执行工具
 * @param {EvalCase} item - 样本
 * @param {ToolDefinition[]} definitions - 工具协议定义
 * @param {Set<string>} sideEffectNames - 副作用工具名集合
 * @param {string} systemPrompt - 系统提示词
 * @param {string | undefined} model - 模型 ID
 * @returns {Promise<CaseResult>} 该样本的执行结果
 */
const runCase = async (
  item: EvalCase,
  definitions: ToolDefinition[],
  sideEffectNames: Set<string>,
  systemPrompt: string,
  model: string | undefined,
): Promise<CaseResult> => {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: item.input },
  ];
  const started = Date.now();
  let content = '';
  let toolCalls: NonNullable<ChatMessage['tool_calls']> = [];
  let totalTokens = 0;
  let failure: string | undefined;

  try {
    const resp = await chatCompletion(messages, definitions, model);
    content = resp.content ?? '';
    toolCalls = resp.tool_calls ?? [];
    totalTokens = resp.usage?.total_tokens ?? 0;
  } catch (err) {
    failure = `LLM 调用失败：${(err as Error).message.slice(0, 120)}`;
  }

  const calls = toolCalls.map((tc) => {
    const parsed = parseArgsJson(tc.function?.arguments ?? '');
    return parsed.ok
      ? { name: tc.function?.name ?? '', args: parsed.args }
      : { name: tc.function?.name ?? '', args: {}, parseError: parsed.error };
  });
  const failures = failure ? [failure] : assertCase(item, calls, sideEffectNames);

  return {
    id: item.id,
    category: item.category,
    input: item.input,
    passed: failures.length === 0,
    failures,
    called_tools: calls.map((c) => c.name),
    content: content.slice(0, 200),
    latency_ms: Date.now() - started,
    total_tokens: totalTokens,
    errored: failure !== undefined,
  };
};

// ──────────────────────────
// 报表
// ──────────────────────────

/**
 * 由样本结果汇总出报表
 * @param {CaseResult[]} results - 全部样本结果
 * @param {EvalCase[]} cases - 全部样本（用于取期望，统计各维度准确率）
 * @param {string} model - 实际使用的模型 ID
 * @returns {RunReport} 汇总报表
 */
const buildReport = (results: CaseResult[], cases: EvalCase[], model: string): RunReport => {
  const byId = new Map(cases.map((c) => [c.id, c]));
  // 准确率只统计「真的拿到模型决策」的样本：429 / 网络异常没有决策可言，不能算模型答错
  const effective = results.filter((r) => !r.errored);
  const passed = effective.filter((r) => r.passed).length;

  const withExpect = effective.filter((r) => (byId.get(r.id)?.expect_tools ?? []).length > 0);
  const withForbid = effective.filter((r) => (byId.get(r.id)?.forbid_tools ?? []).length > 0);
  const withConsent = effective.filter((r) => byId.get(r.id)?.expect_consent === true);

  const rate = (hit: number, total: number): number => (total === 0 ? 1 : hit / total);
  const byCategory: RunReport['by_category'] = {};
  results.forEach((r) => {
    const bucket = byCategory[r.category] ?? { count: 0, passed: 0 };
    bucket.count += 1;
    if (r.passed) bucket.passed += 1;
    byCategory[r.category] = bucket;
  });

  return {
    generated_at: new Date().toISOString(),
    model,
    case_count: results.length,
    passed,
    error_count: results.length - effective.length,
    pass_rate: rate(passed, effective.length),
    tool_selection_accuracy: rate(
      withExpect.filter((r) => r.failures.every((f) => !f.startsWith('未调用预期工具'))).length,
      withExpect.length,
    ),
    refusal_accuracy: rate(
      withForbid.filter((r) => r.failures.every((f) => !f.startsWith('调用了禁止的工具') && !f.startsWith('禁止调用任何工具'))).length,
      withForbid.length,
    ),
    consent_accuracy: rate(withConsent.filter((r) => r.passed).length, withConsent.length),
    avg_latency_ms: results.length === 0 ? 0 : Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / results.length),
    total_tokens: results.reduce((s, r) => s + r.total_tokens, 0),
    by_category: byCategory,
  };
};

/**
 * 百分比格式化（保留一位小数）
 * @param {number} ratio - 0~1 的比例
 * @returns {string} 形如 `91.7%` 的字符串
 */
const pct = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`;

/**
 * 打印报表到控制台
 * @param {RunReport} report - 汇总报表
 * @param {CaseResult[]} results - 样本结果（打印失败明细）
 * @param {EvalOptions} options - 命令行选项
 * @returns {void}
 */
const printReport = (report: RunReport, results: CaseResult[], options: EvalOptions): void => {
  console.log('\n══════════ AI Agent 单轮评测报告 ══════════');
  console.log(`模型        ${report.model}`);
  console.log(`样本        ${report.passed}/${report.case_count - report.error_count}  通过率 ${pct(report.pass_rate)}`);
  if (report.error_count > 0) {
    console.log(`限流/异常    ${report.error_count} 条未拿到模型决策（不计入准确率，建议加大 --delay 或稍后重跑）`);
  }
  console.log(`工具选择    ${pct(report.tool_selection_accuracy)}`);
  console.log(`拒答正确    ${pct(report.refusal_accuracy)}`);
  console.log(`consent     ${pct(report.consent_accuracy)}`);
  console.log(`平均耗时    ${report.avg_latency_ms}ms`);
  console.log(`总 token    ${report.total_tokens}`);

  console.log('\n── 分类维度 ──');
  console.log('分类          样本   通过   通过率');
  Object.entries(report.by_category)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, stat]) => {
      console.log(
        `${name.padEnd(14)}${String(stat.count).padEnd(7)}${String(stat.passed).padEnd(7)}${pct(stat.count === 0 ? 1 : stat.passed / stat.count)}`,
      );
    });

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log('\n── 失败明细 ──');
    failed.forEach((r) => {
      console.log(`✗ [${r.id}] ${r.input}`);
      console.log(`    实际调用：${r.called_tools.join(', ') || '无'}`);
      r.failures.forEach((f) => console.log(`    - ${f}`));
      if (options.verbose && r.content) console.log(`    模型回复：${r.content.slice(0, 120)}`);
    });
  }
  console.log('');
};

/**
 * 读取上一次的基线（若存在）
 * @returns {RunReport | null} 基线报表，不存在返回 null
 */
const readBaseline = (): RunReport | null => {
  if (!fs.existsSync(BASELINE_JSON)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_JSON, 'utf-8')) as RunReport;
  } catch {
    return null;
  }
};

/**
 * 与基线对比并打印变化
 * @param {RunReport} report - 本次报表
 * @param {RunReport | null} baseline - 基线报表
 * @returns {void}
 */
const printDiff = (report: RunReport, baseline: RunReport | null): void => {
  if (!baseline) {
    console.log('（无基线可对比，跑一次 `--update-baseline` 固化当前指标）');
    return;
  }
  const delta = (now: number, before: number): string => {
    const diff = (now - before) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}pp`;
  };
  console.log('\n── 对比基线 ──');
  console.log(`基线时间    ${baseline.generated_at}（模型 ${baseline.model}）`);
  console.log(`通过率      ${pct(report.pass_rate)}  ${delta(report.pass_rate, baseline.pass_rate)}`);
  console.log(`工具选择    ${pct(report.tool_selection_accuracy)}  ${delta(report.tool_selection_accuracy, baseline.tool_selection_accuracy)}`);
  console.log(`拒答正确    ${pct(report.refusal_accuracy)}  ${delta(report.refusal_accuracy, baseline.refusal_accuracy)}`);
  console.log(`平均耗时    ${report.avg_latency_ms}ms  ${report.avg_latency_ms - baseline.avg_latency_ms >= 0 ? '+' : ''}${report.avg_latency_ms - baseline.avg_latency_ms}ms`);
};

/**
 * 落盘：结果快照 +（可选）基线文件
 * @param {RunReport} report - 汇总报表
 * @param {CaseResult[]} results - 样本结果
 * @param {boolean} updateBaseline - 是否更新基线
 * @returns {void}
 */
const persist = (report: RunReport, results: CaseResult[], updateBaseline: boolean): void => {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = report.generated_at.replace(/[:.]/g, '-');
  fs.writeFileSync(
    path.join(RESULTS_DIR, `${stamp}.json`),
    `${JSON.stringify({ report, results }, null, 2)}\n`,
    'utf-8',
  );
  console.log(`结果已写入 evals/results/${stamp}.json`);

  if (!updateBaseline) return;
  fs.writeFileSync(BASELINE_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  const rows = Object.entries(report.by_category)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, stat]) => `| ${name} | ${stat.count} | ${stat.passed} | ${pct(stat.count === 0 ? 1 : stat.passed / stat.count)} |`)
    .join('\n');
  const md = [
    '# 评测基线',
    '',
    `> 由 \`npm run eval -- --update-baseline\` 自动生成，请勿手工编辑。`,
    `> 每次改 system-prompt / 工具 description / 模型后跑一次，与这份基线对比。`,
    '',
    `- 生成时间：${report.generated_at}`,
    `- 模型：${report.model}`,
    `- 样本数：${report.case_count}`,
    '',
    '| 指标 | 值 |',
    '|------|-----|',
    `| 总通过率 | ${pct(report.pass_rate)}（${report.passed}/${report.case_count - report.error_count}） |`,
    `| 限流/异常 | ${report.error_count} 条 |`,
    `| 工具选择准确率 | ${pct(report.tool_selection_accuracy)} |`,
    `| 拒答正确率 | ${pct(report.refusal_accuracy)} |`,
    `| consent 正确率 | ${pct(report.consent_accuracy)} |`,
    `| 平均耗时 | ${report.avg_latency_ms}ms |`,
    `| 总 token | ${report.total_tokens} |`,
    '',
    '## 分类维度',
    '',
    '| 分类 | 样本 | 通过 | 通过率 |',
    '|------|------|------|--------|',
    rows,
    '',
  ].join('\n');
  fs.writeFileSync(BASELINE_MD, md, 'utf-8');
  console.log('基线已更新：evals/baseline.json / evals/baseline.md');
};

// ──────────────────────────
// 主流程
// ──────────────────────────

/**
 * 评测主流程
 * @returns {Promise<void>}
 * @description 串行跑样本（免费模型限流激进，并发反而更慢且更容易 429），
 *   失败样本以退出码 1 结束，便于接进 CI 做卡口
 */
const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const configError = validateLlmConfig(options.model);
  if (configError) {
    console.error(`LLM 未配置：${configError}`);
    process.exit(1);
  }

  const allCases = loadCases(CASES_FILE);
  const selected = allCases
    .filter((c) => (options.category ? c.category === options.category : true))
    .filter((c) => (options.id ? c.id === options.id : true))
    .slice(0, options.limit ?? allCases.length);
  if (selected.length === 0) {
    console.error('没有匹配到任何样本，检查 --category / --id 取值');
    process.exit(1);
  }

  const { tools, definitions } = prepareTools();
  const sideEffectNames = new Set(tools.filter(isSideEffectTool).map((t) => t.name));
  const systemPrompt = buildSystemPrompt(true, tools.map((t) => t.name));
  const model = options.model ?? '默认（配置组首个模型）';

  console.log(`开始评测：${selected.length} 条样本，可用工具 ${tools.length} 个（副作用 ${sideEffectNames.size} 个）`);
  console.log(`注意：本脚本只断言工具选择，不会执行任何工具\n`);

  const results: CaseResult[] = [];
  for (const item of selected) {
    const result = await runCase(item, definitions, sideEffectNames, systemPrompt, options.model);
    results.push(result);
    process.stdout.write(`${result.passed ? '✓' : '✗'} ${result.id}  ${result.called_tools.join(', ') || '（无工具）'}\n`);
    if (options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  const report = buildReport(results, selected, model);
  printReport(report, results, options);
  printDiff(report, readBaseline());
  persist(report, results, options.updateBaseline);

  // 基础设施失败不算失败（否则免费模型一限流就把 CI 搞红），断言失败才退出 1
  const realFailures = report.case_count - report.error_count - report.passed;
  if (realFailures > 0) process.exit(1);
};

main().catch((err) => {
  console.error(`评测执行失败：${(err as Error).message}`);
  process.exit(1);
});
