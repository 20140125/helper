import type { FormData, HandlerRegistry } from '@/types/handler-registry';
import { useLocaleStore } from '@/stores/locale';
import { GREETINGS_BIRTHDAY_GROUP, GREETINGS_GROUPS } from '@/constants/greetings';
import type { GreetingsGroup } from '@/types/greetings';
import type { AutoFormRule } from '@/types/auto-form';
import { isEditing } from './shared';

/**
 * 获取祝福语分组 key → 国际化 label 的映射
 * @description 集中在此处维护 group key 到 locale 字段的对应关系，
 *              避免分组新增/调整时多处同步。
 */
const getGroupLabel = (group: GreetingsGroup): string => {
  const { t } = useLocaleStore();
  const map: Record<GreetingsGroup, string> = {
    solar_terms: t.greetings.groupSolarTerms,
    holidays: t.greetings.groupHolidays,
    lunar_festivals: t.greetings.groupLunarFestivals,
    special_days: t.greetings.groupSpecialDays,
    birthday: t.greetings.groupBirthday,
  };
  return map[group];
};

/**
 * 获取祝福语分组下拉选项
 * @description 集中在此处维护 group key 到 locale 字段的对应关系，
 *              避免分组新增/调整时多处同步。
 */
const getGroupOptions = (): Array<{ label: string; value: GreetingsGroup }> =>
  GREETINGS_GROUPS.map((g) => ({ label: getGroupLabel(g), value: g }));

/**
 * 名称是否禁用
 * @description 所属分组为"生日模板"时禁用（生日模板无需填写名称）
 */
const greetingNameDisabled = (data: FormData): boolean => data.group === GREETINGS_BIRTHDAY_GROUP;

/**
 * 名称校验规则
 * @description 所属分组为"生日模板"时无需校验
 */
const greetingNameRules = (data: FormData): Array<AutoFormRule> => {
  return [{
    required: data.group !== GREETINGS_BIRTHDAY_GROUP,
    message: '名称不能为空',
  }];
};

/**
 * 创建节日祝福语页面的 handler 注册表
 * @description 将 greeting-form 中的动态选项集中注册，
 *              供 field-enhancer 解析 $handler:greetings.* 标记。
 *              选项由 GREETINGS_GROUPS 常量 + locale 运行时拼装，
 *              分组新增只需改常量 + locale，无需再改 json 模板。
 * @returns HandlerRegistry 祝福语相关的 handler 注册表
 */
export const createGreetingsHandlers = (): HandlerRegistry => ({
  /** 分组下拉选项（不含"全部"，供新建/编辑表单使用） */
  'greetings.groupOptions': (): Array<{ label: string; value: GreetingsGroup }> => getGroupOptions(),
  /** 所属分组是否禁用：编辑时禁止修改分组 */
  'greetings.groupDisabled': (data: FormData) => isEditing(data),
  /** 名称是否禁用：所属分组为"生日模板"时禁用（生日模板无需填写名称） */
  'greetings.greetingNameDisabled': (data: FormData) => greetingNameDisabled(data),
  /** 名称校验规则：所属分组为"生日模板"时无需校验 */
  'greetings.greetingNameRules': (data: FormData) => greetingNameRules(data),
});
