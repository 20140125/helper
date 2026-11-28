/**
 * 内容库（祝福语 / 提醒寄语 / 消息模板）的 KV 查询薄封装
 *
 * 设计说明：
 *   - 三份 JSON 已迁入缓存分表（已有业务表），运行时通过 cache-store 读 KV，不再读磁盘文件；
 *   - 查询函数把 KV 原始 JSON 转换成原有的扁平 / 字典返回结构，供 AI 工具与路由复用。
 */
import { readCacheJson } from './cache-store';
import type { GreetingItem, GreetingsFile } from '@/types/greetings';
import type { ReminderQuoteItem, ReminderQuotesBucket, ReminderQuotesFile } from '@/types/reminder-quotes';

/** 三份内容库 JSON 在 KV 里的键（相对 .cache 的路径） */
const CONTENT_KEYS = {
  greetings: 'greetings.json',
  quotes: 'reminder_quotes.json',
  templates: 'message_templates.json',
} as const;

/** 命名型祝福语分组（birthday 单独按模板数组处理） */
const NAMED_GROUPS = ['solar_terms', 'holidays', 'lunar_festivals', 'special_days'] as const;

/** 三餐与星期（用于寄语桶扁平化） */
const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend'] as const;

/**
 * 把祝福语 KV JSON 展开为扁平条目
 * @param {GreetingsFile | null} file - KV 解析结果
 * @returns {GreetingItem[]} 祝福语列表
 * @description 与旧结构化表读取结果同构：命名分组 id 为 `<group>::<name>`，生日模板 name 为空
 */
const flattenGreetings = (file: GreetingsFile | null): GreetingItem[] => {
  if (!file) return [];
  const items: GreetingItem[] = [];
  for (const group of NAMED_GROUPS) {
    for (const [name, content] of Object.entries(file[group] ?? {})) {
      items.push({ id: `${group}::${name}`, group, name, content: String(content) });
    }
  }
  (file.birthday?.templates ?? []).forEach((content, index) => {
    items.push({ id: `birthday::${index}`, group: 'birthday', name: '', content: String(content) });
  });
  return items;
};

/**
 * 把寄语 KV JSON 按桶展开为取值清单
 * @param {ReminderQuotesFile} file - KV 解析结果
 * @returns {Array<[ReminderQuotesBucket, unknown]>} 桶名与对应字符串数组
 */
const quoteBuckets = (file: ReminderQuotesFile): Array<[ReminderQuotesBucket, unknown]> => {
  const pairs: Array<[ReminderQuotesBucket, unknown]> = [
    ['weekend.messages', file.weekend?.messages],
    ['workday_adjust.advance_reminders', file.workday_adjust?.advance_reminders],
    ['workday_adjust.today_reminders', file.workday_adjust?.today_reminders],
    ['quotes.quotes', file.quotes?.quotes],
  ];
  for (const meal of MEALS) {
    pairs.push([`${meal}.tips` as ReminderQuotesBucket, file[meal]?.tips]);
    for (const day of WEEKDAYS) {
      pairs.push([
        `${meal}.nutrition_advice.${day}` as ReminderQuotesBucket,
        file[meal]?.nutrition_advice?.[day],
      ]);
    }
  }
  return pairs;
};

/**
 * 把寄语 KV JSON 展开为扁平条目
 * @param {ReminderQuotesFile | null} file - KV 解析结果
 * @returns {ReminderQuoteItem[]} 寄语列表
 * @description 与旧结构化表读取结果同构：id 为 `<bucket>::<index>`
 */
const flattenQuotes = (file: ReminderQuotesFile | null): ReminderQuoteItem[] => {
  if (!file) return [];
  const items: ReminderQuoteItem[] = [];
  for (const [bucket, list] of quoteBuckets(file)) {
    if (!Array.isArray(list)) continue;
    (list as string[]).forEach((content, index) => {
      items.push({ id: `${bucket}::${index}`, bucket, content: String(content) });
    });
  }
  return items;
};

/**
 * 从 KV 读取扁平化祝福语条目
 * @returns {Promise<GreetingItem[]>} 祝福语列表，键不存在或解析失败时返回空数组
 */
export const readGreetingsFromDb = async (): Promise<GreetingItem[]> =>
  flattenGreetings(await readCacheJson<GreetingsFile>(CONTENT_KEYS.greetings));

/**
 * 从 KV 读取扁平化提醒寄语条目
 * @returns {Promise<ReminderQuoteItem[]>} 寄语列表，键不存在或解析失败时返回空数组
 */
export const readReminderQuotesFromDb = async (): Promise<ReminderQuoteItem[]> =>
  flattenQuotes(await readCacheJson<ReminderQuotesFile>(CONTENT_KEYS.quotes));

/**
 * 从 KV 读取消息模板配置
 * @returns {Promise<Record<string, unknown>>} 含 version / templates / styles / template_names 等原始字段
 * @description 直接返回 message_templates.json 全文，键不存在时返回空对象
 */
export const readTemplatesFromDb = async (): Promise<Record<string, unknown>> =>
  (await readCacheJson<Record<string, unknown>>(CONTENT_KEYS.templates)) ?? {};
