/** 假期信息结构 */
export interface HolidayInfo {
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD
  name: string;    // 假期名称
  days: number;    // 假期总天数
}

/** 调休上班日结构 */
export interface AdjustWorkday {
  date: string;    // YYYY-MM-DD
  name: string;    // 原因（如"调休上班"）
}

/** 解析结果 */
export interface HolidayConfigResult {
  holidays: HolidayInfo[];
  adjustDays: AdjustWorkday[];
}

/** reminder_quotes.json 的类型 */
export interface QuotesData {
  weekend?: { messages?: string[] };
  workday_adjust?: { advance_reminders?: string[]; today_reminders?: string[] };
  quotes?: { quotes?: string[] };
  breakfast?: { tips?: string[]; nutrition_advice?: Record<string, string[]> };
  lunch?: { tips?: string[]; nutrition_advice?: Record<string, string[]> };
  dinner?: { tips?: string[]; nutrition_advice?: Record<string, string[]> };
}

/** greetings.json 的类型 */
export interface GreetingsData {
  solar_terms?: Record<string, string>;
  holidays?: Record<string, string>;
  lunar_festivals?: Record<string, string>;
  birthday?: { templates?: string[] };
  special_days?: Record<string, string>;
}
