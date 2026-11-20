import type {
  ChatContentPart,
  ChatMessage,
  ChatToolCall,
  UiMessage,
  UiToolCall,
} from '@/types/ai-chat';
import { ChatRole } from '@/types/ai-chat';

// ==============================
// 工具函数
// ==============================

/**
 * 生成临时 UI 消息 ID
 * @returns {string} 唯一字符串 ID
 */
export const genId = (): string => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 判断内容片段是否为图片片段
 * @param {unknown} part - 待判定的内容片段
 * @returns {boolean} 是图片片段返回 true
 */
const isImagePart = (part: unknown): part is Extract<ChatContentPart, { type: 'image_url' }> => {
  if (!part || typeof part !== 'object') return false;
  const p = part as { type?: unknown; image_url?: { url?: unknown } };
  return p.type === 'image_url' && typeof p.image_url?.url === 'string';
};

/**
 * 从消息内容中取出随消息发送的图片 URL 列表
 * @param {unknown} raw - 原始 content（字符串 / 内容片段数组）
 * @returns {string[]} 图片 Data URL 列表；非多模态内容返回空数组
 * @description 图片由气泡单独渲染缩略图，不混进 Markdown 正文
 */
export const extractMessageImages = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isImagePart).map((part) => part.image_url.url);
};

/**
 * 将消息 content 规范化为字符串
 * @param {unknown} raw - 原始 content（可能为字符串、对象数组、null 等）
 * @returns {string} 规范化后的字符串
 * @description 兼容历史会话中文生图模型直接保存 [{ url }] 数组的情况，
 *   将其转换为 Markdown 图片语法以正确渲染；多模态片段数组只取文本部分
 */
export const normalizeContent = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  if (raw == null) return '';

  // 数组格式：[{ url: '...' }, ...] / [{ type: 'text' | 'image_url' }, ...]
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        // 多模态内容片段：文本片段取 text，图片片段忽略（由气泡单独渲染）
        if (item && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string') {
          const part = item as { type?: string; text?: string };
          return part.type === 'text' ? part.text ?? '' : '';
        }
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
          return `![generated](${(item as { url: string }).url})`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  // 对象格式：{ url: '...' } —— 转为 Markdown 图片语法
  if (typeof raw === 'object' && typeof (raw as { url?: unknown }).url === 'string') {
    return `![generated](${(raw as { url: string }).url})`;
  }

  return String(raw);
};

/**
 * 解析 tool 消息的 content（JSON）为 { ok, data, summary }
 * @param {ChatMessage | undefined} tr - tool 角色消息
 * @returns {{ ok: boolean; data: unknown; summary?: string }} 解析结果；tr 为空时 ok=true、data=undefined
 */
export const parseToolResult = (
  tr: ChatMessage | undefined,
): { ok: boolean; data: unknown; summary?: string } => {
  if (!tr) return { ok: true, data: undefined };
  // tool 消息内容恒为字符串，多模态内容只会出现在 user 消息里
  const raw = typeof tr.content === 'string' ? tr.content : '';
  // 兼容后端 wrapToolResult 的持久化格式：<tool_result name="...">\n{json}\n</tool_result>
  // 不剥掉包裹层 JSON.parse 会失败，工具卡与卡片图（image_url）在刷新后就全丢了
  const inner = raw.match(/^<tool_result[^>]*>\n?([\s\S]*?)\n?<\/tool_result>$/)?.[1] ?? raw;
  try {
    const parsed = JSON.parse(inner) as {
      ok?: boolean;
      data?: unknown;
      summary?: string;
      error?: string;
    };
    return {
      ok: parsed.ok !== false,
      data: parsed.data ?? parsed.error,
      summary: parsed.summary,
    };
  } catch {
    return { ok: true, data: raw };
  }
};

/**
 * 把单个 assistant.tool_calls 项转换为 UiToolCall（合并对应 tool 结果）
 * @param {ChatToolCall} tc - assistant 携带的 tool_call
 * @param {Map<string, ChatMessage>} toolResultMap - tool_call_id → tool 消息
 * @returns {UiToolCall} UI 层使用的工具调用展示对象
 */
