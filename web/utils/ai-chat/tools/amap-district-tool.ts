import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import { AMAP_BASE, NO_AMAP_KEY_MSG, getAmapKey, getAmapJson } from './_amap-shared';

/** 行政区条目 */
interface DistrictItem {
  name: string;
  adcode: string;
  level: string;
  center: string;
}

/**
 * amap_district 工具实现（行政区划查询）
 * @description 查省 / 市 / 区的行政编码（adcode）与中心坐标，对应高德 JS API 的 DistrictSearch。
 *   adcode 是后续天气、区划统计等接口的入参；用户问"XX 属于哪个区""深圳的 adcode"时用。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "深圳的行政区划编码"        → { keywords: '深圳' }
 *   - "深圳南山区下面有哪些街道"  → { keywords: '南山区', subdistrict: 1 }
 */
export const amapDistrictTool: ToolImpl = {
  name: 'amap_district',
  description:
    '高德行政区划查询：返回省/市/区的 adcode、级别与中心坐标，可选带回下级行政区。'
    + '问"XX 的行政区划编码""深圳有哪些区""XX 属于哪个市"时用；subdistrict=1 会带上子级。',
  parameters: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        description: '行政区名称，如"广东""深圳""南山区"；也接受 adcode',
      },
      subdistrict: {
        type: 'number',
        description: '是否返回下级：0 不返回（默认）/ 1 返回下一级 / 2 返回下两级',
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
      return { ok: false, data: '缺少 keywords（要查询的行政区名称或 adcode）' };
    }
    const rawLevel = typeof args.subdistrict === 'number' ? args.subdistrict : 0;
    const subdistrict = [0, 1, 2].includes(rawLevel) ? rawLevel : 0;

    const url = `${AMAP_BASE}/config/district?key=${key}&keywords=${encodeURIComponent(keywords)}`
      + `&subdistrict=${subdistrict}&extensions=base`;
    const data = await getAmapJson(url);
    if (!data || data.status !== '1') {
      return { ok: false, data: `行政区划查询失败：${(data?.info as string) ?? '接口无响应'}` };
    }

    const list = (data.districts ?? []) as Array<Record<string, unknown>>;
    if (list.length === 0) {
      return { ok: false, data: `没有查到「${keywords}」对应的行政区，可换全称（如"深圳市"）` };
    }

    const mapItem = (d: Record<string, unknown>): DistrictItem => ({
      name: String(d.name ?? ''),
      adcode: String(d.adcode ?? ''),
      level: String(d.level ?? ''),
      center: String(d.center ?? ''),
    });

    const districts: Array<DistrictItem & { children?: DistrictItem[] }> = list.map((d) => {
      const item = mapItem(d);
      if (subdistrict === 0) return item;
      const children = ((d.districts ?? []) as Array<Record<string, unknown>>).map(mapItem);
      return children.length > 0 ? { ...item, children } : item;
    });

    const first = districts[0];
    const childNames = first.children?.map((c) => c.name) ?? [];
    return {
      ok: true,
      data: { keyword: keywords, districts },
      summary: `${first.name}（adcode ${first.adcode}，级别 ${first.level}）`
        + (childNames.length ? `，下辖 ${childNames.length} 项：${childNames.slice(0, 8).join('、')}` : ''),
    };
  },
};
