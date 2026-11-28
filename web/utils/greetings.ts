import type { GreetingItem, GreetingsFile, GreetingsGroup } from '@/types/greetings';
import { readCacheJson, writeCacheJson } from '@/utils/database/cache-store';

/** 祝福语缓存键（相对 .cache 的路径，真源为 已有业务表） */
const GREETINGS_KEY = 'greetings.json';

/** 默认文件结构（首次生成时使用） */
const DEFAULT_FILE: GreetingsFile = {
  solar_terms: {},
  holidays: {},
  lunar_festivals: {},
  special_days: {},
  birthday: { templates: [] },
};

/**
 * 读取原始 JSON 数据
 * @returns {Promise<GreetingsFile>} 原始嵌套结构；缓存缺失或格式错误时返回默认结构
 * @description 真源为缓存 KV，不再触碰磁盘文件
 */
export const readGreetingsFile = async (): Promise<GreetingsFile> => {
  const raw = await readCacheJson<Partial<GreetingsFile>>(GREETINGS_KEY);
  if (!raw) {
    return { ...DEFAULT_FILE, birthday: { templates: [] } };
  }
  return {
    solar_terms: raw.solar_terms ?? {},
    holidays: raw.holidays ?? {},
    lunar_festivals: raw.lunar_festivals ?? {},
    special_days: raw.special_days ?? {},
    birthday: { templates: raw.birthday?.templates ?? [] },
  };
};

/**
 * 写入原始 JSON 数据
 * @param {GreetingsFile} data - 完整文件结构
 * @returns {Promise<void>}
 * @description 通过缓存 KV 全量覆盖，序列化格式与旧版一致（2 空格缩进）
 */
export const writeGreetingsFile = async (data: GreetingsFile): Promise<void> => {
  await writeCacheJson(GREETINGS_KEY, data);
};

/**
 * 将原始嵌套结构展开为扁平化条目数组
 * @description ID 规则：
 *   - 命名型分组（solar_terms / holidays / lunar_festivals / special_days）：`<group>::<name>`
 *   - 生日模板（birthday）：`birthday::<index>`
 */
export const flattenGreetings = (file: GreetingsFile): GreetingItem[] => {
  const items: GreetingItem[] = [];
  const namedGroups: Array<Exclude<GreetingsGroup, 'birthday'>> = [
    'solar_terms',
    'holidays',
    'lunar_festivals',
    'special_days',
  ];
  for (const group of namedGroups) {
    const record = file[group] ?? {};
    for (const [name, content] of Object.entries(record)) {
      items.push({ id: `${group}::${name}`, group, name, content });
    }
  }
  file.birthday.templates.forEach((content, index) => {
    items.push({ id: `birthday::${index}`, group: 'birthday', name: '', content });
  });
  return items;
};

/**
 * 按扁平化条目列表回写原始嵌套结构
 * @description 命名型分组使用 name 作为 key；birthday 按出现顺序收集 content
 */
export const rebuildGreetingsFile = (items: GreetingItem[]): GreetingsFile => {
  const file: GreetingsFile = {
    solar_terms: {},
    holidays: {},
    lunar_festivals: {},
    special_days: {},
    birthday: { templates: [] },
  };
  for (const item of items) {
    if (item.group === 'birthday') {
      file.birthday.templates.push(item.content);
    } else {
      if (!item.name) continue;
      file[item.group][item.name] = item.content;
    }
  }
  return file;
};

/**
 * 读取并展开为扁平化条目列表（路由层便捷使用）
 * @returns {Promise<GreetingItem[]>} 扁平化条目列表
 */
export const readGreetingItems = async (): Promise<GreetingItem[]> =>
  flattenGreetings(await readGreetingsFile());
