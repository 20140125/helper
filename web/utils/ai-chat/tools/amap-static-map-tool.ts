import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import { NO_AMAP_KEY_MSG, getAmapKey, isCoord, toCoord } from './_amap-shared';

/** 代理地址前缀（同源相对路径，聊天里可直接当图片渲染，且不暴露 AMAP_KEY） */
const PROXY_PATH = '/api/amap-static-map';

/** 尺寸上限（与服务端白名单一致） */
const MAX_SIZE = 1024;

/**
 * amap_static_map 工具实现（静态地图出图）
 * @description 返回一张标注了位置的静态地图图片地址（走本站代理 /api/amap-static-map，
 *   由服务端补 AMAP_KEY，回答里不会出现密钥）。对应高德 JS API 的地图可视化能力。
 *   用户想"看看在哪 / 出张地图"时用；只给坐标能出图，给地址会先解析成坐标。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "看看深圳北站的位置"      → { location: '深圳北站' }
 *   - "出一张市民中心的地图"     → { location: '深圳市民中心', zoom: 15 }
 *   - "标出公司与家的位置"       → { location: '113.93,22.53|114.02,22.60', markers: '...' }
 */
export const amapStaticMapTool: ToolImpl = {
  name: 'amap_static_map',
  description:
    '生成一张高德静态地图图片（返回本站图片地址，可直接展示给用户）。'
    + 'location 支持中文地址或"经度,纬度"，多个点用 | 分隔；可选 zoom / size / traffic。'
    + '用户要"看看在哪""出张地图""标一下位置"时用；不要自己描述经纬度代替出图。',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: '中心点：中文地址或"经度,纬度"，多个点用 | 分隔',
      },
      zoom: {
        type: 'number',
        description: '缩放级别 1~20，默认 12（越大越近）',
      },
      size: {
        type: 'string',
        description: '图片尺寸 "宽*高"，默认 600*400，最大 1024*1024',
      },
      markers: {
        type: 'string',
        description: '自定义标注（高德 markers 语法）："size,颜色,标签|经度,纬度|..."',
      },
      traffic: {
        type: 'boolean',
        description: '是否叠加实时路况，默认 false',
      },
    },
    required: ['location'],
  },
  invoke: async (args): Promise<ToolResult> => {
    if (!getAmapKey()) {
      return { ok: false, data: NO_AMAP_KEY_MSG };
    }

    const location = typeof args.location === 'string' ? args.location.trim() : '';
    if (!location) {
      return { ok: false, data: '缺少 location（要标注的地点或坐标）' };
    }

    // 地址 → 坐标（坐标原样保留）；多段逐个解析，任一段失败即报错，避免出张错位地图
    const parts = location.split('|').map((s) => s.trim()).filter(Boolean);
    const resolved: string[] = [];
    for (const part of parts) {
      if (isCoord(part)) {
        resolved.push(part.replace(/\s/g, ''));
        continue;
      }
      const coord = await toCoord(part, '');
      if (!coord) {
        return { ok: false, data: `「${part}」没能解析成坐标，请改用"经度,纬度"或更完整的地址` };
      }
      resolved.push(coord);
    }

    const query = new URLSearchParams({ location: resolved.join('|') });
    const zoomRaw = typeof args.zoom === 'number' ? args.zoom : 12;
    if (Number.isFinite(zoomRaw)) {
      query.set('zoom', String(Math.min(20, Math.max(1, Math.trunc(zoomRaw)))));
    }
    const sizeRaw = typeof args.size === 'string' ? args.size.trim() : '';
    if (sizeRaw) {
      const m = /^(\d{1,4})\*(\d{1,4})$/.exec(sizeRaw);
      if (!m) return { ok: false, data: 'size 格式应为 "宽*高"，如 600*400' };
      query.set('size', `${Math.min(MAX_SIZE, Number(m[1]))}*${Math.min(MAX_SIZE, Number(m[2]))}`);
    }
    if (typeof args.markers === 'string' && args.markers.trim()) {
      query.set('markers', args.markers.trim().slice(0, 300));
    }
    if (args.traffic === true) query.set('traffic', '1');

    const url = `${PROXY_PATH}?${query.toString()}`;
    return {
      ok: true,
      data: { image_url: url, location: resolved.join('|'), zoom: Number(zoomRaw) || 12 },
      summary: `已生成地图（${resolved.join(' / ')}）：${url}`,
    };
  },
};
