import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import {
  AMAP_BASE,
  NO_AMAP_KEY_MSG,
  getAmapKey,
  getAmapJson,
  toCoord,
} from './_amap-shared';

/**
 * 秒 → 「x 小时 y 分钟」中文文案
 * @param {number} seconds - 秒数
 * @returns {string} 人类可读时长
 */
const humanDuration = (seconds: number): string => {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} 分钟`;
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分钟`;
};

/**
 * 米 → 「x.x 公里」中文文案
 * @param {number} meters - 米
 * @returns {string} 人类可读距离
 */
const humanDistance = (meters: number): string => `${(meters / 1000).toFixed(1)} 公里`;

/**
 * amap_route 工具实现
 * @description 高德路线规划（驾车 / 公交 / 步行 / 骑行），起点终点可写中文地址或坐标。
 *              问"从 A 到 B 多久""怎么坐地铁去""开车多少公里"时用本工具，
 *              不要用模型知识估算路程与耗时。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "从公司到宝安机场开车要多久"      → { origin: '公司', destination: '深圳宝安机场', mode: 'driving' }
 *   - "怎么坐地铁去市民中心"           → { origin: '...', destination: '市民中心', mode: 'transit', city: '深圳' }
 *   - "113.9,22.5 到 114.0,22.6 骑单车" → { origin: '113.9,22.5', destination: '114.0,22.6', mode: 'bicycling' }
 */
export const amapRouteTool: ToolImpl = {
  name: 'amap_route',
  description:
    '高德路线规划：返回距离、预计耗时与关键步骤；起点终点支持中文地址或"经度,纬度"。'
    + '问"从 A 到 B 多久""开车多少公里"时用本工具，禁止凭模型知识估算路程与耗时。'
    + '出行方式（mode）与当前 Key 的开通限制见 amap 技能。',
  parameters: {
    type: 'object',
    properties: {
      origin: {
        type: 'string',
        description: '起点：中文地址或"经度,纬度"',
      },
      destination: {
        type: 'string',
        description: '终点：中文地址或"经度,纬度"',
      },
      mode: {
        type: 'string',
        description: '出行方式：driving 驾车 / transit 公交地铁 / walking 步行 / bicycling 骑行，默认 driving',
      },
      city: {
        type: 'string',
        description: '城市名（公交模式必填；地址解析时也能提高准确度）',
      },
    },
    required: ['origin', 'destination'],
  },
  invoke: async (args): Promise<ToolResult> => {
    const key = getAmapKey();
    if (!key) {
      return { ok: false, data: NO_AMAP_KEY_MSG };
    }

    const originRaw = typeof args.origin === 'string' ? args.origin.trim() : '';
    const destRaw = typeof args.destination === 'string' ? args.destination.trim() : '';
    if (!originRaw || !destRaw) {
      return { ok: false, data: '缺少起点或终点' };
    }

    const modeRaw = typeof args.mode === 'string' ? args.mode.trim().toLowerCase() : 'driving';
    const mode = ['driving', 'transit', 'walking', 'bicycling'].includes(modeRaw) ? modeRaw : 'driving';
    const city = typeof args.city === 'string' ? args.city.trim() : '';

    if (mode === 'transit' && !city) {
      return { ok: false, data: '公交模式需要 city 参数（如"深圳"）' };
    }

    const origin = await toCoord(originRaw, city);
    const destination = await toCoord(destRaw, city);
    if (!origin || !destination) {
      return { ok: false, data: `地址解析失败：起点「${originRaw}」或终点「${destRaw}」没能解析出坐标，可改用"经度,纬度"或补上 city` };
    }

    const url = `${AMAP_BASE}/direction/${mode}?key=${key}&origin=${origin}&destination=${destination}`
      + (mode === 'transit' ? `&city=${encodeURIComponent(city)}&strategy=0&nightflag=0` : '&extensions=base');
    const data = await getAmapJson(url);
    if (!data || data.status !== '1') {
      const info = (data?.info as string) ?? '接口无响应';
      // 公交路径规划是单独的权限包，免费 Key 常见 INSUFFICIENT_PRIVILEGES
      if (info.includes('INSUFFICIENT_PRIVILEGES')) {
        return { ok: false, data: '当前高德 Key 未开通该出行方式的权限（公交/地铁需要单独开通）。可改用 driving / walking / bicycling' };
      }
      return { ok: false, data: `高德路线规划失败：${info}` };
    }

    const route = data.route as Record<string, unknown> | undefined;
    if (!route) return { ok: false, data: '高德未返回路线（起终点可能过近或不支持该方式）' };

    // 公交：transits 数组；其余模式：paths 数组
    if (mode === 'transit') {
      const transits = (route.transits ?? []) as Array<Record<string, unknown>>;
      if (transits.length === 0) return { ok: false, data: '未找到公交/地铁方案' };
      const first = transits[0];
      const duration = Number(first.duration ?? 0);
      const distance = Number(first.distance ?? 0);
      const lines: string[] = [];
      const segments = (first.segments ?? []) as Array<Record<string, unknown>>;
      segments.forEach((seg) => {
        const bus = seg.bus as Record<string, unknown> | undefined;
        const buslines = (bus?.buslines ?? []) as Array<Record<string, unknown>>;
        buslines.forEach((line) => {
          const name = String(line.name ?? '');
          if (name) lines.push(name);
        });
      });
      return {
        ok: true,
        data: {
          mode: 'transit',
          origin,
          destination,
          distance_m: distance,
          duration_s: duration,
          transit_lines: lines,
          walking_distance_m: Number(first.walking_distance ?? 0),
          cost: String(first.cost ?? ''),
        },
        summary: `公交/地铁约 ${humanDuration(duration)}，全程 ${humanDistance(distance)}`
          + (lines.length ? `，换乘线路：${lines.slice(0, 4).join(' → ')}` : ''),
      };
    }

    const paths = (route.paths ?? []) as Array<Record<string, unknown>>;
    if (paths.length === 0) return { ok: false, data: '未找到路线' };
    const first = paths[0];
    const distance = Number(first.distance ?? 0);
    const duration = Number(first.duration ?? 0);
    const steps = (first.steps ?? []) as Array<{ instruction?: string }>;
    const instructions = steps.slice(0, 6).map((s) => s.instruction ?? '').filter(Boolean);
    const taxiCost = mode === 'driving' ? String(route.taxi_cost ?? '') : '';

    return {
      ok: true,
      data: {
        mode,
        origin,
        destination,
        distance_m: distance,
        duration_s: duration,
        taxi_cost: taxiCost,
        steps: instructions,
      },
      summary: `${mode === 'driving' ? '驾车' : mode === 'walking' ? '步行' : '骑行'} ${humanDistance(distance)}，`
        + `约 ${humanDuration(duration)}`
        + (taxiCost ? `，打车约 ${taxiCost} 元` : '')
        + (instructions.length ? `；前几步：${instructions.slice(0, 3).join('；')}` : ''),
    };
    },
};
