import fs from 'fs';
import { Rule, RULES_FILE } from '@/types/rule';
import { Webhook, WEBHOOKS_FILE } from '@/types/webhook';
import { CACHE_DIR } from './paths';

/**
 * 读取自定义规则列表
 * @returns {Rule[]} 规则列表
 */
export const readRules = (): Rule[] => {
  if (!fs.existsSync(RULES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8')) as Rule[];
  } catch {
    return [];
  }
};

/**
 * 写入自定义规则列表
 * @param {Rule[]} rules - 规则列表
 */
export const writeRules = (rules: Rule[]): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
};

/**
 * 读取 Webhook 列表（兼容旧版驼峰字段，统一转为蛇形命名）
 * @returns {Webhook[]} Webhook 列表
 */
export const readWebhooks = (): Webhook[] => {
  if (!fs.existsSync(WEBHOOKS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(WEBHOOKS_FILE, 'utf-8')) as Record<string, unknown>[];
    return raw.map((item) => ({
      id: (item.id as string) ?? '',
      name: (item.name as string) ?? '',
      url: (item.url as string) ?? '',
      style: (item.style as string) ?? '',
      created_at: (item.created_at as string) ?? (item.createdAt as string) ?? '',
      updated_at: (item.updated_at as string) ?? (item.updatedAt as string) ?? '',
    }));
  } catch {
    return [];
  }
};

/**
 * 写入 Webhook 列表
 * @param {Webhook[]} webhooks - Webhook 列表
 */
export const writeWebhooks = (webhooks: Webhook[]): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf-8');
};
