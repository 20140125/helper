import type { ChatMessage, ToolDefinition } from '@/types/ai-chat';
import { buildRequestBody, requestChatCompletion } from './request';
import type { UsageInfo } from './stream';

/**
 * 单次非流式 chat completion
 * @param {ChatMessage[]} messages - 消息列表
 * @param {ToolDefinition[]} [tools] - 可选工具列表
 * @param {string} [modelOverride] - 可选，指定模型 ID（不传则用 .env / 默认模型）
 * @param {AbortSignal} [signal] - 可选终止信号（规划/反思等辅助调用需要响应客户端断开）
 * @returns {Promise<{ content: string; tool_calls?: ChatMessage['tool_calls']; media_urls?: string[]; usage?: UsageInfo }>} 模型响应
 * @description 对于文生图/文生视频模型，content 可能为空，媒体 URL 在 media_urls 中
 *   兼容两种返回格式：
 *   1) 标准 chat/completions：choices[0].message.{content,tool_calls,data}
 *   2) 智谱文生图/视频：根级 data: [{ url }]（类似 OpenAI images/generations）
 */
export const chatCompletion = async (
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  modelOverride?: string,
  signal?: AbortSignal,
): Promise<{
  content: string;
  tool_calls?: ChatMessage['tool_calls'];
  media_urls?: string[];
  usage?: UsageInfo;
}> => {
  const body = buildRequestBody(messages, tools, modelOverride, false);
  const resp = await requestChatCompletion(body, false, signal);
  const json = (await resp.json()) as {
    choices?: Array<{
      message?: {
        /** 文本模型为字符串；智谱 CogView 文生图模型直接把媒体 URL 列表放在 content 数组里 */
        content?: string | Array<{ url?: string }>;
        tool_calls?: ChatMessage['tool_calls'];
        /** 部分文生图/视频模型可能在此返回媒体 URL */
        data?: Array<{ url: string }>;
      };
    }>;
    /** 智谱文生图/视频模型在响应根级返回媒体 URL */
    data?: Array<{ url: string }>;
    /** OpenAI 兼容 token 用量 */
    usage?: UsageInfo;
  };
  const choice = json?.choices?.[0]?.message ?? {};

  // 提取媒体 URL：优先从根级 data 取（部分文生图/视频），其次从 choice.data 取，
  // 最后兼容智谱 CogView 把媒体 URL 列表直接塞进 message.content 数组的格式。
  const rawContent = choice.content;
  const contentMediaItems = Array.isArray(rawContent) ? rawContent : [];
  const rawMediaItems = json?.data ?? choice.data ?? contentMediaItems;
  const mediaUrls = rawMediaItems
    .map((item) => item?.url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);

  // content 必须保证为字符串（智谱有时返回数组形式的媒体内容）
  const content = typeof rawContent === 'string' ? rawContent : '';

  return {
    content,
    tool_calls: choice.tool_calls,
    media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
    usage: json?.usage,
  };
};
