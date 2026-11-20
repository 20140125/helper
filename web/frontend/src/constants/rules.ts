import { RuleType } from '@/types/rule';
import type { RuleTypeOption } from '@/types/rule';
import { useLocaleStore } from '@/stores/locale';

/** 标签主题色（与 t-tag 主题保持一致） */
type TagTheme = 'default' | 'primary' | 'warning' | 'danger' | 'success';

// ==============================
// 规则类型（locale-aware）
// ==============================

/** 获取规则类型选项（随语言变化） */
export function getRuleTypes(): RuleTypeOption[] {
  const r = useLocaleStore().t.rules;
  return [
    { value: RuleType.Date,      label: r.typeDate,      icon: RULE_TYPE_ICON[RuleType.Date],      desc: r.descDate },
    { value: RuleType.Weekday,   label: r.typeWeekday,   icon: RULE_TYPE_ICON[RuleType.Weekday],   desc: r.descWeekday },
    { value: RuleType.LunarDate, label: r.typeLunarDate, icon: RULE_TYPE_ICON[RuleType.LunarDate], desc: r.descLunarDate },
    { value: RuleType.Countdown, label: r.typeCountdown, icon: RULE_TYPE_ICON[RuleType.Countdown], desc: r.descCountdown },
    { value: RuleType.Monthly,   label: r.typeMonthly,   icon: RULE_TYPE_ICON[RuleType.Monthly],   desc: r.descMonthly },
    { value: RuleType.Daily,     label: r.typeDaily,     icon: RULE_TYPE_ICON[RuleType.Daily],     desc: r.descDaily },
    { value: RuleType.Workday,   label: r.typeWorkday,   icon: RULE_TYPE_ICON[RuleType.Workday],   desc: r.descWorkday },
  ];
}

/** 获取规则类型 label 映射表（随语言变化） */
export function getRuleTypeLabel(): Record<RuleType, string> {
  const r = useLocaleStore().t.rules;
  return {
    [RuleType.Date]:      r.typeDate,
    [RuleType.Weekday]:   r.typeWeekday,
    [RuleType.LunarDate]: r.typeLunarDate,
    [RuleType.Countdown]: r.typeCountdown,
    [RuleType.Monthly]:   r.typeMonthly,
    [RuleType.Daily]:     r.typeDaily,
    [RuleType.Workday]:   r.typeWorkday,
  };
}

// ==============================
// 规则类型视觉映射（纯 UI 常量，与语言无关）
// ==============================

/** 规则类型图标映射 */
export const RULE_TYPE_ICON: Record<RuleType, string> = {
  [RuleType.Date]:      '📅',
  [RuleType.Weekday]:   '📆',
  [RuleType.LunarDate]: '🌙',
  [RuleType.Countdown]: '⏳',
  [RuleType.Monthly]:   '🗓️',
  [RuleType.Daily]:     '⏰',
  [RuleType.Workday]:   '💼',
};

/** 规则类型主题色映射（用于 TDesign Tag 等组件展示） */
export const RULE_TYPE_THEME: Record<RuleType, TagTheme> = {
  [RuleType.Date]:      'primary',
  [RuleType.Weekday]:   'success',
  [RuleType.LunarDate]: 'warning',
  [RuleType.Countdown]: 'danger',
  [RuleType.Monthly]:   'primary',
  [RuleType.Daily]:     'success',
  [RuleType.Workday]:   'warning',
};

// ==============================
// 表单辅助数据（locale-aware）
// ==============================

/** 获取条件占位符（随语言变化） */
export function getConditionPlaceholder(): Record<RuleType, string> {
  const r = useLocaleStore().t.rules;
  return {
    [RuleType.Date]:      r.hintDate,
    [RuleType.Weekday]:   r.hintWeekday,
    [RuleType.LunarDate]: r.hintLunarDate,
    [RuleType.Countdown]: r.hintCountdown,
    [RuleType.Monthly]:   r.hintMonthly,
    [RuleType.Daily]:     r.hintDaily,
    [RuleType.Workday]:   r.hintWorkday,
  };
}

/** 获取星期数组（随语言变化，index 0=周日…6=周六） */
export function getWeekdays(): string[] {
  return useLocaleStore().t.rules.weekdays;
}

/** 获取农历月份选项（随语言变化） */
export function getLunarMonthOptions() {
  const labels = useLocaleStore().t.rules.lunarMonths;
  return labels.map((label, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label,
  }));
}

/** 获取农历日期选项（随语言变化） */
export function getLunarDayOptions() {
  const labels = useLocaleStore().t.rules.lunarDays;
  return labels.map((label, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label,
  }));
}

/** 获取星期选项（1=周一 … 7=周日，随语言变化） */
export function getWeekdayOptions() {
  const days = useLocaleStore().t.rules.weekdays;
  // days[0]=周日, days[1]=周一 ... days[6]=周六
  // option value 1=Mon ... 7=Sun
  return [
    { value: '1', label: days[1] },
    { value: '2', label: days[2] },
    { value: '3', label: days[3] },
    { value: '4', label: days[4] },
    { value: '5', label: days[5] },
    { value: '6', label: days[6] },
    { value: '7', label: days[0] },
  ];
}

/** 获取条件提示（随语言变化） */
export function getConditionHint(): Record<RuleType, string> {
  const r = useLocaleStore().t.rules;
  return {
    [RuleType.Date]:      r.hintDate,
    [RuleType.Weekday]:   r.hintWeekday,
    [RuleType.LunarDate]: r.hintLunarDate,
    [RuleType.Countdown]: r.hintCountdown,
    [RuleType.Monthly]:   r.hintMonthly,
    [RuleType.Daily]:     r.hintDaily,
    [RuleType.Workday]:   r.hintWorkday,
  };
}

/** 获取每月日期选项（1～31，随语言变化） */
export function getMonthlyDayOptions() {
  const lang = useLocaleStore().lang;
  return Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: lang === 'zh' ? `${i + 1} 日` : `Day ${i + 1}`,
  }));
}
