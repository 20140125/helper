import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** MyMemory 免费翻译接口（无需 Key，有日限额） */
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

/** 单次请求超时（毫秒） */
const TIMEOUT_MS = 10000;

/** 单次翻译文本上限（字符），超出接口会拒绝 */
const MAX_TEXT_LEN = 500;

/** MyMemory 响应结构（只取需要的字段） */
interface MyMemoryResponse {
  responseData?: { translatedText?: string };
  responseStatus?: number;
  responseDetails?: string;
  matches?: Array<{ translation?: string; quality?: number | string }>;
}

/**
 * translate 工具实现
 * @description 调用免费公开翻译接口做短句互译，无需 API Key。
 *              适合标题、报错信息、接口返回的英文内容快速看懂；长文本请分段。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "这句话什么意思：connection reset by peer"  → { text: 'connection reset by peer' }
 *   - "把'服务已启动'翻译成英文"                    → { text: '服务已启动', target: 'en' }
 */
export const translateTool: ToolImpl = {
  name: 'translate',
  description:
    '短句翻译（中英互译，默认译为简体中文），使用免费公开接口 MyMemory，无需 API Key。'
    + 'text 为待翻译内容（≤500 字符），target 为目标语言（zh-CN / en 等），source 为源语言（默认 auto）。'
    + '适合翻译报错信息、英文标题、接口返回的英文内容；长文请分段调用。',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: '待翻译内容（≤500 字符）',
      },
      target: {
        type: 'string',
        description: '目标语言代码，默认 zh-CN（英文填 en）',
      },
      source: {
        type: 'string',
        description: '源语言代码，默认 auto（自动识别）',
      },
    },
    required: ['text'],
  },
  requiredPermissions: ['cache:view'],
  invoke: async (args): Promise<ToolResult> => {
    const text = typeof args.text === 'string' ? args.text.trim() : '';
    if (!text) {
      return { ok: false, data: '缺少待翻译内容（text）' };
    }
    if (text.length > MAX_TEXT_LEN) {
      return { ok: false, data: `单次翻译上限 ${MAX_TEXT_LEN} 字符，当前 ${text.length} 字，请分段` };
    }

    const target = typeof args.target === 'string' && args.target.trim() ? args.target.trim() : 'zh-CN';
    const rawSource = typeof args.source === 'string' && args.source.trim() ? args.source.trim() : 'auto';
    // MyMemory 不支持 auto，自动识别时按中英判断：含中文则源为 zh-CN，否则 en
    const source = rawSource === 'auto'
      ? (/[\u4e00-\u9fa5]/.test(text) ? 'zh-CN' : 'en')
      : rawSource;

    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${source}|${target}`)}`;
    let data: MyMemoryResponse | null = null;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!resp.ok) {
        return { ok: false, data: `翻译接口返回 ${resp.status}，请稍后重试` };
      }
      data = await resp.json() as MyMemoryResponse;
    } catch (err) {
      return { ok: false, data: `翻译失败：${(err as Error).message}` };
    }

    const translated = (data?.responseData?.translatedText ?? '').trim();
    if (!translated) {
      return { ok: false, data: `翻译无结果：${data?.responseDetails ?? '接口未返回译文'}` };
    }
    // MYMEMORY 超出限额时会把提示语放在译文里，识别出来如实告知
    if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|USAGE LIMIT/i.test(translated)) {
      return { ok: false, data: `翻译接口提示：${translated}` };
    }

    return {
      ok: true,
      data: {
        source_lang: source,
        target_lang: target,
        original: text,
        translated,
      },
      summary: `【${source} → ${target}】${translated}`,
    };
  },
};
