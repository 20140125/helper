import type { GreetingItem, GreetingsGroup } from '@/types/greetings';

/**
 * 将祝福语条目按分组分桶
 * @description 按 `item.group` 聚合到预定义的 5 个分组桶里。
 * @param items - 扁平化条目列表
 */
export const groupGreetingsByGroup = (
  items: GreetingItem[],
): Record<GreetingsGroup, GreetingItem[]> => {
  const buckets = {
    solar_terms: [] as GreetingItem[],
    holidays: [] as GreetingItem[],
    lunar_festivals: [] as GreetingItem[],
    special_days: [] as GreetingItem[],
    birthday: [] as GreetingItem[],
  } satisfies Record<GreetingsGroup, GreetingItem[]>;
  for (const item of items) buckets[item.group].push(item);
  return buckets;
};
