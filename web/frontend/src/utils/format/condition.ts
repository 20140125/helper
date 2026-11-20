import { getWeekdayOptions, getLunarMonthOptions, getLunarDayOptions } from '@/constants/rules';

// English month names for formatCondition
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** 解析 "M-D" 字符串为 {month, day}，解析失败返回 null */
const parseMonthDay = (condition: string): { month: number; day: number } | null => {
  const m = condition.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return { month: parseInt(m[1], 10), day: parseInt(m[2], 10) };
};

/** weekday：星期下拉值 → 展示 label */
const formatWeekdayCondition = (condition: string): string => {
  const opt = getWeekdayOptions().find((o) => o.value === condition);
  return opt ? opt.label : condition;
};

/** date："M-D" → "3月15日" / "March 15" */
const formatDateCondition = (condition: string, isEn: boolean): string => {
  const md = parseMonthDay(condition);
  if (!md) return condition;
  if (isEn) return `${EN_MONTHS[md.month - 1] ?? md.month} ${md.day}`;
  return `${md.month}月${md.day}日`;
};

/** lunar_date：农历 "M-D" → "农历三月十五" / "Lunar March 15th" */
const formatLunarDateCondition = (condition: string, isEn: boolean): string => {
  const md = parseMonthDay(condition);
  if (!md) return condition;
  const monthOpt = getLunarMonthOptions().find((o) => parseInt(o.value, 10) === md.month);
  const dayOpt = getLunarDayOptions().find((o) => parseInt(o.value, 10) === md.day);
  if (isEn) {
    return `Lunar ${monthOpt?.label ?? `Month ${md.month}`} ${dayOpt?.label ?? `${md.day}th`}`;
  }
  return `农历 ${monthOpt?.label ?? `${md.month}月`}${dayOpt?.label ?? `${md.day}日`}`;
};

/** countdown："YYYY-MM-DD:N" → "YYYY-MM-DD前N天" / "N days before YYYY-MM-DD" */
const formatCountdownCondition = (condition: string, isEn: boolean): string => {
  const m = condition.match(/^(\d{4}-\d{2}-\d{2}):(\d+)$/);
  if (!m) return condition;
  if (isEn) return `${m[2]} day${m[2] === '1' ? '' : 's'} before ${m[1]}`;
  return `${m[1]}前${m[2]}天`;
};

/** 条件格式化处理器映射表（dispatcher） */
type ConditionFormatter = (condition: string, isEn: boolean) => string;
const CONDITION_FORMATTERS: Record<string, ConditionFormatter> = {
  weekday: (condition) => formatWeekdayCondition(condition),
  date: formatDateCondition,
  lunar_date: formatLunarDateCondition,
  countdown: formatCountdownCondition,
  monthly: (condition, isEn) => (isEn ? `Day ${condition} of every month` : `每月 ${condition} 日`),
  daily: (_condition, isEn) => (isEn ? 'Every day' : '每天'),
  workday: (_condition, isEn) => (isEn ? 'Weekdays' : '工作日'),
};

/**
 * 将规则 condition 原始值转译为可读文字
 * @param {string} type - 规则类型（date / weekday / lunar_date / countdown / monthly / daily / workday）
 * @param {string} condition - 规则条件原始值
 * @param {string} [lang] - 语言代码（'zh' | 'en'），默认中文
 * @returns {string} 格式化后的可读文字
 */
export const formatCondition = (type: string, condition: string, lang?: string): string => {
  if (!condition) return condition;
  const formatter = CONDITION_FORMATTERS[type];
  return formatter ? formatter(condition, lang === 'en') : condition;
};
