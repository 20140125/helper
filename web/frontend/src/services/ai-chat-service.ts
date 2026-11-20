import { BaseService } from './base-service';
import { AUTH_STORAGE_KEY } from '@/constants/auth';
import type {
  AiChatHealthResponse,
  AiChatToolsResponse,
  ApprovalActionResponse,
  ApprovalsResponse,
  ChatConversation,
  ConversationResponse,
  ConversationsListResponse,
  CreateConversationPayload,
  ModelsListResponse,
  SendMessageEventHandlers,
  SendMessagePayload,
} from '@/types/ai-chat';
import { consumeSseStream, isClientAbort } from '@/utils/ai-chat';

// ==============================
// Service 类
// ==============================

/**
 * AI 智能助手服务管理类
 * @description 封装 AI Chat 模块的全部接口，包含 REST CRUD 和 SSE 流式发送
 */
export class AiChatService extends BaseService {
  // ==============================
  // 基础信息（健康检查 + 模型列表）
  // ==============================

  /**
   * 健康检查（确认 LLM 配置是否就绪）
   * @returns {Promise<AiChatHealthResponse>} 健康状态响应
   * @description 用于在页面进入前提示用户补全模型配置的 API Key
   * @example
   * const service = new AiChatService();
   * const result = await service.fetchHealth();
   * if (!result.data.healthy) console.warn(result.data.message);
   */
  fetchHealth = async (): Promise<AiChatHealthResponse> => {
    return this.get<AiChatHealthResponse>('/ai-chat/health');
  };

  /**
   * 获取可选模型列表
   * @returns {Promise<ModelsListResponse>} 模型列表响应
   * @description 返回后端配置的模型可选项以及默认选中的模型 ID
   * @example
   * const service = new AiChatService();
   * const result = await service.fetchModels();
   * console.log('默认模型：', result.data.default);
   */
  fetchModels = async (): Promise<ModelsListResponse> => {
    return this.get<ModelsListResponse>('/ai-chat/models');
  };

  /**
   * 获取当前用户可用的 AI 工具清单（供输入框「指定工具」下拉使用）
   * @returns {Promise<AiChatToolsResponse>} 工具清单响应
   * @description 后端已按权限过滤，返回的工具就是本轮真能调用的；web_search 由联网搜索开关控制，不在其中
   * @example
   * const service = new AiChatService();
   * const res = await service.fetchTools();
   * console.log(res.data.tools.length);
   */
  fetchTools = async (): Promise<AiChatToolsResponse> => {
    return this.get<AiChatToolsResponse>('/ai-chat/tools');
  };

  // ==============================
  // 会话管理（CRUD）
  // ==============================

  /**
   * 获取当前用户的会话列表
   * @returns {Promise<ConversationsListResponse>} 会话摘要列表
   * @description 按更新时间倒序返回当前用户的全部会话
   * @example
   * const service = new AiChatService();
   * const result = await service.fetchConversations();
   * console.log('共有会话：', result.data.conversations.length);
   */
  fetchConversations = async (): Promise<ConversationsListResponse> => {
    return this.get<ConversationsListResponse>('/ai-chat/conversations');
  };

  /**
   * 获取指定会话详情
   * @param {string} id - 会话 ID
   * @returns {Promise<ConversationResponse>} 会话详情响应
   * @description 包含完整的消息列表（不含 system prompt）
   * @example
   * const service = new AiChatService();
   * const result = await service.fetchConversation('conv_xxx');
   * console.log('消息数：', result.data.conversation.messages.length);
   */
  fetchConversation = async (id: string): Promise<ConversationResponse> => {
    return this.get<ConversationResponse>(`/ai-chat/conversations/${encodeURIComponent(id)}`);
  };

  /**
   * 创建新会话
   * @param {CreateConversationPayload} payload - 创建参数
   * @returns {Promise<ConversationResponse>} 创建后的会话响应
   * @description 创建后返回完整的会话对象，可立即用于 sendMessage
   * @example
   * const service = new AiChatService();
   * const result = await service.createConversation({ title: '系统排查' });
   * console.log('会话 ID：', result.data.conversation.id);
   */
  createConversation = async (payload: CreateConversationPayload = {}): Promise<ConversationResponse> => {
    return this.post<ConversationResponse>('/ai-chat/conversations', payload);
  };

  /**
   * 删除会话
   * @param {string} id - 会话 ID
   * @returns {Promise<{ code: number; message: string }>} 删除响应
   * @description 同步删除会话 JSON 文件
   * @example
   * const service = new AiChatService();
   * await service.deleteConversation('conv_xxx');
   */
  deleteConversation = async (id: string): Promise<{ code: number; message: string }> => {
    return this.del<{ code: number; message: string }>(
      `/ai-chat/conversations/${encodeURIComponent(id)}`,
    );
  };

