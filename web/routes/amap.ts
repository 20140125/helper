import { Router } from 'express';
import { getAmapKey } from '@/utils/ai-chat/tools/_amap-shared';

const router = Router();

/** 高德静态地图 API */
const STATIC_MAP_URL = 'https://restapi.amap.com/v3/staticmap';

/** 请求超时（毫秒） */
const TIMEOUT_MS = 8000;

/** 坐标串校验：单个 "经度,纬度" */
const isCoord = (v: string): boolean => /^\d{1,3}(\.\d+)?,\d{1,3}(\.\d+)?$/.test(v);

/**
 * 校验静态地图参数
 * @param {Record<string, unknown>} query - 请求 query
 * @returns {{ ok: true; params: URLSearchParams } | { ok: false; message: string }} 校验结果
 * @description 白名单收口参数：不允许前端透传任意 query（例如 key / sig），避免 Key 与权限被绕过
 */
const buildParams = (
  query: Record<string, unknown>,
): { ok: true; params: URLSearchParams } | { ok: false; message: string } => {
  const location = typeof query.location === 'string' ? query.location.trim() : '';
  if (!location || !location.split('|').every(isCoord)) {
    return { ok: false, message: 'location 必填，格式为 "经度,纬度"（多个用 | 分隔）' };
  }

  const zoomRaw = typeof query.zoom === 'string' ? Number(query.zoom) : 12;
  const zoom = Number.isFinite(zoomRaw) ? Math.min(20, Math.max(1, Math.trunc(zoomRaw))) : 12;

  const sizeRaw = typeof query.size === 'string' ? query.size.trim() : '600*400';
  const sizeMatch = /^(\d{1,4})\*(\d{1,4})$/.exec(sizeRaw);
  if (!sizeMatch) return { ok: false, message: 'size 格式应为 "宽*高"，如 600*400' };
  const width = Math.min(1024, Number(sizeMatch[1]));
  const height = Math.min(1024, Number(sizeMatch[2]));

  const params = new URLSearchParams({
    location,
    zoom: String(zoom),
    size: `${width}*${height}`,
    scale: query.scale === '2' ? '2' : '1',
  });

  const markers = typeof query.markers === 'string' ? query.markers.trim() : '';
  // markers 由模型/前端拼出，限制长度防止把长串塞进上游 URL
  if (markers) params.set('markers', markers.slice(0, 300));
  if (query.traffic === '1') params.set('traffic', '1');

  return { ok: true, params };
};

/**
 * 生成高德静态地图图片（服务端代理）
 * @route GET /api/amap-static-map
 * @query location - 中心点或标注点 "经度,纬度"，多个用 | 分隔（必填）
 * @query zoom - 缩放级别 1~20，默认 12
 * @query size - 图片尺寸 "宽*高"，默认 600*400，最大 1024*1024
 * @query markers - 标注，格式见高德文档（可选，最长 300 字符）
 * @query scale - 1 普通 / 2 高清（可选）
 * @query traffic - 1 显示路况（可选）
 * @returns PNG 图片二进制
 * @description 必须走代理：静态地图 URL 要带 AMAP_KEY，直接把链接给前端/模型等于泄露密钥。
 *              这里只接受白名单参数，由服务端补 Key，返回同源图片地址供聊天 Markdown 渲染。
 */
router.get('/', async (req, res) => {
  const key = getAmapKey();
  if (!key) {
    res.status(500).json({ code: 500, data: {}, message: '未配置 AMAP_KEY，无法生成静态地图' });
    return;
  }

  const checked = buildParams(req.query as Record<string, unknown>);
  if (!checked.ok) {
    res.status(400).json({ code: 400, data: {}, message: checked.message });
    return;
  }
  checked.params.set('key', key);

  try {
    const resp = await fetch(`${STATIC_MAP_URL}?${checked.params.toString()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      res.status(502).json({ code: 502, data: {}, message: `高德静态地图请求失败（${resp.status}）` });
      return;
    }
    const contentType = resp.headers.get('content-type') ?? '';
    // 高德出错时返回 JSON（如 INVALID_USER_KEY），此时不该当图片回给前端
    if (!contentType.includes('image')) {
      const text = await resp.text();
      res.status(502).json({ code: 502, data: {}, message: `高德静态地图返回异常：${text.slice(0, 200)}` });
      return;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.end(buf);
  } catch {
    res.status(504).json({ code: 504, data: {}, message: '请求高德静态地图超时' });
  }
});

export default router;
