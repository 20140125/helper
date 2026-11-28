/**
 * 内容库（祝福语 / 提醒寄语 / 消息模板）的 KV 查询薄封装
 *
 * 设计说明：
 *   - 三份 JSON 已迁入缓存分表（已有业务表），运行时通过 cache-store 读 KV，不再读磁盘文件；
 *   - 查询函数把 KV 原始 JSON 转换成原有的扁平 / 字典返回结构，供 AI 工具与路由复用；
 *   - 结构化查询表与文件 mtime 水位同步已下线，sync / diff 系列仅保留导出名与「无差异」兼容结构。
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

/** 内容库条目数量快照 */
interface ContentCounts {
  greetings: number;
  quotes: number;
  templates: number;
  styles: number;
  names: number;
}

/** 文件与数据库的差异报告（保留兼容结构，恒为「无差异」） */
export interface ContentLibraryDiff {
  file: ContentCounts;
  db: ContentCounts;
  stale: boolean;
}

/** 空计数（sync / diff 共用的零值结构） */
const zeroCounts = (): ContentCounts => ({
  greetings: 0, quotes: 0, templates: 0, styles: 0, names: 0,
});

/**
 * 从 KV 重建结构化查询表
 * @returns {Promise<ContentCounts>} 各类条数
 * @description KV 已是唯一真源、查询侧直接读 KV，无需再重建结构化表；保留导出名与签名，返回零值
 */
export const syncContentLibraryFromFiles = async (): Promise<ContentCounts> => zeroCounts();

/**
 * 文件有更新时自动同步查询表
 * @returns {Promise<void>}
 * @description KV 为唯一真源，不存在文件 mtime 水位；保留导出名为 no-op，供既有调用方 await
 */
export const syncContentLibraryIfStale = async (): Promise<void> => {
  // 真源在库，无需按文件水位触发同步
};

/**
 * 统计文件与数据库的条目数差异
 * @returns {Promise<ContentLibraryDiff>} 差异报告
 * @description 恒返回「无差异」结构：file 与 db 计数一致且不 stale
 */
export const collectContentLibraryDiff = async (): Promise<ContentLibraryDiff> => ({
  file: zeroCounts(),
  db: zeroCounts(),
  stale: false,
});

/**
 * 判断内容库是否需要同步
 * @param {ContentLibraryDiff} diff - 差异报告
 * @returns {boolean} 任一数量不一致或标记为 stale 时返回 true
 */
export const hasContentLibraryDiff = (diff: ContentLibraryDiff): boolean =>
  diff.stale
  || (Object.keys(diff.file) as Array<keyof ContentCounts>).some((key) => diff.file[key] !== diff.db[key]);

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
