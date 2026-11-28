// 类型从 @/types/templates 直接再导出，无需先 import 再 export
export type { HolidayInfo, AdjustWorkday, HolidayConfigResult, QuotesData, GreetingsData } from '@/types/templates';

// ==============================
// 辅助工具函数
// ==============================

/** 获取当前年的第几天（与脚本中 day_of_year 类似的确定性种子） */
export function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/** 按确定性种子从数组中选取（模仿脚本中 day_of_year % len 的逻辑） */
export function pickByDaySeed<T>(arr: T[], seed?: number): T {
  const s = seed ?? getDayOfYear(new Date());
  return arr[s % arr.length];
}

/** 按星期几映射到 JSON key（与脚本 _get_lunch_messages 的 day_map 一致） */
export function getWeekdayKey(d: Date): string {
  const map: Record<number, string> = { 0: 'weekend', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'weekend' };
  return map[d.getDay()] ?? 'weekend';
}

/** 还原缓存中的 | → \n */
export function unescapePipe(v: string): string {
  return typeof v === 'string' ? v.replace(/\|/g, '\n') : v;
}
