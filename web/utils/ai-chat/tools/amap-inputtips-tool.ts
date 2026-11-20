import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import { AMAP_BASE, NO_AMAP_KEY_MSG, getAmapKey, getAmapJson } from './_amap-shared';

/** 单条输入提示（只保留回答用得到的字段） */
interface TipItem {
  name: string;
  district: string;
  address: string;
  location: string;
}

/**
 * amap_inputtips 工具实现（地点输入提示）
 * @description 输入关键字给出候选地点（名称 + 所属区 + 详细地址），对应高德 JS API 的 AutoComplete。
 *   适合「帮我确认这个地点叫什么 / 有哪些候选」这类场景；要具体商户详情走 amap_poi。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "深圳有哪些叫市民中心的地方"  → { keywords: '市民中心', city: '深圳' }
 *   - "孝感站的候选地点"            → { keywords: '孝感站' }
 */
export const amapInputtipsTool: ToolImpl = {
  name: 'amap_inputtips',
  description:
    '高德输入提示：给关键字返回候选地点（名称 / 所属区县 / 详细地址，部分带坐标）。'
    + '用户描述模糊、需要确认"具体是哪个地点"时用；不传 city 则全国范围检索。'
    + '只要候选名字，不查商户详情（详情走 amap_poi）。',
  parameters: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        description: '地点关键字，如"市民中心""深圳北站"',
      },
      city: {
        type: 'string',
        description: '限定城市，如"深圳"；不传则全国检索',
      },
      limit: {
        type: 'number',
        description: '返回条数，默认 8，最多 10',
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
    if (!keywords) {
      return { ok: false, data: '缺少 keywords（要查询的地点关键字）' };
    }
    const city = typeof args.city === 'string' ? args.city.trim() : '';
    const rawLimit = typeof args.limit === 'number' ? args.limit : 8;
    const limit = Math.min(10, Math.max(1, Math.floor(rawLimit)));

    const url = `${AMAP_BASE}/assistant/inputtips?key=${key}&keywords=${encodeURIComponent(keywords)}`
      + `&datatype=all&limit=${limit}`
      + (city ? `&city=${encodeURIComponent(city)}` : '');
    const data = await getAmapJson(url);
    if (!data || data.status !== '1') {
      return { ok: false, data: `输入提示查询失败：${(data?.info as string) ?? '接口无响应'}` };
    }

    const tips = (data.tips ?? []) as Array<Record<string, unknown>>;
    const items: TipItem[] = tips
      .filter((t) => typeof t.name === 'string' && t.name)
      .slice(0, limit)
      .map((t) => ({
        name: String(t.name ?? ''),
        district: String(t.district ?? ''),
        address: typeof t.address === 'string' ? String(t.address) : '',
        location: typeof t.location === 'string' ? String(t.location) : '',
      }));

    if (items.length === 0) {
      return { ok: false, data: `「${keywords}」没有候选地点，可换个关键字或指定 city` };
    }

    const first = items[0];
    return {
      ok: true,
      data: { keyword: keywords, city, tips: items, total: items.length },
      summary: `「${keywords}」候选 ${items.length} 个：${items.slice(0, 5).map((i) => i.name).join('、')}`
        + (first.address ? `；首选 ${first.name}（${first.address}）` : ''),
    };
  },
};
