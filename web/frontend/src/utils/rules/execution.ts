/**
 * 把日期按本地时区格式化为 YYYY-MM-DD
 * @param {Date} date - 待格式化日期
 * @returns {string} YYYY-MM-DD 形式的日期串
 */
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 判断规则今天是否已经执行过
 * @param {string | undefined} lastTriggeredAt - 最后触发时间（YYYY-MM-DDTHH:mm:ss）
 * @param {Date} now - 当前时间，默认取系统当前时间
 * @returns {boolean} 最后触发日期与今天相同则为 true
 * @description 只比较年月日，与执行脚本的「当天只触发一次」判定保持一致；
 *   同时兼容旧数据里以 / 分隔的日期格式
 */
export const isExecutedToday = (lastTriggeredAt: string | undefined, now: Date = new Date()): boolean => {
  if (!lastTriggeredAt) return false;
  const lastDate = lastTriggeredAt.trim().replace(/\//g, '-').slice(0, 10);
  return lastDate === formatLocalDate(now);
};
