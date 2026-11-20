/**
 * 高德 Web 服务 API 共享层（内部模块，下划线开头不会被注册为工具）
 * @description 原先 amap_poi 与 amap_route 各抄了一份 Key 读取 / 节流 / 地理编码实现，
 *   新增工具若再抄一份就是三份。这里统一收口：
 *   - Key 读取（进程变量优先 → .env 回退，5 分钟缓存）
 *   - 请求节流 + 超时的 GET（免费 Key 有 QPS 限制）
 *   - 坐标判定与地址 → 坐标解析（带 .cache/amap_geocode.json 缓存，与通勤脚本共用一份）
 */

import fs from 'fs';
import path from 'path';
import { readEnvFile } from '@/routes/utils';
import { PROJECT_DIR } from '@/utils/paths';

/** 高德 Web 服务 API 基础地址 */
export const AMAP_BASE = 'https://restapi.amap.com/v3';

/** 单次请求超时（毫秒） */
const TIMEOUT_MS = 8000;

/** Key 缓存与有效期（避免每次调用都读 .env） */
let cachedKey = '';
let cachedKeyAt = 0;
const KEY_TTL_MS = 5 * 60 * 1000;

/** 未配置 Key 时的统一提示（各工具复用，避免文案不一致） */
export const NO_AMAP_KEY_MSG = '未配置高德 Key：请在 web/.env 中设置 AMAP_KEY（Web 服务 API 类型）';

/**
 * 读取高德 Web 服务 Key
 * @returns {string} Key；未配置返回空串
 * @description 进程环境变量优先（启动时 dotenv 已载入），为空时回退 readEnvFile() 读 web/.env，
 *              这样刚把 Key 写进 .env 还没重启服务也能立刻用
 */
export const getAmapKey = (): string => {
  const now = Date.now();
  if (cachedKey && now - cachedKeyAt < KEY_TTL_MS) return cachedKey;

  const fromProcess = (process.env.AMAP_KEY ?? '').trim();
  // 注意：进程变量可能是空串（而非 undefined），所以这里用 || 而不是 ?? 兜底
  const raw = fromProcess || (readEnvFile().AMAP_KEY ?? '');
  cachedKey = raw.trim().replace(/^["']|["']$/g, '');
  cachedKeyAt = now;
  return cachedKey;
};

/** 两次请求之间的最小间隔：免费 Key 有 QPS 限制，连发会被拒 */
const MIN_REQUEST_INTERVAL_MS = 250;

/** 上次请求时间戳（节流用） */
let lastRequestAt = 0;

/**
 * 请求节流：保证与上一次请求至少间隔 MIN_REQUEST_INTERVAL_MS
 * @returns {Promise<void>} 需要等待时先等待
 */
const throttle = async (): Promise<void> => {
  const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
};

/**
 * 带超时与节流的 GET，返回解析后的 JSON
 * @param {string} url - 完整请求地址
 * @returns {Promise<Record<string, unknown> | null>} 解析结果；请求或解析失败返回 null
 */
export const getAmapJson = async (url: string): Promise<Record<string, unknown> | null> => {
  await throttle();
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!resp.ok) return null;
    return await resp.json() as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** 判断字符串是否已是「经度,纬度」坐标 */
export const isCoord = (v: string): boolean => /^\d+(\.\d+)?\s*,\s*\d+(\.\d+)?$/.test(v.trim());

/** 地理编码缓存文件（与 scripts/tools/commute_card.sh 共用，避免各写一份） */
const GEOCODE_CACHE_FILE = path.join(PROJECT_DIR, '.cache', 'amap_geocode.json');

/** 缓存文件最多保留条数：地址解析结果常年累积，超了从头淘汰最早的 */
const MAX_CACHE_ENTRIES = 200;

/**
 * 读取地理编码缓存
 * @returns {Record<string, string>} 地址 → 坐标；文件缺失或格式异常返回空对象
 */
export const readGeocodeCache = (): Record<string, string> => {
  try {
    if (!fs.existsSync(GEOCODE_CACHE_FILE)) return {};
    const parsed: unknown = JSON.parse(fs.readFileSync(GEOCODE_CACHE_FILE, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
};

/**
 * 写入一条地理编码缓存
 * @param {string} address - 地址文本（缓存 key）
 * @param {string} coord - 坐标 "经度,纬度"
 * @returns {void}
 * @description 写失败静默跳过（缓存只是省额度，不该影响主流程）；
 *   用「临时文件 + rename」保证原子性，避免与脚本并发写坏 JSON
 */
export const writeGeocodeCache = (address: string, coord: string): void => {
  try {
    const cache = readGeocodeCache();
    cache[address] = coord;
    // 超量时按插入顺序淘汰最早的
    const keys = Object.keys(cache);
    const trimmed: Record<string, string> = {};
    for (const k of keys.slice(Math.max(0, keys.length - MAX_CACHE_ENTRIES))) {
      trimmed[k] = cache[k];
    }
    const tmp = `${GEOCODE_CACHE_FILE}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(trimmed, null, 2)}\n`, 'utf-8');
    fs.renameSync(tmp, GEOCODE_CACHE_FILE);
  } catch {
    // 忽略：缓存写失败不影响查询结果
  }
};

/**
 * 把地址解析成「经度,纬度」；本身是坐标则原样返回
 * @param {string} place - 地址文本或坐标
 * @param {string} city - 城市名（提高地理编码准确度，可空）
 * @returns {Promise<string>} 坐标字符串；解析失败返回空串
 * @description 先查本地缓存（与通勤脚本共用），命中就不打接口，省额度
 */
export const toCoord = async (place: string, city: string): Promise<string> => {
  const trimmed = place.trim();
  if (isCoord(trimmed)) return trimmed.replace(/\s/g, '');

  const cached = readGeocodeCache()[trimmed];
  if (cached) return cached;

  const key = getAmapKey();
  if (!key) return '';
  const url = `${AMAP_BASE}/geocode/geo?key=${key}&address=${encodeURIComponent(trimmed)}`
    + (city ? `&city=${encodeURIComponent(city)}` : '');
  const data = await getAmapJson(url);
  const list = data?.geocodes as Array<{ location?: string }> | undefined;
  const coord = list?.[0]?.location ?? '';
  if (coord) writeGeocodeCache(trimmed, coord);
  return coord;
};
