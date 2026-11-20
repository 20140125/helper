import type { ReminderQuotesBucket } from '@/types/reminder-quotes';

/** Bucket 完整顺序（页面下拉筛选 + 新建表单选项） */
export const REMINDER_QUOTES_BUCKETS: ReminderQuotesBucket[] = [
  'weekend.messages',
  'workday_adjust.advance_reminders',
  'workday_adjust.today_reminders',
  'quotes.quotes',
  'breakfast.tips',
  'breakfast.nutrition_advice.monday',
  'breakfast.nutrition_advice.tuesday',
  'breakfast.nutrition_advice.wednesday',
  'breakfast.nutrition_advice.thursday',
  'breakfast.nutrition_advice.friday',
  'breakfast.nutrition_advice.weekend',
  'lunch.tips',
  'lunch.nutrition_advice.monday',
  'lunch.nutrition_advice.tuesday',
  'lunch.nutrition_advice.wednesday',
  'lunch.nutrition_advice.thursday',
  'lunch.nutrition_advice.friday',
  'lunch.nutrition_advice.weekend',
  'dinner.tips',
  'dinner.nutrition_advice.monday',
  'dinner.nutrition_advice.tuesday',
  'dinner.nutrition_advice.wednesday',
  'dinner.nutrition_advice.thursday',
  'dinner.nutrition_advice.friday',
  'dinner.nutrition_advice.weekend',
];

/** 按一级场景把 bucket 归类（用于页面 Tab 分组展示） */
export const REMINDER_QUOTES_BUCKET_GROUPS: Record<string, ReminderQuotesBucket[]> = {
  weekend: ['weekend.messages'],
  workday_adjust: ['workday_adjust.advance_reminders', 'workday_adjust.today_reminders'],
  quotes: ['quotes.quotes'],
  breakfast: [
    'breakfast.tips',
    'breakfast.nutrition_advice.monday',
    'breakfast.nutrition_advice.tuesday',
    'breakfast.nutrition_advice.wednesday',
    'breakfast.nutrition_advice.thursday',
    'breakfast.nutrition_advice.friday',
    'breakfast.nutrition_advice.weekend',
  ],
  lunch: [
    'lunch.tips',
    'lunch.nutrition_advice.monday',
    'lunch.nutrition_advice.tuesday',
    'lunch.nutrition_advice.wednesday',
    'lunch.nutrition_advice.thursday',
    'lunch.nutrition_advice.friday',
    'lunch.nutrition_advice.weekend',
  ],
  dinner: [
    'dinner.tips',
    'dinner.nutrition_advice.monday',
    'dinner.nutrition_advice.tuesday',
    'dinner.nutrition_advice.wednesday',
    'dinner.nutrition_advice.thursday',
    'dinner.nutrition_advice.friday',
    'dinner.nutrition_advice.weekend',
  ],
};

/**
 * 一级场景 key 列表
 * @description 用于页面筛选下拉 + 分组展示的顺序；与 REMINDER_QUOTES_BUCKET_GROUPS 的 key 集合一致。
 */
export const REMINDER_QUOTES_SCENES = [
  'weekend',
  'workday_adjust',
  'quotes',
  'breakfast',
  'lunch',
  'dinner',
] as const;

export type ReminderQuotesScene = typeof REMINDER_QUOTES_SCENES[number];

/**
 * 场景 key → 对应的 i18n locale key 名
 * @description Model 通过查表 + localeStore.t.reminderQuotes[key] 获取展示文案，
 *              避免在 Model 里硬编码场景到文案的映射。
 */
export const REMINDER_QUOTES_SCENE_LOCALE_KEYS: Record<ReminderQuotesScene, string> = {
  weekend: 'sceneWeekend',
  workday_adjust: 'sceneWorkdayAdjust',
  quotes: 'sceneQuotes',
  breakfast: 'sceneBreakfast',
  lunch: 'sceneLunch',
  dinner: 'sceneDinner',
};
