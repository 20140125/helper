import type { ChatMessage, ToolDefinition } from '@/types/ai-chat';
import { describeFetchError } from '@/utils/ai-model-config-test';
import { getLlmConfigForModel } from './config';
import { isContentPartArray } from '../content';

/** OpenAI 兼容的 chat/completions 请求体（私有：仅本文件内使用） */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  /** stream=true 时附带 include_usage:true，让最后一帧返回 usage */
  stream_options?: { include_usage: boolean };
  max_tokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none';
}

/**
 * 把任意形式的 content 规范化为字符串
 * @param {unknown} raw - 原始 content
 * @returns {string} 规范化后的字符串
 * @description 兼容历史会话中文生图模型直接保存 [{ url }] 数组的情况
 */
const normalizeContentToString = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
          return `![generated](${(item as { url: string }).url})`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof raw === 'object' && typeof (raw as { url?: unknown }).url === 'string') {
    return `![generated](${(raw as { url: string }).url})`;
  }
  return String(raw);
};

/**
 * 移除消息中的内部字段（如 created_at），仅保留 OpenAI 协议字段
 * @param {ChatMessage[]} messages - 原始消息
 * @returns {ChatMessage[]} 清理后的消息
 * @description 多模态内容片段数组（带 type 字段）原样上行，交给模型做图片理解；
 *   其余情况一律规范化为字符串（兼容历史会话中文生图模型保存的 [{ url }] 数组）
 */
const stripInternalFields = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.map((m) => {
    const content = isContentPartArray(m.content) ? m.content : normalizeContentToString(m.content);
    const out: ChatMessage = { role: m.role, content };
    if (m.tool_calls) out.tool_calls = m.tool_calls;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  });
};

/**
 * 构造 chat completion 请求体（合并 tools 配置）
 * @param {ChatMessage[]} messages - 消息列表
 * @param {ToolDefinition[] | undefined} tools - 工具列表
 * @param {string | undefined} modelOverride - 指定模型 ID
 * @param {boolean} stream - 是否为流式
 * @returns {ChatCompletionRequest} 请求体
 */
export const buildRequestBody = (
  messages: ChatMessage[],
  tools: ToolDefinition[] | undefined,
  modelOverride: string | undefined,
  stream: boolean,
): ChatCompletionRequest => {
  // 按 modelOverride 反查 provider，保证 maxTokens 取的是该 provider 的运行配置
  const cfg = getLlmConfigForModel(modelOverride);
  const body: ChatCompletionRequest = {
    model: modelOverride?.trim() || cfg.model,
    messages: stripInternalFields(messages),
    stream,
    max_tokens: cfg.maxTokens,
    temperature: 0.7,
  };
  if (stream) {
    // 流式调用要求 LLM 在最后一帧返回 usage，便于前端展示 token 消耗
    body.stream_options = { include_usage: true };
  }
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  return body;
};

/** 429 限流时的最大重试次数 */
export const MAX_RETRIES = 3;

/** 重试原因：429 限流 / 网络异常 */
export type RetryReason = 'rate_limit' | 'network';
/** 重试基础延迟（毫秒），按次数指数退避：1s / 2s / 4s */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * 等待指定毫秒，支持通过 AbortSignal 提前中断
 * @param {number} ms - 等待时长
 * @param {AbortSignal} [signal] - 终止信号
 */
const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('aborted'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * 发起 chat/completions 请求并校验响应（429 时自动重试，最多 3 次）
 * @param {ChatCompletionRequest} body - 请求体
 * @param {boolean} streamMode - 是否为 SSE 流模式（决定 Accept 头）
 * @param {AbortSignal} [signal] - 终止信号
 * @param {(attempt: number, delayMs: number, reason: RetryReason) => void} [onRetry] - 每次重试前回调（第几次重试、等待毫秒、重试原因）
 * @returns {Promise<Response>} 校验通过的 Response
 * @throws 当重试耗尽仍为 429、网络异常重试耗尽、响应非 2xx 或无 body（流模式）时抛错；
 *         限流 / 网络类错误的 message 会带上"已自动重试 N 次"，便于前端原样展示
 */
export const requestChatCompletion = async (
  body: ChatCompletionRequest,
  streamMode: boolean,
  signal?: AbortSignal,
  onRetry?: (attempt: number, delayMs: number, reason: RetryReason) => void,
): Promise<Response> => {
  // 按 body.model 路由到对应 provider 的 baseUrl/apiKey
  const cfg = getLlmConfigForModel(body.model);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (streamMode) headers.Accept = 'text/event-stream';

  let lastError: Error | undefined;
  let retriesUsed = 0;
  /** 是否已尝试过「去掉 temperature」的兼容重试（避免不兼容模型上无限重试） */
  let temperatureDropped = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err as Error;
      if (attempt < MAX_RETRIES) {
        retriesUsed += 1;
        const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;
        console.warn(`[llm] 网络异常，${delayMs}ms 后发起第 ${retriesUsed}/${MAX_RETRIES} 次重试：${describeFetchError(lastError)}`);
        onRetry?.(retriesUsed, delayMs, 'network');
        await sleep(delayMs, signal);
        continue;
      }
      throw new Error(`网络异常，已自动重试 ${retriesUsed} 次仍未成功。${describeFetchError(lastError)}`);
    }

    if (resp.ok) {
      if (streamMode && !resp.body) {
        throw new Error('LLM 响应体为空');
      }
      return resp;
    }

    const text = await resp.text();
    // 只写原因，不写"LLM 请求失败"前缀——上层（agent-loop）统一加前缀，避免重复
    const error = new Error(`${resp.status} ${text.slice(0, 200)}`);
    // 部分代理/模型（Claude 系等）只接受默认 temperature：去掉该字段立即重试一次，
    // 正常模型仍走 0.7，不改变既有行为
    if (
      resp.status === 400 &&
      !temperatureDropped &&
      body.temperature !== undefined &&
      /temperature/i.test(text)
    ) {
      temperatureDropped = true;
      const compatibleBody = { ...body };
      delete compatibleBody.temperature;
      const compatibleResp = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(compatibleBody),
        signal,
      });
      if (compatibleResp.ok && (!streamMode || compatibleResp.body)) return compatibleResp;
      const compatibleText = await compatibleResp.text().catch(() => '');
      throw new Error(`${compatibleResp.status} ${compatibleText.slice(0, 200)}`);
    }
    // 429 限流：指数退避后重试，最多 3 次
    if (resp.status === 429 && attempt < MAX_RETRIES) {
      lastError = error;
      retriesUsed += 1;
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(`[llm] 触发模型限流（429），${delayMs}ms 后发起第 ${retriesUsed}/${MAX_RETRIES} 次重试`);
      onRetry?.(retriesUsed, delayMs, 'rate_limit');
      await sleep(delayMs, signal);
      continue;
    }
    // 重试耗尽仍限流：把"已经重试过几次"写进错误，避免用户以为一次失败就放弃
    if (resp.status === 429) {
      throw new Error(
        `模型限流（429），已自动重试 ${retriesUsed} 次仍未成功，请稍后再试。${text.slice(0, 200)}`,
      );
    }
    throw error;
  }
  throw new Error(`已自动重试 ${retriesUsed} 次仍未成功。${lastError ? describeFetchError(lastError) : '未知错误'}`);
};
