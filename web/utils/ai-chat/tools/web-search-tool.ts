import { getLlmConfigForModel } from '@/utils/ai-chat/llm-client';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 智谱 /web_search 接口请求体 */
interface ZhipuWebSearchBody {
  search_engine: string;
  search_query: string;
  count?: number;
  search_recency_filter?: string;
  content_size?: 'medium' | 'high';
}

/** 智谱 /web_search 单条结果 */
interface ZhipuSearchHit {
  title?: string;
  link?: string;
  content?: string;
  media?: string;
  refer?: string;
  publish_date?: string;
}

/** 智谱 /web_search 响应体 */
interface ZhipuWebSearchResp {
  id?: string;
  request_id?: string;
  search_intent?: Array<{ query?: string; intent?: string; keywords?: string }>;
  search_result?: ZhipuSearchHit[];
}

/** 单条结果摘要长度上限（避免回灌给 LLM 时上下文爆炸） */
const SNIPPET_LIMIT = 500;

/** 默认返回条数 */
const DEFAULT_COUNT = 5;

/** 最大返回条数 */
const MAX_COUNT = 10;

/** 引擎别名归一映射（兼容 LLM 偶尔写成 std / pro） */
const ENGINE_ALIAS: Record<string, string> = {
  std: 'search-std',
  pro: 'search-pro',
  'search-std': 'search-std',
  'search-pro': 'search-pro',
};

/**
 * 把 LLM 输入的 engine 参数归一为智谱官方 search_engine 值
 * @param {unknown} raw - 原始入参
 * @returns {string} 规范化的 search_engine
 */
const normalizeEngine = (raw: unknown): string => {
  const key = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return ENGINE_ALIAS[key] ?? 'search-std';
};

/**
 * 截断超长字符串
 * @param {string | undefined} s - 原始字符串
 * @param {number} max - 最大长度
 * @returns {string} 截断后字符串
 */
const truncate = (s: string | undefined, max: number): string => {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

/**
 * 调用智谱 /web_search 接口
 * @param {ZhipuWebSearchBody} body - 请求体
 * @returns {Promise<ZhipuWebSearchResp>} 响应
 */
const callZhipuSearch = async (body: ZhipuWebSearchBody): Promise<ZhipuWebSearchResp> => {
  const cfg = getLlmConfigForModel(undefined);
  if (!cfg.apiKey) {
    throw new Error('模型配置未填写 API Key，请到「系统配置 → AI 模型与记忆」补全');
  }
  const resp = await fetch(`${cfg.baseUrl}/web_search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`智谱搜索失败：${resp.status} ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as ZhipuWebSearchResp;
};

/**
 * web_search 工具实现
 * @description 调用智谱 search-std / search-pro 进行联网检索，
 *              返回精简后的标题/链接/摘要，供 LLM 进一步总结回答。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "今天 A 股大盘怎么样？"                  → { query: 'A 股 今日大盘' }
 *   - "搜一下 GPT-5 发布会有什么新东西"         → { query: 'GPT-5 发布会', engine: 'search-pro' }
 */
export const webSearchTool: ToolImpl = {
  name: 'web_search',
  description:
    '联网搜索（适用于search-std,search-pro,search-pro-quark,search-pro-sogou模型的推理）。当用户问到时效性信息（新闻、行情、最新动态、'
    + '某事件背景）或本地知识不足时使用。默认 search-std 性价比高；需要更高质量结果时用 search-pro。'
    + '不要用本工具做站内查询（站内日志/规则/缓存请用对应工具）。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '检索关键词或自然语言问题',
      },
      engine: {
        type: 'string',
        enum: ['search-std','search-pro','search-pro-quark','search-pro-sogou'],
        description: '检索引擎，默认 search-std，search-pro 质量更高，search-pro-quark 和 search-pro-sogou 为特定渠道。',
      },
      count: {
        type: 'number',
        description: `返回条数，默认 ${DEFAULT_COUNT}，最大 ${MAX_COUNT}`,
      },
      recency: {
        type: 'string',
        enum: ['oneDay', 'oneWeek', 'oneMonth', 'oneYear', 'noLimit'],
        description: '时效过滤，默认 noLimit；问"今天/最新"类问题建议传 oneDay 或 oneWeek',
      },
    },
    required: ['query'],
  },
  requiredPermissions: ['ai-web-search:view'],
  invoke: async (args): Promise<ToolResult> => {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return { ok: false, data: 'query 不能为空' };
    }
    const engine = normalizeEngine(args.engine);
    const rawCount = typeof args.count === 'number' ? args.count : DEFAULT_COUNT;
    const count = Math.max(1, Math.min(MAX_COUNT, Math.floor(rawCount)));
    const recency = typeof args.recency === 'string' ? args.recency : undefined;

    const body: ZhipuWebSearchBody = {
      search_engine: engine,
      search_query: query,
      count,
      content_size: 'medium',
    };
    if (recency && recency !== 'noLimit') {
      body.search_recency_filter = recency;
    }

    try {
      const resp = await callZhipuSearch(body);
      const hits = (resp.search_result ?? []).slice(0, count).map((h) => ({
        title: h.title ?? '',
        link: h.link ?? '',
        media: h.media ?? '',
        publish_date: h.publish_date ?? '',
        snippet: truncate(h.content, SNIPPET_LIMIT),
      }));
      return {
        ok: true,
        data: {
          engine,
          query,
          intents: resp.search_intent ?? [],
          results: hits,
        },
        summary: `${engine} 命中 ${hits.length} 条结果`,
      };
    } catch (err) {
      return { ok: false, data: (err as Error).message };
    }
  },
};
