import fs from 'fs';
import path from 'path';
import { CACHE_DIR, listApiResponses, readApiResponse } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** API 响应缓存目录（.cache/api_responses/） */
const API_RESPONSES_DIR = path.join(CACHE_DIR, 'api_responses');

/** 单个文件返回的内容上限（字符），防止上下文爆炸 */
const MAX_CONTENT_LEN = 3000;

/** 清单模式最大返回条数 */
const MAX_LIST = 100;

/**
 * 截断文本并追加省略标记
 * @param {string} text - 原文
 * @returns {string} 截断后的文本
 */
const truncate = (text: string): string =>
  (text.length > MAX_CONTENT_LEN ? `${text.slice(0, MAX_CONTENT_LEN)}…（已截断，共 ${text.length} 字符）` : text);

/**
 * 从文件名解析数据来源类型（almanac_2026-05.json → almanac）
 * @param {string} file - 缓存文件名
 * @returns {string} 来源类型
 */
const apiTypeOf = (file: string): string => file.replace(/\.json$/i, '').split('_')[0] ?? '';

/**
 * 读取文件大小与更新时间
 * @param {string} file - 缓存文件名
 * @returns {{ size_kb: number; updated_at: string }} 大小（KB）与本地更新时间
 */
const statOf = (file: string): { size_kb: number; updated_at: string } => {
  try {
    const s = fs.statSync(path.join(API_RESPONSES_DIR, file));
    return {
      size_kb: Number((s.size / 1024).toFixed(1)),
      updated_at: new Date(s.mtimeMs).toLocaleString('zh-CN', { hour12: false }),
    };
  } catch {
    return { size_kb: 0, updated_at: '' };
  }
};

/**
 * 对 { api, key, entries } 结构的缓存做摘要（黄历/星座等按月或按 key 聚合的缓存）
 * @param {unknown} data - 已解析的缓存内容
 * @returns {{ summary: string; entry_keys: string[] } | null} 命中该结构时返回摘要，否则返回 null
 */
const summarizeEntries = (data: unknown): { summary: string; entry_keys: string[] } | null => {
  if (!data || typeof data !== 'object') return null;
  const obj = data as { entries?: unknown };
  if (!obj.entries || typeof obj.entries !== 'object' || Array.isArray(obj.entries)) return null;
  const keys = Object.keys(obj.entries as Record<string, unknown>);
  return {
    summary: `含 ${keys.length} 条记录：${keys.slice(0, 10).join('、')}${keys.length > 10 ? ' …' : ''}`,
    entry_keys: keys,
  };
};

/**
 * query_api_responses 工具实现
 * @description 查询 .cache/api_responses 下的外部 API 响应缓存（天气 / 黄历 / 星座 / 每日一言 / 历史今天 等接口的原始返回）。
 *              支持三种用法：列清单（默认）、按类型或关键词过滤清单、按文件名读内容（超长截断）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "缓存了哪些 API 响应？"                       → {}
 *   - "看看黄历接口的缓存"                           → { api: 'almanac' }
 *   - "有没有跟双子座有关的缓存"                      → { keyword: '双子座' }
 *   - "打开 almanac_2026-10.json 看看"              → { filename: 'almanac_2026-10.json' }
 */
export const queryApiResponsesTool: ToolImpl = {
  name: 'query_api_responses',
  description:
    '查询 .cache/api_responses 下的外部 API 响应缓存（天气/黄历/星座/每日一言/历史今天等接口的原始返回数据）。'
    + '不传 filename 时列出可用缓存文件（来源类型、大小、更新时间），可用 api / keyword 过滤；'
    + '传 filename 返回该文件内容（超长会截断）。只查缓存里的旧数据，不会发起新的网络请求；'
    + '要最新数据请用 card_skill 重新执行对应技能。',
  parameters: {
    type: 'object',
    properties: {
      api: {
        type: 'string',
        description: '按来源类型过滤文件名，如 almanac / horoscope / weather / dailyword',
      },
      keyword: {
        type: 'string',
        description: '按文件名模糊过滤，如 "双子座"',
      },
      filename: {
        type: 'string',
        description: '精确读取某个缓存文件（含 .json），如 almanac_2026-10.json；不传则列清单',
      },
      limit: {
        type: 'number',
        description: '清单模式返回条数，默认 50，最大 100',
      },
    },
  },
  requiredPermissions: ['cache:view'],
  invoke: async (args): Promise<ToolResult> => {
    // ── 精确读取模式 ──
    const filename = typeof args.filename === 'string' ? args.filename.trim() : '';
    if (filename) {
      const data = readApiResponse(CACHE_DIR, filename);
      if (!data) {
        const files = listApiResponses(CACHE_DIR);
        return {
          ok: false,
          data: `缓存文件不存在：${filename}。可用文件：${files.join('、')}`,
        };
      }
      const entries = summarizeEntries(data);
      const raw = JSON.stringify(data);
      return {
        ok: true,
        data: {
          filename,
          api: apiTypeOf(filename),
          ...statOf(filename),
          entry_count: entries?.entry_keys.length ?? null,
          entry_keys: entries?.entry_keys ?? null,
          content: truncate(raw),
        },
        summary: `${filename}${entries ? `（${entries.summary}）` : ''}`,
      };
    }

    // ── 清单模式 ──
    const apiKw = typeof args.api === 'string' ? args.api.toLowerCase().trim() : '';
    const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';
    const limit = Math.min(Math.max(Number(args.limit) || 50, 1), MAX_LIST);

    const all = listApiResponses(CACHE_DIR);
    const matched = all.filter((f) => {
      if (apiKw && !apiTypeOf(f).toLowerCase().includes(apiKw)) return false;
      if (kw && !f.toLowerCase().includes(kw)) return false;
      return true;
    });

    const list = matched.slice(0, limit).map((f) => ({
      filename: f,
      api: apiTypeOf(f),
      ...statOf(f),
    }));

    const apiTypes = Array.from(new Set(all.map(apiTypeOf))).filter(Boolean);
    return {
      ok: true,
      data: {
        files: list,
        total: matched.length,
        returned: list.length,
        available_apis: apiTypes,
      },
      summary: matched.length === 0
        ? `没有匹配的缓存文件，可用来源类型：${apiTypes.join('、')}`
        : `命中 ${matched.length} 个缓存文件，返回 ${list.length} 个；来源类型：${apiTypes.join('、')}`,
    };
  },
};
