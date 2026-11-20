import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** ip-api.com 查询字段（免费、免 Key，限 45 次/分钟） */
const IP_API_URL = 'http://ip-api.com/json';

/** 本机出口公网 IP 的备选源（前一个失败时依次回退） */
const MY_IP_SOURCES = [
  'https://api.bigdatacloud.net/data/client-ip',
  'https://ifconfig.me/ip',
];

/** 单次查询超时（毫秒） */
const TIMEOUT_MS = 8000;

/** IP 归属信息（ip-api.com 返回字段的子集） */
interface IpGeoInfo {
  query: string;
  country?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  as?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
}

/**
 * 带超时的 GET JSON
 * @param {string} url - 请求地址
 * @returns {Promise<unknown | null>} 解析后的 JSON；失败返回 null
 */
const getJson = async (url: string): Promise<unknown | null> => {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!resp.ok) return null;
    return await resp.json() as unknown;
  } catch {
    return null;
  }
};

/**
 * 探测本机出口公网 IP（多源回退）
 * @returns {Promise<string>} 公网 IP，全部失败返回空串
 */
const detectMyIp = async (): Promise<string> => {
  for (const url of MY_IP_SOURCES) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!resp.ok) continue;
      const text = (await resp.text()).trim();
      // bigdatacloud 返回 {"ipString":"x.x.x.x"}，ifconfig.me 返回纯文本 IP
      const data = JSON.parse(text) as { ipString?: string };
      const ip = data.ipString || (/^\d{1,3}(\.\d{1,3}){3}$/.test(text) ? text : '');
      if (ip) return ip;
    } catch {
      // 换下一个源
    }
  }
  return '';
};

/**
 * query_ip 工具实现
 * @description 查询 IP 归属地，或本机出口公网 IP（运维高频：定位出口 IP、判断来访 IP 来源）。
 *              数据源为免费公开接口，无需 API Key。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "我服务器的出口 IP 是多少"     → {}
 *   - "8.8.8.8 是哪里的"            → { ip: '8.8.8.8' }
 *   - "查一下这个 IP 的运营商"        → { ip: '1.2.3.4' }
 */
export const queryIpTool: ToolImpl = {
  name: 'query_ip',
  description:
    '查询 IP 归属地（国家/地区/城市/运营商/时区），不传 ip 时返回本机出口公网 IP 及其归属。'
    + '数据源为免费公开接口（ip-api.com / bigdatacloud），无需 API Key。'
    + '问"我的公网 IP 是多少""这个 IP 哪里的""访问来源是哪"时用本工具，不要用模型知识猜。',
  parameters: {
    type: 'object',
    properties: {
      ip: {
        type: 'string',
        description: '要查询的 IPv4/IPv6 地址；不传则查询本机出口公网 IP',
      },
    },
  },
  requiredPermissions: ['cache:view'],
  invoke: async (args): Promise<ToolResult> => {
    const rawIp = typeof args.ip === 'string' ? args.ip.trim() : '';

    let targetIp = rawIp;
    if (!targetIp) {
      targetIp = await detectMyIp();
      if (!targetIp) {
        return { ok: false, data: '未能探测到本机出口公网 IP（外网探测源均不可用）' };
      }
    }

    const info = await getJson(`${IP_API_URL}/${encodeURIComponent(targetIp)}?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as,lat,lon,timezone`) as (IpGeoInfo & { status?: string; message?: string }) | null;
    if (!info || info.status !== 'success') {
      return { ok: false, data: `IP 查询失败：${info?.message ?? '接口无响应'}` };
    }

    const location = [info.country, info.regionName, info.city].filter(Boolean).join(' / ');
    return {
      ok: true,
      data: {
        ip: info.query ?? targetIp,
        is_local: !rawIp,
        location: location || '未知',
        country: info.country ?? '',
        country_code: info.countryCode ?? '',
        region: info.regionName ?? '',
        city: info.city ?? '',
        isp: info.isp ?? '',
        org: info.org ?? '',
        asn: info.as ?? '',
        timezone: info.timezone ?? '',
        lat: info.lat,
        lon: info.lon,
      },
      summary: `${info.query ?? targetIp}：${location || '未知归属'}${info.isp ? `，运营商 ${info.isp}` : ''}${!rawIp ? '（本机出口公网 IP）' : ''}`,
    };
  },
};
