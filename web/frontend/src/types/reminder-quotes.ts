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

/** 扁平化寄语条目 */
export interface ReminderQuoteItem {
  id: string;
  bucket: ReminderQuotesBucket;
  content: string;
}

export interface CreateReminderQuotePayload {
  bucket: ReminderQuotesBucket;
  content: string;
}

export interface UpdateReminderQuotePayload {
  bucket?: ReminderQuotesBucket;
  content?: string;
}

// ── 响应类型 ──

export interface ReminderQuotesListResponse {
  code: number;
  data: { items: ReminderQuoteItem[]; buckets: ReminderQuotesBucket[] };
  message: string;
}

export interface ReminderQuoteResponse {
  code: number;
  data: { item?: ReminderQuoteItem };
  message: string;
}

export interface ReminderQuotesGroupBucket {
  scene: string;
  label: string;
  items: ReminderQuoteItem[];
}

/**
 * 提醒寄语表单数据类型
 * @description 用于提醒寄语管理抽屉（新增/编辑）的 v-model 绑定值
 */
export type IReminderQuoteFormData = Partial<ReminderQuoteItem>;
