import { CACHE_DIR } from '@/utils/paths';

/** Reminder Quotes 数据文件路径 */
export const REMINDER_QUOTES_FILE = `${CACHE_DIR}/reminder_quotes.json`;

/** Reminder Quotes 桶（bucket）—— 二级路径字符串标识 */
export type ReminderQuotesBucket =
  | 'weekend.messages'
  | 'workday_adjust.advance_reminders'
  | 'workday_adjust.today_reminders'
  | 'quotes.quotes'
  | 'breakfast.tips'
  | 'breakfast.nutrition_advice.monday'
  | 'breakfast.nutrition_advice.tuesday'
  | 'breakfast.nutrition_advice.wednesday'
  | 'breakfast.nutrition_advice.thursday'
  | 'breakfast.nutrition_advice.friday'
  | 'breakfast.nutrition_advice.weekend'
  | 'lunch.tips'
  | 'lunch.nutrition_advice.monday'
  | 'lunch.nutrition_advice.tuesday'
  | 'lunch.nutrition_advice.wednesday'
  | 'lunch.nutrition_advice.thursday'
  | 'lunch.nutrition_advice.friday'
  | 'lunch.nutrition_advice.weekend'
  | 'dinner.tips'
  | 'dinner.nutrition_advice.monday'
  | 'dinner.nutrition_advice.tuesday'
  | 'dinner.nutrition_advice.wednesday'
  | 'dinner.nutrition_advice.thursday'
  | 'dinner.nutrition_advice.friday'
  | 'dinner.nutrition_advice.weekend';

/** 所有支持的 bucket 路径（与类型联合保持同步） */
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

/** 扁平化条目 */
export interface ReminderQuoteItem {
  id: string;
  /** 所属桶（二级路径） */
  bucket: ReminderQuotesBucket;
  /** 寄语内容 */
  content: string;
}

/** 工作日调整 */
export interface ReminderWorkdayAdjust {
  description: string;
  advance_reminders: string[];
  today_reminders: string[];
}

/** 三餐 */
export interface ReminderMeal {
  description: string;
  tips: string[];
  nutrition_advice: Record<string, string[]>;
}

/** 原始 JSON 文件结构（.cache/reminder_quotes.json） */
export interface ReminderQuotesFile {
  weekend: { description: string; messages: string[] };
  workday_adjust: ReminderWorkdayAdjust;
  quotes: { description: string; quotes: string[] };
  breakfast: ReminderMeal;
  lunch: ReminderMeal;
  dinner: ReminderMeal;
}

// ── 请求体类型 ──

export interface CreateReminderQuoteBody {
  bucket: ReminderQuotesBucket;
  content: string;
}

export interface UpdateReminderQuoteBody {
  bucket?: ReminderQuotesBucket;
  content?: string;
}
