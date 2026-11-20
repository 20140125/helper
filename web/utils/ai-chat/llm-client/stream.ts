import type { ChatMessage, ToolDefinition } from '@/types/ai-chat';
import { buildRequestBody, requestChatCompletion, type RetryReason } from './request';

/** OpenAI 兼容协议的 token 用量结构 */
export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** SSE 行解析后的数据块结构（仅在内部使用） */
interface SseChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      /** 各厂商思考字段别名（DeepSeek / 智谱用 reasoning_content，Anthropic 系用 thinking） */
      reasoning_content?: unknown;
      reasoning?: unknown;
      thinking?: unknown;
      thoughts?: unknown;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
  /** include_usage:true 时，最后一帧 choices=[]，usage 在此返回 */
  usage?: UsageInfo;
}

/** 流式生成器单次产出的事件 */
type StreamYield = {
  content_delta?: string;
  /** 模型思考过程的增量文本（与正文分开，供前端单独折叠展示） */
  reasoning_delta?: string;
  tool_call_delta?: { index: number; id?: string; name?: string; arguments?: string };
  finish_reason?: string;
  usage?: UsageInfo;
};

/**
 * 从各家厂商的字段里取出思考增量
 * @param {Record<string, unknown>} delta - SSE chunk 的 delta
 * @returns {string} 思考文本增量；没有则返回空串
 * @description 兼容字符串形态（reasoning_content / reasoning / thoughts）与对象形态
 *   （如 Anthropic 的 thinking: { text }），多个字段同时存在时取第一个非空值
 */
const extractReasoningDelta = (delta: Record<string, unknown>): string => {
  const candidates: unknown[] = [delta.reasoning_content, delta.reasoning, delta.thinking, delta.thoughts];
  for (const item of candidates) {
    if (typeof item === 'string' && item.length > 0) return item;
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const text = obj.text ?? obj.thinking ?? obj.content;
      if (typeof text === 'string' && text.length > 0) return text;
    }
  }
  return '';
};

/**
 * 把单个 SSE chunk 解析后的对象转为零或多个流事件
 * @param {SseChunk} chunk - 解析后的 chunk
 * @returns {Generator<StreamYield>} 事件迭代器
 */
function* chunkToYields(chunk: SseChunk): Generator<StreamYield> {
  const delta = chunk?.choices?.[0]?.delta ?? {};
  const finishReason = chunk?.choices?.[0]?.finish_reason;

  if (typeof delta.content === 'string' && delta.content.length > 0) {
    yield { content_delta: delta.content };
  }
  const reasoning = extractReasoningDelta(delta as Record<string, unknown>);
  if (reasoning) {
    yield { reasoning_delta: reasoning };
  }
  if (Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls) {
      yield {
        tool_call_delta: {
          index: tc.index ?? 0,
          id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments,
        },
      };
    }
  }
  if (finishReason) {
    yield { finish_reason: finishReason };
  }
  // include_usage:true 时，最后一帧只含 usage 不含 choices
  if (chunk?.usage) {
    yield { usage: chunk.usage };
  }
}

/**
 * 解析单行 SSE data 内容
 * @param {string} line - 已 trim 的整行
 * @returns {SseChunk | '__DONE__' | null} 解析后的对象；`__DONE__` 表示结束标志；null 表示该行需跳过
 */
const parseSseLine = (line: string): SseChunk | '__DONE__' | null => {
  if (!line || !line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (data === '[DONE]') return '__DONE__';
  try {
    return JSON.parse(data) as SseChunk;
  } catch {
    return null;
  }
};

/**
 * 从 SSE 行流中按 \n 切分行并产出事件
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader - 响应体 reader
 * @returns {AsyncGenerator<StreamYield>} 流事件生成器
 */
async function* readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<StreamYield> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      const parsed = parseSseLine(line);
      if (parsed === null) continue;
      if (parsed === '__DONE__') return;
      yield* chunkToYields(parsed);
    }
  }
}

/**
 * 流式 chat completion（按 SSE 行返回 delta）
 * @param {ChatMessage[]} messages - 消息列表
 * @param {ToolDefinition[]} [tools] - 可选工具列表
 * @param {AbortSignal} [signal] - 终止信号
 * @param {string} [modelOverride] - 可选，指定模型 ID（不传则用 .env / 默认模型）
 * @param {(attempt: number, delayMs: number, reason: RetryReason) => void} [onRetry] - 重试前回调（429 / 网络异常重试时触发）
 * @returns {AsyncGenerator} 流式 delta 生成器
 * @description 每个 yield 包含 { content_delta?, tool_call_delta?, finish_reason? }
 */
export async function* chatCompletionStream(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  signal?: AbortSignal,
  modelOverride?: string,
  onRetry?: (attempt: number, delayMs: number, reason: RetryReason) => void,
): AsyncGenerator<StreamYield> {
  const body = buildRequestBody(messages, tools, modelOverride, true);
  const resp = await requestChatCompletion(body, true, signal, onRetry);
  yield* readSseStream(resp.body!.getReader());
}