  /**
   * 从指定消息处分支出新会话
   * @param {string} id - 源会话 ID
   * @param {number} at - 保留前 N 条可见消息（前端传「UI 下标 + 1」，即含被点击的那条）
   * @returns {Promise<ConversationResponse>} 新会话响应（含已复制的消息）
   * @description 后端按「可见消息」口径切片（排除 system / tool），
   *   因此前端直接用 UI 列表下标即可对齐，无需关心被过滤掉的 tool 消息数量。
   * @example
   * const service = new AiChatService();
   * const res = await service.forkConversation('conv_xxx', 4); // 复制前 4 条可见消息
   * console.log('新会话：', res.data.conversation.id);
   */
  forkConversation = async (id: string, at: number): Promise<ConversationResponse> => {
    return this.post<ConversationResponse>(
      `/ai-chat/conversations/${encodeURIComponent(id)}/fork`,
      { at },
    );
  };

  // ==============================
  // 流式发送（SSE）
  // ==============================

  /**
   * 发起 SSE fetch 请求并校验返回
   * @param {SendMessagePayload} payload - 请求体
   * @param {AbortSignal} signal - 终止信号
   * @returns {Promise<Response | null>} 校验通过的 Response；非法时返回 null（已通过 onError 上报）
   * @example
   * const service = new AiChatService();
   * const resp = await service.fetchSseResponse({ message: 'Hello' }, new AbortController().signal);
   */
  private fetchSseResponse = async (
    payload: SendMessagePayload,
    signal: AbortSignal,
  ): Promise<Response | null> => {
    const token = localStorage.getItem(AUTH_STORAGE_KEY) ?? '';
    const resp = await fetch('/api/ai-chat/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });
    return resp;
  };

  /**
   * 流式发送消息（SSE）
   * @param {SendMessagePayload} payload - 消息参数
   * @param {SendMessageEventHandlers} handlers - 事件回调
   * @returns {AbortController} 终止控制器（调用 abort 可中断流）
   * @description 使用 fetch + ReadableStream 解析 SSE，无需 EventSource（EventSource 不支持 POST）。
   *              内部编排 fetchSseResponse + consumeSseStream，并在用户主动 abort 时静默吞掉错误。
   * @example
   * const service = new AiChatService();
   * const ctrl = service.sendMessageStream(
   *   { message: '查一下日志', enable_tools: true },
   *   { onDelta: (p) => console.log(p.delta), onDone: () => console.log('done') },
   * );
   * // 中断：ctrl.abort();
   */
  sendMessageStream = (
    payload: SendMessagePayload,
    handlers: SendMessageEventHandlers,
  ): AbortController => {
    const controller = new AbortController();

    void (async () => {
      try {
        const resp = await this.fetchSseResponse(payload, controller.signal);
        if (!resp) return;
        await consumeSseStream(resp, handlers);
      } catch (err) {
        if (isClientAbort(err, controller.signal)) return;
        handlers.onError?.({ message: (err as Error).message });
      }
    })();

    return controller;
  };

  // ==============================
  // 审批单（Human-in-the-loop）
  // ==============================

  /**
   * 获取审批单列表
   * @param {string} status - 可选状态过滤（pending / executed / rejected / failed）；不传返回全部
   * @returns {Promise<ApprovalsResponse>} 审批单列表响应
   * @description 后端按创建时间倒序返回；前端 Tab 切换建议一次拉全量再本地过滤
   * @example
   * const service = new AiChatService();
   * const res = await service.fetchApprovals();
   * console.log(res.data.approvals.length);
   */
  fetchApprovals = async (status?: string): Promise<ApprovalsResponse> => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.get<ApprovalsResponse>(`/ai-chat/approvals${query}`);
  };

  /**
   * 通过并执行一张审批单
   * @param {string} id - 审批单 ID
   * @returns {Promise<ApprovalActionResponse>} 执行后的审批单
   * @description 后端以「审批人」身份执行（谁批准谁负责，权限也按审批人的算），
   *   权限不足会把单子置为 failed 并在 result 写明原因
   * @example
   * const service = new AiChatService();
   * const res = await service.approveApproval('apr_xxx');
   * console.log(res.data.approval.status);
   */
  approveApproval = async (id: string): Promise<ApprovalActionResponse> => {
    return this.post<ApprovalActionResponse>(
      `/ai-chat/approvals/${encodeURIComponent(id)}/approve`,
    );
  };

  /**
   * 驳回一张审批单
   * @param {string} id - 审批单 ID
   * @returns {Promise<ApprovalActionResponse>} 驳回后的审批单
   * @example
   * const service = new AiChatService();
   * await service.rejectApproval('apr_xxx');
   */
  rejectApproval = async (id: string): Promise<ApprovalActionResponse> => {
    return this.post<ApprovalActionResponse>(
      `/ai-chat/approvals/${encodeURIComponent(id)}/reject`,
    );
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建 AI Chat 服务实例的工厂函数
 * @description 提供 AiChatService 类的实例，确保服务实例的一致性
 * @returns {AiChatService} AI Chat 服务实例
 */
export const createAiChatService = (): AiChatService => new AiChatService();

/**
 * 默认导出的 AI Chat 服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createAiChatService 工厂函数
 */
export default createAiChatService();

// 类型重导出，便于 model 直接 import
export type { ChatConversation };
