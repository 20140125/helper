import {
  AI_MEMORY_PREFIX,
  MAX_MEMORY_ITEMS,
  type MemoryItem,
  type UserMemory,
} from '@/types/ai-chat';
import {
  cacheKeyExists,
  deleteCacheKey,
  readCacheJson,
  writeCacheJson,
} from '@/utils/database/cache-store';

/**
 * 长期记忆读写
 * @description 一个用户一个缓存键（ai-memory/<email>.json），真源为 已有业务表。
 *   体量小（≤50 条/人）、单机、按用户整体读写，故用 KV 存整个 JSON。
 */

/**
 * 清洗用户邮箱，生成安全的缓存键片段
 * @param {string} userEmail - 用户邮箱
 * @returns {string} 不含路径分隔符与连续点的键片段
 */
const safeUser = (userEmail: string): string =>
  userEmail.replace(/[^a-zA-Z0-9_.@-]/g, '_').replace(/\.{2,}/g, '.');

/**
 * 用户记忆缓存键
 * @param {string} userEmail - 用户邮箱
 * @returns {string} 形如 ai-memory/<email>.json 的缓存键
 */
const memoryKey = (userEmail: string): string =>
  `${AI_MEMORY_PREFIX}${safeUser(userEmail)}.json`;

/**
 * 读取用户长期记忆（无记录时返回空集合）
 * @param {string} userEmail - 用户邮箱
 * @returns {Promise<UserMemory>} 记忆集合
 */
export const readMemory = async (userEmail: string): Promise<UserMemory> => {
  const empty = (): UserMemory => ({ user: userEmail, items: [], updated_at: 0 });
  try {
    const memory = await readCacheJson<UserMemory>(memoryKey(userEmail));
    if (!memory || !Array.isArray(memory.items)) return empty();
    return memory;
  } catch (err) {
    console.warn(`[ai-memory] 读取失败：${(err as Error).message}`);
    return empty();
  }
};

/**
 * 写入用户长期记忆
 * @param {UserMemory} memory - 记忆集合
 * @returns {Promise<void>}
 */
export const writeMemory = async (memory: UserMemory): Promise<void> => {
  try {
    memory.updated_at = Date.now();
    await writeCacheJson(memoryKey(memory.user), memory);
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
 * @returns {Promise<MemoryItem[]>} 追加后的全部记忆条目
 * @description 去重按正文精确匹配：内容相同则只刷新 updated_at，避免同一事实反复堆积。
 */
export const addMemoryItems = async (
  userEmail: string,
  contents: string[],
  source: string,
): Promise<MemoryItem[]> => {
  const memory = await readMemory(userEmail);
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
  await writeMemory(memory);
  return memory.items;
};

/**
 * 清空用户长期记忆
 * @param {string} userEmail - 用户邮箱
 * @returns {Promise<boolean>} 是否删除成功（原本没有记忆记录返回 false）
 */
export const clearMemory = async (userEmail: string): Promise<boolean> => {
  const key = memoryKey(userEmail);
  if (!(await cacheKeyExists(key))) return false;
  await deleteCacheKey(key);
  return true;
};

/**
 * 取用于注入提示词的记忆正文（按热度取前 N 条）
 * @param {string} userEmail - 用户邮箱
 * @param {number} [limit] - 最多注入条数
 * @returns {Promise<string[]>} 记忆正文列表
 * @description 注入是「读取」也算一次命中：hits 反映「它出现过多少轮」，是淘汰策略的输入。
 */
export const pickMemoryForPrompt = async (userEmail: string, limit = 10): Promise<string[]> => {
  const memory = await readMemory(userEmail);
  if (memory.items.length === 0) return [];
  const now = Date.now();
  const picked = [...memory.items]
    .sort((a, b) => b.hits - a.hits || b.updated_at - a.updated_at)
    .slice(0, limit);
  picked.forEach((i) => { i.hits += 1; i.updated_at = now; });
  await writeMemory(memory);
  return picked.map((i) => i.content);
};
