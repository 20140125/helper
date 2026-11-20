import fs from 'fs';
import type { GreetingItem, GreetingsFile, GreetingsGroup } from '@/types/greetings';
import { GREETINGS_FILE } from '@/types/greetings';
import { CACHE_DIR } from './paths';

/** 默认文件结构（首次生成时使用） */
const DEFAULT_FILE: GreetingsFile = {
  solar_terms: {},
  holidays: {},
  lunar_festivals: {},
  special_days: {},
  birthday: { templates: [] },
};

/**
 * 读取原始 JSON 文件
 * @returns 原始嵌套结构
 */
export const readGreetingsFile = (): GreetingsFile => {
  if (!fs.existsSync(GREETINGS_FILE)) {
    return { ...DEFAULT_FILE, birthday: { templates: [] } };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(GREETINGS_FILE, 'utf-8')) as Partial<GreetingsFile>;
    return {
      solar_terms: raw.solar_terms ?? {},
      holidays: raw.holidays ?? {},
      lunar_festivals: raw.lunar_festivals ?? {},
      special_days: raw.special_days ?? {},
      birthday: { templates: raw.birthday?.templates ?? [] },
    };
  } catch {
    return { ...DEFAULT_FILE, birthday: { templates: [] } };
  }
};

/**
 * 写入原始 JSON 文件
 * @param data - 完整文件结构
 */
export const writeGreetingsFile = (data: GreetingsFile): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(GREETINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
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

/** 读取并展开为扁平化条目列表（路由层便捷使用） */
export const readGreetingItems = (): GreetingItem[] => flattenGreetings(readGreetingsFile());
