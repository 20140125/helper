// ============================================================
// AI 聊天欢迎页：相对时间格式化
// ============================================================

/**
 * 相对时间所需的 i18n 文案（aiChat namespace 子集）
 * @description `welcomeRelativeMinutes` / `welcomeRelativeHours` /
 *   `welcomeRelativeDays` 文案中应包含 `{n}` 占位符，函数内部会做替换。
 */
export interface WelcomeRelativeTimeLabels {
  /** 文案：刚刚 */
  welcomeRelativeJustNow: string;
  /** 文案：N 分钟前（含 {n} 占位符） */
  welcomeRelativeMinutes: string;
  /** 文案：N 小时前（含 {n} 占位符） */
  welcomeRelativeHours: string;
  /** 文案：N 天前（含 {n} 占位符） */
  welcomeRelativeDays: string;
}

/**
 * 把后端时间戳格式化为相对时间字符串
 * @param {number} ts - 后端返回的时间戳（秒或毫秒；按经验若 < 1e12 视为秒）
 * @param {WelcomeRelativeTimeLabels} labels - i18n 文案集
 * @returns {string} "刚刚" / "5 分钟前" / "2 小时前" / "3 天前"；超过 7 天回落到本地日期串
 */
export const formatWelcomeRelativeTime = (
  ts: number,
  labels: WelcomeRelativeTimeLabels,
): string => {
  if (!ts) return '';
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return labels.welcomeRelativeJustNow;
  if (minutes < 60) return labels.welcomeRelativeMinutes.replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.welcomeRelativeHours.replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  if (days <= 7) return labels.welcomeRelativeDays.replace('{n}', String(days));
  // 与原组件实现一致：使用浏览器本地时区的日期串，避免引入额外的时区依赖
  return new Date(ms).toLocaleDateString();
};
