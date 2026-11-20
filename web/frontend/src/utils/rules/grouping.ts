import type { Rule } from '@/types/rule';

/**
 * 按规则类型聚合，返回 { type, label, count } 数组
 * @param {Rule[]} rules - 规则列表
 * @param {Record<string, string>} labelMap - 规则类型 → 展示标签映射
 * @returns {Array<{ type: string; label: string; count: number }>} 按类型聚合后的统计数组
 */
export const groupRulesByType = (
  rules: Rule[],
  labelMap: Record<string, string>,
): Array<{ type: string; label: string; count: number }> => {
  const countMap: Record<string, number> = {};
  rules.forEach((r) => {
    countMap[r.type] = (countMap[r.type] || 0) + 1;
  });
  return Object.entries(countMap).map(([type, count]) => ({
    type,
    label: labelMap[type] || type,
    count,
  }));
};
