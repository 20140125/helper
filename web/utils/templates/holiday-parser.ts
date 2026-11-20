import { promises as fs } from 'fs';
import path from 'path';
import type { HolidayConfigResult } from './helpers';

/**
 * 从 holiday_config.sh 解析假期列表（与脚本 get_holidays 逻辑一致）
 * 解析 declare -A HOLIDAYS_YYYY 数组，将连续假期日期合并为假期段
 */
export async function parseHolidayConfig(): Promise<HolidayConfigResult> {
  const emptyResult: HolidayConfigResult = { holidays: [], adjustDays: [] };
  const configPath = path.join(__dirname, '../../../scripts/holiday_config.sh');
  let content: string;
  try {
    content = await fs.readFile(configPath, 'utf-8');
  } catch {
    return emptyResult;
  }

  const year = new Date().getFullYear();
  const varName = `HOLIDAYS_${year}`;

  // 提取 declare -A HOLIDAYS_YYYY=( ... ) 块
  // 注意：不能用非贪婪 .*?\) 因为注释中有 (3天) 等括号，会提前截断
  // 改为匹配到行首独立 ) 作为数组结束标志
  const blockRe = new RegExp(`declare\\s+-A\\s+${varName}=\\(([\\s\\S]*?)^\\)`, 'm');
  const blockMatch = content.match(blockRe);
  if (!blockMatch) return emptyResult;

  // 解析每条 ['YYYY-MM-DD']='名称|类型'
  const entryRe = /\['(\d{4}-\d{2}-\d{2})'\]='([^|]+)\|(\d)'/g;
  const entries: { date: string; name: string; type: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(blockMatch[1])) !== null) {
    entries.push({ date: m[1], name: m[2], type: parseInt(m[3], 10) });
  }

  // 类型=2 → 假期，类型=3 → 调休上班日
  const holidays = entries.filter(e => e.type === 2).sort((a, b) => a.date.localeCompare(b.date));
  const adjustDays = entries
    .filter(e => e.type === 3)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({ date: e.date, name: e.name }));

  if (holidays.length === 0) return { holidays: [], adjustDays };

  // 合并连续日期为假期段（与脚本 get_holidays 一致，允许间隔<=3天）
  const result: import('./helpers').HolidayInfo[] = [];
  let segStart = holidays[0].date;
  let segEnd = holidays[0].date;
  let segNames = [holidays[0].name];

  const daysBetween = (a: string, b: string) =>
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

  const mainHolidayNames = ['春节', '国庆', '劳动节', '元旦', '清明', '端午', '中秋'];

  const pickMainName = (names: string[]): string => {
    for (const main of mainHolidayNames) {
      if (names.includes(main)) return main;
    }
    return names[0];
  };

  for (let i = 1; i < holidays.length; i++) {
    const diff = daysBetween(segEnd, holidays[i].date);
    if (diff <= 3) {
      segEnd = holidays[i].date;
      if (!segNames.includes(holidays[i].name)) segNames.push(holidays[i].name);
    } else {
      result.push({
        start: segStart,
        end: segEnd,
        name: pickMainName(segNames),
        days: daysBetween(segStart, segEnd) + 1,
      });
      segStart = holidays[i].date;
      segEnd = holidays[i].date;
      segNames = [holidays[i].name];
    }
  }
  result.push({
    start: segStart,
    end: segEnd,
    name: pickMainName(segNames),
    days: daysBetween(segStart, segEnd) + 1,
  });

  return { holidays: result, adjustDays };
}
