import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import {
  AMAP_BASE,
  NO_AMAP_KEY_MSG,
  getAmapKey,
  getAmapJson,
  toCoord,
} from './_amap-shared';

/** POI 条目（只取卡片与回答用得到的字段） */
interface PoiItem {
  name: string;
  address: string;
  distance: string;
  type: string;
  location: string;
  tel: string;
}

/**
 * amap_poi 工具实现
 * @description 高德 POI 搜索：给 location 走「周边搜索」，不给则走「关键字搜索」。
 *              问"附近有什么吃的""最近的加油站/充电桩/停车场在哪""某商场怎么走"时用本工具，
 *              不要用模型知识编造商户名称与地址。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "公司附近有什么川菜"          → { keywords: '川菜', location: '公司' }
 *   - "深圳南山区的充电桩"          → { keywords: '充电桩', city: '深圳' }
 *   - "113.93,22.53 一公里内的咖啡" → { keywords: '咖啡', location: '113.93,22.53', radius: 1000 }
 */
export const amapPoiTool: ToolImpl = {
  name: 'amap_poi',
  description:
    '高德 POI 搜索：按关键字查地点，给 location 时按该点周边查找（可指定半径）。'
    + '返回名称、地址、距离、类型、坐标与电话；问"附近有什么吃的""最近的加油站在哪"时用。'
    + '禁止凭模型知识编造商户与地址；用法与限制见 amap 技能。',
  parameters: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        description: '搜索关键字，如"川菜""充电桩""停车场""星巴克"',
      },
      city: {
        type: 'string',
        description: '城市名（关键字搜索时用于限定范围，能提高准确度）',
      },
      location: {
        type: 'string',
        description: '中心点：中文地址或"经度,纬度"；给了就按周边搜索',
      },
      radius: {
        type: 'number',
        description: '周边搜索半径（米），默认 1000，最大 50000',
      },
      types: {
        type: 'string',
        description: 'POI 类型编码（如"餐饮服务""加油站"），可选，与 keywords 二选一或同时给',
      },
      offset: {
        type: 'number',
        description: '返回条数，默认 8，最大 25',
      },
    },
    required: ['keywords'],
  },
  invoke: async (args): Promise<ToolResult> => {
    const key = getAmapKey();
    if (!key) {
      return { ok: false, data: NO_AMAP_KEY_MSG };
    }

    const keywords = typeof args.keywords === 'string' ? args.keywords.trim() : '';
    if (!keywords) return { ok: false, data: '缺少搜索关键字' };

    const city = typeof args.city === 'string' ? args.city.trim() : '';
    const locationRaw = typeof args.location === 'string' ? args.location.trim() : '';
    const types = typeof args.types === 'string' ? args.types.trim() : '';
    const radiusRaw = typeof args.radius === 'number' ? args.radius : 1000;
    const radius = Math.min(Math.max(Math.trunc(radiusRaw), 100), 50000);
    const offsetRaw = typeof args.offset === 'number' ? args.offset : 8;
    const offset = Math.min(Math.max(Math.trunc(offsetRaw), 1), 25);

    // 给了周边点就走周边搜索（around），否则走关键字搜索（text）
    let url = '';
    let center = '';
    if (locationRaw) {
      center = await toCoord(locationRaw, city);
      if (!center) {
        return { ok: false, data: `中心点解析失败：「${locationRaw}」，可改用"经度,纬度"或补上 city` };
      }
      url = `${AMAP_BASE}/place/around?key=${key}&location=${center}&radius=${radius}&offset=${offset}`
        + `&keywords=${encodeURIComponent(keywords)}`
        + (types ? `&types=${encodeURIComponent(types)}` : '');
    } else {
      url = `${AMAP_BASE}/place/text?key=${key}&keywords=${encodeURIComponent(keywords)}&offset=${offset}`
        + (city ? `&city=${encodeURIComponent(city)}` : '')
        + (types ? `&types=${encodeURIComponent(types)}` : '');
    }

    const data = await getAmapJson(url);
    if (!data || data.status !== '1') {
      return { ok: false, data: `高德 POI 搜索失败：${(data?.info as string) ?? '接口无响应'}` };
    }

    const pois = (data.pois ?? []) as Array<Record<string, unknown>>;
    if (pois.length === 0) {
      return { ok: true, data: { mode: locationRaw ? 'around' : 'text', center, total: 0, pois: [] }, summary: '没有找到匹配地点' };
    }

    const items: PoiItem[] = pois.slice(0, offset).map((p) => ({
      name: String(p.name ?? ''),
      address: String(p.address ?? ''),
      distance: p.distance ? `${p.distance} 米` : '',
      type: String(p.type ?? ''),
      location: String(p.location ?? ''),
      tel: String(p.tel ?? ''),
    }));

    const first = items[0];
    return {
      ok: true,
      data: {
        mode: locationRaw ? 'around' : 'text',
        center,
        radius_m: locationRaw ? radius : undefined,
        keywords,
        total: Number(data.count ?? pois.length),
        pois: items,
      },
      summary: `找到 ${items.length} 个地点，最近的是「${first.name}」`
        + (first.address ? `（${first.address}）` : '')
        + (first.distance ? `，距中心 ${first.distance}` : ''),
    };
  },
};
