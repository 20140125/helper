import {
  DEFAULT_KNOWLEDGE_DIRS,
  type KnowledgeConfig,
} from '@/types/knowledge';
import { formatTimestamp } from './time';
import { readCacheJson, writeCacheJson } from '@/utils/database/cache-store';

/** 索引目录配置缓存键（真源为 已有业务表） */
const KNOWLEDGE_CONFIG_KEY = 'knowledge_config.json';

/**
 * 读取索引目录配置
 * @returns {Promise<KnowledgeConfig>} 当前配置；缓存缺失或损坏时返回默认配置
 * @description 真源为缓存 KV，不再触碰磁盘文件
 */
export const readKnowledgeDirs = async (): Promise<KnowledgeConfig> => {
  const fallback: KnowledgeConfig = { dirs: [...DEFAULT_KNOWLEDGE_DIRS], updated_at: '' };
  const parsed = await readCacheJson<Partial<KnowledgeConfig>>(KNOWLEDGE_CONFIG_KEY);
  if (!parsed || !Array.isArray(parsed.dirs) || parsed.dirs.length === 0) return fallback;
  const dirs = parsed.dirs.filter((d): d is string => typeof d === 'string' && Boolean(d.trim()));
  return dirs.length ? { dirs, updated_at: parsed.updated_at ?? '' } : fallback;
};

/**
 * 校验并规范化索引目录列表
 * @param {string[]} raw - 原始目录列表（相对项目根）
 * @returns {string[] | null} 规范化后的目录列表；非法时返回 null
 * @description 仅允许项目根内的相对路径，拒绝绝对路径与上级目录引用
 */
export const normalizeKnowledgeDirs = (raw: string[]): string[] | null => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const dir = item.trim().replace(/^\.\//, '').replace(/\/$/, '');
    if (!dir || dir.startsWith('/') || dir.includes('\\') || dir.includes('..') || dir.includes('\0')) return null;
    if (!out.includes(dir)) out.push(dir);
  }
  return out.length ? out : null;
};

/**
 * 写入索引目录配置
 * @param {string[]} dirs - 已规范化的目录列表
 * @returns {Promise<KnowledgeConfig>} 写入后的配置
 * @description 通过缓存 KV 覆盖，序列化格式与旧版一致（2 空格缩进）
 */
export const writeKnowledgeDirs = async (dirs: string[]): Promise<KnowledgeConfig> => {
  const config: KnowledgeConfig = { dirs, updated_at: formatTimestamp(new Date()) };
  await writeCacheJson(KNOWLEDGE_CONFIG_KEY, config);
  return config;
};
