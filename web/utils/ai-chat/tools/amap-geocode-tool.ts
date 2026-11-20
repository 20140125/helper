import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import {
  AMAP_BASE,
  NO_AMAP_KEY_MSG,
  getAmapKey,
  getAmapJson,
  isCoord,
  readGeocodeCache,
  writeGeocodeCache,
} from './_amap-shared';

/**
 * amap_geocode 工具实现（地址 ↔ 坐标）
 * @description 正向（地址→坐标）与逆地理（坐标→地址）二合一：
 *   - "XX 的经纬度是多少""把这个地址转成坐标" → address
 *   - "113.93,22.53 是哪儿""这个坐标对应什么地址" → location
 *   正向结果写入 .cache/amap_geocode.json（与通勤脚本共用，命中缓存不再打接口，省额度）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "深圳北站的坐标"              → { address: '深圳北站' }
 *   - "113.93,22.53 是什么地方"     → { location: '113.93,22.53' }
 *   - "深圳市民中心在哪（要坐标）"   → { address: '深圳市民中心', city: '深圳' }
 */
export const amapGeocodeTool: ToolImpl = {
  name: 'amap_geocode',
  description:
    '高德地理编码：地址 → 坐标（传 address），或坐标 → 详细地址（传 location）。'
    + '返回坐标、格式化地址、所属省市区与 adcode；问"XX 的坐标""这个经纬度是哪儿"时用。'
    + '地址解析结果会缓存，重复查询不额外消耗额度。',
  parameters: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: '要解析成坐标的中文地址（与 location 二选一）',
      },
      location: {
        type: 'string',
        description: '要反查地址的坐标 "经度,纬度"（与 address 二选一）',
      },
      city: {
        type: 'string',
        description: '城市名（正向解析时提高准确度，可空）',
      },
    },
  },
  invoke: async (args): Promise<ToolResult> => {
    const key = getAmapKey();
    if (!key) {
      return { ok: false, data: NO_AMAP_KEY_MSG };
    }

    const address = typeof args.address === 'string' ? args.address.trim() : '';
    const location = typeof args.location === 'string' ? args.location.trim().replace(/\s/g, '') : '';
    const city = typeof args.city === 'string' ? args.city.trim() : '';

    if (!address && !location) {
      return { ok: false, data: '需要 address（地址→坐标）或 location（坐标→地址），两者都未提供' };
    }
    if (location && !isCoord(location)) {
      return { ok: false, data: `坐标格式不正确：${location}，应为"经度,纬度"，如 113.93,22.53` };
    }

    // ── 逆向：坐标 → 地址 ──
    if (location) {
      const url = `${AMAP_BASE}/geocode/regeo?key=${key}&location=${encodeURIComponent(location)}&extensions=base`;
      const data = await getAmapJson(url);
      if (!data || data.status !== '1') {
        return { ok: false, data: `逆地理编码失败：${(data?.info as string) ?? '接口无响应'}` };
      }
      const regeo = data.regeocode as Record<string, unknown> | undefined;
      const comp = (regeo?.addressComponent ?? {}) as Record<string, unknown>;
      const formatted = String(regeo?.formatted_address ?? '');
      if (!formatted) return { ok: false, data: '该坐标没有解析到地址（可能在海域或境外）' };
      return {
        ok: true,
        data: {
          location,
          formatted_address: formatted,
          province: String(comp.province ?? ''),
          city: String(comp.city ?? comp.province ?? ''),
          district: String(comp.district ?? ''),
          adcode: String(comp.adcode ?? ''),
        },
        summary: `${location} → ${formatted}`,
      };
    }

    // ── 正向：地址 → 坐标（先查缓存） ──
    const cacheKey = city ? `${address}` : address;
    const cached = readGeocodeCache()[cacheKey];
    if (cached) {
      return {
        ok: true,
        data: { address, location: cached, from_cache: true },
        summary: `${address} → ${cached}（本地缓存）`,
      };
    }

    const url = `${AMAP_BASE}/geocode/geo?key=${key}&address=${encodeURIComponent(address)}`
      + (city ? `&city=${encodeURIComponent(city)}` : '');
    const data = await getAmapJson(url);
    if (!data || data.status !== '1') {
      return { ok: false, data: `地理编码失败：${(data?.info as string) ?? '接口无响应'}` };
    }
    const list = (data.geocodes ?? []) as Array<Record<string, unknown>>;
    if (list.length === 0) {
      return { ok: false, data: `没能解析出「${address}」的坐标，可补充 city 参数或换个更完整的地址` };
    }
    const first = list[0];
    const coord = String(first.location ?? '');
    if (!coord) {
      return { ok: false, data: `「${address}」返回的结果里没有坐标` };
    }
    writeGeocodeCache(cacheKey, coord);

    return {
      ok: true,
      data: {
        address,
        location: coord,
        level: String(first.level ?? ''),
        formatted_address: String(first.formatted_address ?? ''),
        province: String(first.province ?? ''),
        city: String(first.city ?? ''),
        district: String(first.district ?? ''),
        adcode: String(first.adcode ?? ''),
        from_cache: false,
      },
      summary: `${address} → ${coord}（${String(first.formatted_address ?? '')}）`,
    };
  },
};
