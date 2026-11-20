import type { GreetingsGroup } from '@/types/greetings';

/**
 * 节日祝福语分组顺序（页面 Tab 及筛选下拉展示顺序）
 * @description 与后端 GREETINGS_GROUPS 保持一致
 */
export const GREETINGS_GROUPS: GreetingsGroup[] = [
  'solar_terms',
  'holidays',
  'lunar_festivals',
  'special_days',
  'birthday',
];

/**
 * 生日模板分组 key（特殊：无 name，只有 content）
 */
export const GREETINGS_BIRTHDAY_GROUP: GreetingsGroup = 'birthday';

/**
 * 分组 key → 对应的 i18n locale key 名
 * @description Model 通过查表 + localeStore.t.greetings[key] 获取展示文案，
 *              避免在 Model 里硬编码分组到文案的映射。
 */
export const GREETINGS_GROUP_LOCALE_KEYS: Record<GreetingsGroup, string> = {
  solar_terms: 'groupSolarTerms',
  holidays: 'groupHolidays',
  lunar_festivals: 'groupLunarFestivals',
  special_days: 'groupSpecialDays',
  birthday: 'groupBirthday',
};
