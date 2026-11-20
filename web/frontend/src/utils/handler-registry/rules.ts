import type { HandlerRegistry } from '@/types/handler-registry';
import { RuleType } from '@/types/rule';
import {
  getRuleTypes,
  getConditionHint,
  getWeekdayOptions,
  getLunarMonthOptions,
  getLunarDayOptions,
  getMonthlyDayOptions,
} from '@/constants/rules';
import { useWebhooksStore } from '@/stores/webhooks';
import { getLocaleText, type FormData } from './shared';

/** 根据触发类型生成 visible 谓词 */
const visibleOfType = (type: RuleType) => (data: FormData) => data.type === type;

/** 同步 lunarDate 聚合字段（月 + 日） */
const syncLunarDate = (data: FormData) => {
  data.lunarDate = data.lunarMonth && data.lunarDay
    ? `${data.lunarMonth}-${data.lunarDay}`
    : '';
};

/** 切换类型时清空所有条件字段 */
const clearAllConditions = (_val: unknown, data: FormData) => {
  data.dateCondition = '';
  data.weekdayCondition = '';
  data.lunarMonth = '';
  data.lunarDay = '';
  data.countdownDate = '';
  data.countdownDays = '7';
  data.monthlyDay = '';
};

/** 触发类型下拉选项：带图标前缀 */
const buildTypeOptions = () =>
  getRuleTypes().map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }));

/** 通知群下拉选项：webhooks store 动态获取 */
const buildWebhookOptions = () => {
  const webhooksStore = useWebhooksStore();
  return () => (webhooksStore.webhooks?.length
    ? webhooksStore.webhooks.map((w: { id: string; name: string }) => ({ value: w.id, label: w.name }))
    : []);
};

/**
 * 倒计时提前天数下拉选项（0~7 天）
 * @description label 通过 locale 动态生成，切换语言时自动刷新；供 rule-form 的 countdownDays 复用。
 */
const buildCountdownDaysOptions = () => {
  const schema = getLocaleText().playground.schema as Record<string, string>;
  return [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({
    value: String(n),
    label: schema[`daysAhead${n}`] ?? `${n}`,
  }));
};

/**
 * 创建规则表单的 handler 注册表
 * @description 将规则表单的所有动态逻辑集中注册，供 rule-form-drawer 和 playground 等场景复用。
 *              注意：不在此处调用 fetchWebhooks()，webhook 数据由 rules-model mounted 时统一加载，
 *              避免 computed 中反复触发网络请求导致响应式死循环。
 * @returns HandlerRegistry 规则相关的 handler 注册表
 */
export const createRuleHandlers = (): HandlerRegistry => ({
  // ── 触发类型下拉选项 ──
  'rules.typeOptions': buildTypeOptions(),

  // ── 切换类型时清空所有条件字段 ──
  'rules.onTypeChange': clearAllConditions,

  // ── 各触发条件的提示文字 ──
  'rules.conditionHint.date': getConditionHint()[RuleType.Date],
  'rules.conditionHint.weekday': getConditionHint()[RuleType.Weekday],
  'rules.conditionHint.lunarDate': getConditionHint()[RuleType.LunarDate],
  'rules.conditionHint.countdown': getConditionHint()[RuleType.Countdown],
  'rules.conditionHint.monthly': getConditionHint()[RuleType.Monthly],

  // ── 各触发条件的 visible 函数 ──
  'rules.visibleDate': visibleOfType(RuleType.Date),
  'rules.visibleWeekday': visibleOfType(RuleType.Weekday),
  'rules.visibleLunarDate': visibleOfType(RuleType.LunarDate),
  'rules.visibleCountdown': visibleOfType(RuleType.Countdown),
  'rules.visibleMonthly': visibleOfType(RuleType.Monthly),
  'rules.visibleWorkday': visibleOfType(RuleType.Workday),

  // ── 静态选项 ──
  'rules.weekdayOptions': getWeekdayOptions(),
  'rules.lunarMonthOptions': getLunarMonthOptions(),
  'rules.lunarDayOptions': getLunarDayOptions(),
  'rules.monthlyDayOptions': getMonthlyDayOptions(),
  'rules.countdownDaysOptions': buildCountdownDaysOptions,

  // ── 农历月/日变更时同步聚合字段 ──
  'rules.onLunarMonthChange': (_val: unknown, data: FormData) => syncLunarDate(data),
  'rules.onLunarDayChange': (_val: unknown, data: FormData) => syncLunarDate(data),

  // ── 通知群选项（使用函数动态获取，确保 store 数据更新后选项同步刷新） ──
  'rules.webhookOptions': buildWebhookOptions(),
});