export const toUiToolCall = (
  tc: ChatToolCall,
  toolResultMap: Map<string, ChatMessage>,
): UiToolCall => {
  const tr = toolResultMap.get(tc.id);
  const { ok, data, summary } = parseToolResult(tr);
  let status: UiToolCall['status'] = 'pending';
  if (tr) status = ok ? 'success' : 'failed';
  return {
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
    status,
    result: data,
    summary,
  };
};

/**
 * 把单条 ChatMessage 转换为 UI 消息（仅 user / assistant 会成消息）
 * @param {ChatMessage} m - 后端消息
 * @param {Map<string, ChatMessage>} toolResultMap - tool_call_id → tool 消息
 * @param {() => string} genIdFn - 生成 ID 的函数
 * @returns {UiMessage} UI 层消息
 */
export const toUiMessage = (
  m: ChatMessage,
  toolResultMap: Map<string, ChatMessage>,
  genIdFn: () => string,
): UiMessage => {
  // 兼容性处理：content 可能为字符串或数组（旧版文生图模型存储格式）
  const content = normalizeContent(m.content);

  const ui: UiMessage = {
    id: genIdFn(),
    role: m.role as ChatRole.Assistant | ChatRole.User,
    content,
    tool_calls: [],
    streaming: false,
    created_at: m.created_at ?? Date.now(),
  };
  // 历史会话里的带图消息：把图片片段还原成气泡缩略图
  const images = extractMessageImages(m.content);
  if (images.length > 0) {
    ui.images = images;
  }
  if (m.role === ChatRole.Assistant && m.tool_calls) {
    ui.tool_calls = m.tool_calls.map((tc) => toUiToolCall(tc, toolResultMap));
  }
  // 还原后端持久化的 token 用量（仅 assistant），让刷新后也能继续展示
  if (m.role === ChatRole.Assistant && m.usage) {
    ui.usage = {
      prompt_tokens: m.usage.prompt_tokens ?? 0,
      completion_tokens: m.usage.completion_tokens ?? 0,
      total_tokens: m.usage.total_tokens ?? 0,
    };
  }
  return ui;
};

/**
 * 把后端的 ChatMessage[] 转换为 UI 展示用的 UiMessage[]
 * @param {ChatMessage[]} messages - 后端返回的完整消息列表
 * @param {() => string} genIdFn - 生成 ID 的函数
 * @returns {UiMessage[]} 合并 tool 结果后的 UI 消息列表
 * @description 处理逻辑：
 *   1) 跳过 system 消息
 *   2) user 直接转 UiMessage
 *   3) assistant 把它的 tool_calls 与紧随其后的 tool 消息匹配合并到 ui_tool_calls 上
 *   4) tool 角色不单独成消息
 *   5) 同一轮的连续 assistant 消息（中间只隔 tool 消息）合并为一条 UiMessage——
 *      与直播时的单气泡一致，否则「工具调用前的话 + 最终正文」刷新后会裂成两个气泡
 */
export const convertToUiMessages = (
  messages: ChatMessage[],
  genIdFn: () => string,
): UiMessage[] => {
  const toolResultMap = new Map<string, ChatMessage>();
  for (const m of messages) {
    if (m.role === ChatRole.Tool && m.tool_call_id) {
      toolResultMap.set(m.tool_call_id, m);
    }
  }

  const result: UiMessage[] = [];
  /** 当前正在合并的 assistant 轮（遇到 user 消息即结束） */
  let pendingTurn: UiMessage | null = null;

  for (const m of messages) {
    if (m.role === ChatRole.System || m.role === ChatRole.Tool) continue;

    if (m.role === ChatRole.Assistant) {
      const ui = toUiMessage(m, toolResultMap, genIdFn);
      if (pendingTurn) {
        // 同一轮：正文拼接、工具调用与图片合并、用量取最后一条非空值
        const sep = pendingTurn.content && ui.content ? '\n\n' : '';
        pendingTurn.content += sep + ui.content;
        pendingTurn.tool_calls.push(...ui.tool_calls);
        if (ui.images?.length) {
          pendingTurn.images = [...(pendingTurn.images ?? []), ...ui.images];
        }
        if (ui.usage) pendingTurn.usage = ui.usage;
        continue;
      }
      pendingTurn = ui;
      result.push(pendingTurn);
      continue;
    }

    // user 消息：结束当前 assistant 轮
    pendingTurn = null;
    result.push(toUiMessage(m, toolResultMap, genIdFn));
  }

  return result;
};
