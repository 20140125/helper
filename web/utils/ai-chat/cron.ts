/**
 * 极简 cron 解析（五段：分 时 日 月 周）
 * @description 只为「订阅式巡检」这类内部调度服务，不追求完整 cron 语法。
 *   支持的写法：星号、单个数字、逗号列表、范围、步长（星号后跟斜杠与步长）及其组合。
 *   不支持：月份/星期的英文名、`@daily` 这类宏、年份段（第六段）。
 *
 * 为什么自己写而不装 node-cron：调度需求只有「每天几点」和「每周几几点」两种，
 *   引入依赖换来的是一份永远用不到的语法全集，以及一个要跟着升级的包。
 */

/** 每段的取值范围 */
const FIELD_RANGES: { min: number; max: number }[] = [
  { min: 0, max: 59 },  // 分
  { min: 0, max: 23 },  // 时
  { min: 1, max: 31 },  // 日
  { min: 1, max: 12 },  // 月
  { min: 0, max: 6 },   // 周（0=周日）
];

/**
 * 解析单段表达式，展开为可取值的集合
 * @param {string} field - 单段表达式
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {Set<number> | null} 取值集合；表达式非法返回 null
 */
const parseField = (field: string, min: number, max: number): Set<number> | null => {
  const values = new Set<number>();
  const parts = field.split(',');
  for (const part of parts) {
    const [rangeRaw, stepRaw] = part.split('/');
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) return null;

    let from: number;
    let to: number;
    if (rangeRaw === '*') {
      from = min;
      to = max;
    } else if (rangeRaw.includes('-')) {
      const [a, b] = rangeRaw.split('-');
      from = Number(a);
      to = Number(b);
    } else {
      from = Number(rangeRaw);
      to = stepRaw === undefined ? from : max;
    }
    if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
    if (from < min || to > max || from > to) return null;
    for (let v = from; v <= to; v += step) values.add(v);
  }
  return values;
};

/**
 * 校验 cron 表达式是否合法
 * @param {string} expr - 五段 cron 表达式
 * @returns {boolean} 合法返回 true
 */
export const isValidCron = (expr: string): boolean => {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((f, i) => {
    const { min, max } = FIELD_RANGES[i];
    return parseField(f, min, max) !== null;
  });
};

/**
 * 判断给定时间是否命中 cron 表达式
 * @param {string} expr - 五段 cron 表达式
 * @param {Date} date - 待判断的时间
 * @returns {boolean} 命中返回 true；表达式非法一律返回 false（不会误触发）
 */
export const matchCron = (expr: string, date: Date): boolean => {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const actual = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()];
  for (let i = 0; i < 5; i += 1) {
    const { min, max } = FIELD_RANGES[i];
    const parsed = parseField(fields[i], min, max);
    if (!parsed) return false;
    if (!parsed.has(actual[i])) return false;
  }
  return true;
};
