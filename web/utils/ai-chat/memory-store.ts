import fs from 'fs';
import path from 'path';
import {
  AI_MEMORY_DIR,
  MAX_MEMORY_ITEMS,
  type MemoryItem,
  type UserMemory,
} from '@/types/ai-chat';

/**
 * 长期记忆读写
 * @description 一个用户一个 JSON 文件（.cache/ai-memory/<email>.json）。
 *   选 JSON 而非数据库的原因与会话存储一致：体量小（≤50 条/人）、单机、需要能手工查看与编辑。
 */

/**
 * 用户记忆文件路径
 * @param {string} userEmail - 用户邮箱
 * @returns {string} 文件绝对路径
 */
const memoryFile = (userEmail: string): string => {
  const safe = userEmail.replace(/[^a-zA-Z0-9_.@-]/g, '_');
  return path.join(AI_MEMORY_DIR, `${safe}.json`);
};

/**
 * 确保记忆目录存在
 * @returns {void}
 */
const ensureDir = (): void => {
  if (!fs.existsSync(AI_MEMORY_DIR)) {
    fs.mkdirSync(AI_MEMORY_DIR, { recursive: true });
  }
};

/**
 * 读取用户长期记忆（无文件时返回空集合）
 * @param {string} userEmail - 用户邮箱
 * @returns {UserMemory} 记忆集合
 */
export const readMemory = (userEmail: string): UserMemory => {
  const file = memoryFile(userEmail);
  if (!fs.existsSync(file)) {
    return { user: userEmail, items: [], updated_at: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as UserMemory;
  } catch {
    return { user: userEmail, items: [], updated_at: 0 };
  }
};

/**
 * 写入用户长期记忆
 * @param {UserMemory} memory - 记忆集合
 * @returns {void}
 */
export const writeMemory = (memory: UserMemory): void => {
  try {
    ensureDir();
    memory.updated_at = Date.now();
    fs.writeFileSync(memoryFile(memory.user), JSON.stringify(memory, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[ai-memory] 写入失败：${(err as Error).message}`);
  }
};

/**
 * 淘汰超出上限的记忆
 * @param {MemoryItem[]} items - 记忆条目
 * @returns {MemoryItem[]} 保留下来的条目
 * @description 淘汰策略：先按 hits（被注入次数）升序，再按 updated_at 升序，删最「没人用且最旧」的。
 *   纯按时间淘汰会把高频使用但很早建立的记忆误删，故把 hits 放在第一优先级。
 */
export const pruneMemoryItems = (items: MemoryItem[]): MemoryItem[] => {
  if (items.length <= MAX_MEMORY_ITEMS) return items;
  return [...items]
    .sort((a, b) => a.hits - b.hits || a.updated_at - b.updated_at)
    .slice(items.length - MAX_MEMORY_ITEMS);
};

/**
 * 追加记忆条目（自动去重 + 淘汰）
 * @param {string} userEmail - 用户邮箱
 * @param {string[]} contents - 新增记忆正文列表
 * @param {string} source - 来源会话 ID
 * @returns {MemoryItem[]} 追加后的全部记忆条目
 * @description 去重按正文精确匹配：内容相同则只刷新 updated_at，避免同一事实反复堆积。
 */
export const addMemoryItems = (
  userEmail: string,
  contents: string[],
  source: string,
): MemoryItem[] => {
  const memory = readMemory(userEmail);
  const now = Date.now();
  const existing = new Map(memory.items.map((i) => [i.content, i]));

  for (const raw of contents) {
    const content = raw.trim();
    if (!content) continue;
    const hit = existing.get(content);
    if (hit) {
      hit.updated_at = now;
      continue;
    }
    const item: MemoryItem = {
      id: `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      source,
      created_at: now,
      updated_at: now,
      hits: 0,
    };
    existing.set(content, item);
    memory.items.unshift(item);
  }

  memory.items = pruneMemoryItems(memory.items);
  writeMemory(memory);
  return memory.items;
};

/**
 * 清空用户长期记忆
 * @param {string} userEmail - 用户邮箱
 * @returns {boolean} 是否删除成功（原本没有记忆文件返回 false）
 */
export const clearMemory = (userEmail: string): boolean => {
  const file = memoryFile(userEmail);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
};

/**
 * 取用于注入提示词的记忆正文（按热度取前 N 条）
 * @param {string} userEmail - 用户邮箱
 * @param {number} [limit] - 最多注入条数
 * @returns {string[]} 记忆正文列表
 * @description 注入是「读取」也算一次命中：hits 反映「它出现过多少轮」，是淘汰策略的输入。
 */
export const pickMemoryForPrompt = (userEmail: string, limit = 10): string[] => {
  const memory = readMemory(userEmail);
  if (memory.items.length === 0) return [];
  const now = Date.now();
  const picked = [...memory.items]
    .sort((a, b) => b.hits - a.hits || b.updated_at - a.updated_at)
    .slice(0, limit);
  picked.forEach((i) => { i.hits += 1; i.updated_at = now; });
  writeMemory(memory);
  return picked.map((i) => i.content);
};
