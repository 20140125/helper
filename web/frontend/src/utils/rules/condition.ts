import { type RuleFlatFormData, RuleType } from '@/types/rule';
import { useLocaleStore } from '@/stores/locale';
import { MessagePlugin } from 'tdesign-vue-next';

export type { RuleFlatFormData } from '@/types/rule';

/**
 * 创建规则表单的空数据
 * @returns 扁平化的规则表单初始值
 */
export const createEmptyRuleFormData = (): RuleFlatFormData => ({
  name: '',
  type: RuleType.Date,
  dateCondition: '',
  weekdayCondition: '',
  lunarMonth: '',
  lunarDay: '',
  lunarDate: '',
  countdownDate: '',
  countdownDays: '7',
  monthlyDay: '',
  time: '09:00',
  message: '',
  template_id: '',
  custom_content: false,
  enabled: true,
  webhookIds: [],
});

/**
 * 将扁平化的规则表单数据组合为最终提交的 condition 字段
 * @param data 扁平化表单数据
 * @returns 组合后的 condition 字符串，校验失败时返回 null（并弹警告）
 */
export const buildCondition = (data: RuleFlatFormData): string | null => {
  const r = useLocaleStore().t.rules;
  const { type } = data;

  if (type === RuleType.Date) {
    if (!data.dateCondition) { MessagePlugin.warning(r.warnSelectDate); return null; }
    return data.dateCondition;
  }

  if (type === RuleType.Weekday) {
    if (!data.weekdayCondition) { MessagePlugin.warning(r.warnSelectWeekday); return null; }
    return data.weekdayCondition;
  }

  if (type === RuleType.LunarDate) {
    if (!data.lunarMonth || !data.lunarDay) { MessagePlugin.warning(r.warnSelectLunarDate); return null; }
    return `${data.lunarMonth}-${data.lunarDay}`;
  }

  if (type === RuleType.Countdown) {
    if (!data.countdownDate) { MessagePlugin.warning(r.warnSelectCountdownDate); return null; }
    return `${data.countdownDate}:${data.countdownDays}`;
  }

  if (type === RuleType.Monthly) {
    if (!data.monthlyDay) { MessagePlugin.warning(r.warnSelectMonthlyDay); return null; }
    return data.monthlyDay;
  }

  // daily / workday 无需条件，直接用 type 作为占位
  return type;
};

/**
 * 将规则对象解析并填充为扁平化的表单数据
 * @param rule 规则对象
 * @returns 扁平化表单数据
 */
export const parseRuleToFormData = (rule: Record<string, unknown>): RuleFlatFormData => {
  const type = rule.type as RuleType;
  const condition = (rule.condition as string) ?? '';

  const base: RuleFlatFormData = {
    ...createEmptyRuleFormData(),
    name: (rule.name as string) ?? '',
    type,
    time: (rule.time as string) ?? '09:00',
    message: (rule.message as string) ?? '',
    template_id: (rule.template_id as string) ?? '',
    custom_content: (rule.custom_content as boolean) ?? false,
    enabled: (rule.enabled as boolean) ?? true,
    webhookIds: (rule.webhookIds as string[]) ?? [],
  };

  if (type === RuleType.Date) {
    base.dateCondition = condition;
  } else if (type === RuleType.Weekday) {
    base.weekdayCondition = condition;
  } else if (type === RuleType.LunarDate) {
    const m = condition.match(/^(\d{2})-(\d{2})$/);
    base.lunarMonth = m ? m[1] : '';
    base.lunarDay = m ? m[2] : '';
    base.lunarDate = m ? condition : '';
  } else if (type === RuleType.Countdown) {
    const m = condition.match(/^(\d{4}-\d{2}-\d{2}):(\d+)$/);
    base.countdownDate = m ? m[1] : '';
    base.countdownDays = m ? m[2] : '7';
  } else if (type === RuleType.Monthly) {
    base.monthlyDay = condition;
  }

  return base;
};
