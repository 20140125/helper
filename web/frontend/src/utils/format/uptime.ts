import type { Locale } from '@/locales/zh';

/** 常用时间单位对应的秒数 */
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

type DashboardLocale = Locale['dashboard'];

/** <1 分钟：仅秒 */
const formatSecondsOnly = (seconds: number, d: DashboardLocale): string => d.seconds(seconds);

/** <1 小时：分 + 可选秒 */
const formatMinutes = (seconds: number, d: DashboardLocale): string => {
  const m = Math.floor(seconds / SECONDS_PER_MINUTE);
  const s = seconds % SECONDS_PER_MINUTE;
  return s > 0 ? d.minutesSeconds(m, s) : d.minutes(m);
};

/** <1 天：时 + 可选分 */
const formatHours = (seconds: number, d: DashboardLocale): string => {
  const h = Math.floor(seconds / SECONDS_PER_HOUR);
  const m = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return m > 0 ? d.hoursMinutes(h, m) : d.hours(h);
};

/** <1 月：天 + 可选时 + 可选分 */
const formatDays = (seconds: number, d: DashboardLocale): string => {
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const h = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const m = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (h > 0 && m > 0) return d.daysHoursMinutes(days, h, m);
  if (h > 0) return d.daysHours(days, h);
  if (m > 0) return d.daysMinutes(days, m);
  return d.days(days);
};

/** ≥1 月：年 + 可选月 + 可选天 */
const formatYears = (seconds: number, d: DashboardLocale): string => {
  const y = Math.floor(seconds / SECONDS_PER_YEAR);
  const mo = Math.floor((seconds % SECONDS_PER_YEAR) / SECONDS_PER_MONTH);
  const days = Math.floor((seconds % SECONDS_PER_MONTH) / SECONDS_PER_DAY);
  if (mo > 0 && days > 0) return d.yearsMonthsDays(y, mo, days);
  if (mo > 0) return d.yearsMonths(y, mo);
  if (days > 0) return d.yearsDays(y, days);
  return d.years(y);
};

/**
 * 将秒数格式化为可读时间文案（依赖 i18n 片段，覆盖秒/分/时/天/月/年）
 * @param {number} seconds - 要格式化的秒数
 * @param {Locale['dashboard']} d - 仪表盘相关的 i18n 文案片段
 * @returns {string} 格式化后的时间字符串
 */
export const formatUptimeSeconds = (seconds: number, d: DashboardLocale): string => {
  if (seconds < SECONDS_PER_MINUTE) return formatSecondsOnly(seconds, d);
  if (seconds < SECONDS_PER_HOUR) return formatMinutes(seconds, d);
  if (seconds < SECONDS_PER_DAY) return formatHours(seconds, d);
  if (seconds < SECONDS_PER_MONTH) return formatDays(seconds, d);
  return formatYears(seconds, d);
};
