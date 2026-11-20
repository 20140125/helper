import type {
  SendMessageEventHandlers,
  SseDeltaPayload,
  SseDonePayload,
  SseErrorPayload,
  SseIterationEndPayload,
  SseIterationUsagePayload,
  SseMetaPayload,
  SseNoticePayload,
  SsePlanStartPayload,
  SsePlanStepPayload,
  SseReflectionPayload,
  SseReasoningPayload,
  SseToolArgsPayload,
  SseToolExecutingPayload,
  SseToolResultPayload,
  SseToolStartPayload,
} from '@/types/ai-chat';

// ==============================
// SSE 解析辅助函数
// ==============================

/**
 * 从缓冲区中切出所有完整事件块（按 \n\n 分隔），分发后返回剩余未消费部分
 * @param {string} buffer - 当前缓冲区
 * @param {SendMessageEventHandlers} handlers - 事件处理器
 * @returns {string} 处理后剩余的缓冲区内容
 */
export const consumeSseBuffer = (
  buffer: string,
  handlers: SendMessageEventHandlers,
): string => {
  let rest = buffer;
  let blockEnd: number;
  while ((blockEnd = rest.indexOf('\n\n')) !== -1) {
    const block = rest.slice(0, blockEnd);
    rest = rest.slice(blockEnd + 2);
    parseAndDispatchSseBlock(block, handlers);
  }
  return rest;
};

/**
 * 解析单个 SSE 事件块并分发到对应回调
 * @param {string} block - 单个事件文本块
 * @param {SendMessageEventHandlers} handlers - 事件处理器
 * @returns {void}
 */
export const parseAndDispatchSseBlock = (
  block: string,
  handlers: SendMessageEventHandlers,
): void => {
  let currentEvent = 'message';
  const dataLines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return;
  const dataStr = dataLines.join('\n');

  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    return;
  }
  dispatchSseEvent(currentEvent, data, handlers);
};

// ==============================
// SSE 事件分发表
// ==============================

/**
 * 按事件名查找的回调表（避免巨型 switch）
 */
const SSE_HANDLER_TABLE: Record<
  string,
  (handlers: SendMessageEventHandlers, data: unknown) => void
> = {
  meta: (h, d) => h.onMeta?.(d as SseMetaPayload),
  delta: (h, d) => h.onDelta?.(d as SseDeltaPayload),
  reasoning: (h, d) => h.onReasoning?.(d as SseReasoningPayload),
  tool_start: (h, d) => h.onToolStart?.(d as SseToolStartPayload),
  tool_args: (h, d) => h.onToolArgs?.(d as SseToolArgsPayload),
  tool_executing: (h, d) => h.onToolExecuting?.(d as SseToolExecutingPayload),
  tool_result: (h, d) => h.onToolResult?.(d as SseToolResultPayload),
  iteration_end: (h, d) => h.onIterationEnd?.(d as SseIterationEndPayload),
  iteration_usage: (h, d) => h.onIterationUsage?.(d as SseIterationUsagePayload),
  notice: (h, d) => h.onNotice?.(d as SseNoticePayload),
  plan_start: (h, d) => h.onPlanStart?.(d as SsePlanStartPayload),
  plan_step: (h, d) => h.onPlanStep?.(d as SsePlanStepPayload),
  reflection: (h, d) => h.onReflection?.(d as SseReflectionPayload),
  done: (h, d) => h.onDone?.(d as SseDonePayload),
  error: (h, d) => h.onError?.(d as SseErrorPayload),
};

/**
 * 将 SSE 事件分发到对应的 handler 回调
 * @param {string} event - 事件名
 * @param {unknown} data - 解析后的 JSON 数据
 * @param {SendMessageEventHandlers} handlers - 事件处理器集合
 * @returns {void}
 */
export const dispatchSseEvent = (
  event: string,
  data: unknown,
  handlers: SendMessageEventHandlers,
): void => {
  SSE_HANDLER_TABLE[event]?.(handlers, data);
};

/**
 * 持续读取 SSE 流并按事件分发
 * @param {Response} resp - fetch 返回的响应
 * @param {SendMessageEventHandlers} handlers - 事件处理器
 * @returns {Promise<void>}
 * @description 校验响应合法性 → 逐块解码 → 调用 consumeSseBuffer 解析事件
 */
export const consumeSseStream = async (
  resp: Response,
  handlers: SendMessageEventHandlers,
): Promise<void> => {
  if (!resp.ok) {
    const text = await resp.text();
    handlers.onError?.({ message: `请求失败 ${resp.status}：${text.slice(0, 200)}` });
    return;
  }
  if (!resp.body) {
    handlers.onError?.({ message: '响应体为空' });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = consumeSseBuffer(buffer, handlers);
  }
};

/**
 * 判断错误是否为客户端主动 abort 引起
 * @param {unknown} err - 错误对象
 * @param {AbortSignal} signal - 关联的终止信号
 * @returns {boolean} 是否属于 abort 错误
 * @description 多重 abort 识别：
 *   1) controller.signal.aborted 是最可靠的信号，说明是用户/组件主动 abort
 *   2) err.name === 'AbortError' 兼容旧版浏览器（Chrome 99-）
 *   3) Message 包含 'aborted' 兼容部分浏览器把 abort 错误转成 TypeError 的边缘情况
 */
export const isClientAbort = (err: unknown, signal: AbortSignal): boolean => {
  if (signal.aborted) return true;
  const e = err as Error;
  if (e?.name === 'AbortError') return true;
  if (e?.name === 'DOMException' && /abort/i.test(e.message ?? '')) return true;
  if (typeof e?.message === 'string' && /aborted/i.test(e.message)) return true;
  return false;
};
