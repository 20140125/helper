import { CACHE_DIR } from '@/utils/paths';

/** Greetings 数据文件路径 */
export const GREETINGS_FILE = `${CACHE_DIR}/greetings.json`;

/** Greetings 数据分组 key */
export type GreetingsGroup = 'solar_terms' | 'holidays' | 'lunar_festivals' | 'special_days' | 'birthday';

/** 支持的分组集合（运行时校验用） */
export const GREETINGS_GROUPS: GreetingsGroup[] = [
  'solar_terms',
  'holidays',
  'lunar_festivals',
  'special_days',
  'birthday',
];

/** Greetings 扁平化条目（前端 / API 交互使用） */
export interface GreetingItem {
  /** 条目 ID（内部生成，用于前端增删改查） */
  id: string;
  /** 所属分组 */
  group: GreetingsGroup;
  /**
   * 条目名称
   * - solar_terms / holidays / lunar_festivals / special_days：节气或节日名（如 "立春"）
   * - birthday：空串（属于模板池，无独立名称）
   */
  name: string;
  /** 祝福语内容（支持 Markdown） */
  content: string;
}

/** 原始 JSON 文件结构（.cache/greetings.json） */
export interface GreetingsFile {
  solar_terms: Record<string, string>;
  holidays: Record<string, string>;
  lunar_festivals: Record<string, string>;
  special_days: Record<string, string>;
  birthday: {
    templates: string[];
  };
}

// ── 请求体类型 ──

export interface CreateGreetingBody {
  group: GreetingsGroup;
  name?: string;
  content: string;
}

export interface UpdateGreetingBody {
  group?: GreetingsGroup;
  name?: string;
  content?: string;
}
