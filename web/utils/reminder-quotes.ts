import fs from 'fs';
import type {
  ReminderQuoteItem,
  ReminderQuotesBucket,
  ReminderQuotesFile,
} from '@/types/reminder-quotes';
import { REMINDER_QUOTES_FILE, REMINDER_QUOTES_BUCKETS } from '@/types/reminder-quotes';
import { CACHE_DIR } from './paths';

const MEAL_KEYS: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend'] as const;

const buildDefaultFile = (): ReminderQuotesFile => {
  const emptyNutrition = (): Record<string, string[]> =>
    WEEKDAY_KEYS.reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});
  return {
    weekend: { description: '', messages: [] },
    workday_adjust: { description: '', advance_reminders: [], today_reminders: [] },
    quotes: { description: '', quotes: [] },
    breakfast: { description: '', tips: [], nutrition_advice: emptyNutrition() },
    lunch: { description: '', tips: [], nutrition_advice: emptyNutrition() },
    dinner: { description: '', tips: [], nutrition_advice: emptyNutrition() },
  };
};

/** 读取原始 JSON 文件（缺字段补默认值） */
export const readReminderQuotesFile = (): ReminderQuotesFile => {
  if (!fs.existsSync(REMINDER_QUOTES_FILE)) {
    return buildDefaultFile();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(REMINDER_QUOTES_FILE, 'utf-8')) as Partial<ReminderQuotesFile>;
    const def = buildDefaultFile();
    return {
      weekend: { description: raw.weekend?.description ?? '', messages: raw.weekend?.messages ?? [] },
      workday_adjust: {
        description: raw.workday_adjust?.description ?? '',
        advance_reminders: raw.workday_adjust?.advance_reminders ?? [],
        today_reminders: raw.workday_adjust?.today_reminders ?? [],
      },
      quotes: { description: raw.quotes?.description ?? '', quotes: raw.quotes?.quotes ?? [] },
      breakfast: {
        description: raw.breakfast?.description ?? '',
        tips: raw.breakfast?.tips ?? [],
        nutrition_advice: { ...def.breakfast.nutrition_advice, ...(raw.breakfast?.nutrition_advice ?? {}) },
      },
      lunch: {
        description: raw.lunch?.description ?? '',
        tips: raw.lunch?.tips ?? [],
        nutrition_advice: { ...def.lunch.nutrition_advice, ...(raw.lunch?.nutrition_advice ?? {}) },
      },
      dinner: {
        description: raw.dinner?.description ?? '',
        tips: raw.dinner?.tips ?? [],
        nutrition_advice: { ...def.dinner.nutrition_advice, ...(raw.dinner?.nutrition_advice ?? {}) },
      },
    };
  } catch {
    return buildDefaultFile();
  }
};

/** 写入原始 JSON 文件 */
export const writeReminderQuotesFile = (data: ReminderQuotesFile): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(REMINDER_QUOTES_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

/** 从指定 bucket 读出字符串数组 */
const readBucket = (file: ReminderQuotesFile, bucket: ReminderQuotesBucket): string[] => {
  if (bucket === 'weekend.messages') return file.weekend.messages;
  if (bucket === 'workday_adjust.advance_reminders') return file.workday_adjust.advance_reminders;
  if (bucket === 'workday_adjust.today_reminders') return file.workday_adjust.today_reminders;
  if (bucket === 'quotes.quotes') return file.quotes.quotes;
  for (const meal of MEAL_KEYS) {
    if (bucket === `${meal}.tips`) return file[meal].tips;
    for (const day of WEEKDAY_KEYS) {
      if (bucket === `${meal}.nutrition_advice.${day}`) {
        return file[meal].nutrition_advice[day] ?? [];
      }
    }
  }
  return [];
};

/** 将字符串数组写回指定 bucket */
const writeBucket = (file: ReminderQuotesFile, bucket: ReminderQuotesBucket, list: string[]): void => {
  if (bucket === 'weekend.messages') {
    file.weekend.messages = list;
    return;
  }
  if (bucket === 'workday_adjust.advance_reminders') {
    file.workday_adjust.advance_reminders = list;
    return;
  }
  if (bucket === 'workday_adjust.today_reminders') {
    file.workday_adjust.today_reminders = list;
    return;
  }
  if (bucket === 'quotes.quotes') {
    file.quotes.quotes = list;
    return;
  }
  for (const meal of MEAL_KEYS) {
    if (bucket === `${meal}.tips`) {
      file[meal].tips = list;
      return;
    }
    for (const day of WEEKDAY_KEYS) {
      if (bucket === `${meal}.nutrition_advice.${day}`) {
        file[meal].nutrition_advice[day] = list;
        return;
      }
    }
  }
};

/**
 * 展开为扁平化条目
 * @description ID 规则：`<bucket>::<index>`
 */
export const flattenReminderQuotes = (file: ReminderQuotesFile): ReminderQuoteItem[] => {
  const items: ReminderQuoteItem[] = [];
  for (const bucket of REMINDER_QUOTES_BUCKETS) {
    const list = readBucket(file, bucket);
    list.forEach((content, index) => {
      items.push({ id: `${bucket}::${index}`, bucket, content });
    });
  }
  return items;
};

/** 按条目列表重建原始结构 */
export const rebuildReminderQuotesFile = (items: ReminderQuoteItem[], base: ReminderQuotesFile): ReminderQuotesFile => {
  // 先清空所有受控桶，保留 description
  const buckets: Record<string, string[]> = {};
  for (const bucket of REMINDER_QUOTES_BUCKETS) {
    buckets[bucket] = [];
  }
  for (const item of items) {
    if (!REMINDER_QUOTES_BUCKETS.includes(item.bucket)) continue;
    buckets[item.bucket].push(item.content);
  }
  for (const bucket of REMINDER_QUOTES_BUCKETS) {
    writeBucket(base, bucket, buckets[bucket]);
  }
  return base;
};

/** 判断 bucket 是否合法 */
export const isValidReminderBucket = (bucket: string): bucket is ReminderQuotesBucket =>
  (REMINDER_QUOTES_BUCKETS as string[]).includes(bucket);

/** 读取并展开为扁平化条目（路由层便捷使用） */
export const readReminderQuoteItems = (): ReminderQuoteItem[] => flattenReminderQuotes(readReminderQuotesFile());
