import type {
  AiChatAdminRunsParams,
  AiChatAdminRunsResponse,
  AiChatAdminDetailResponse,
} from '@/types/ai-chat-admin';
import { BaseService } from './base-service';

/**
 * AI 回话管理页接口服务
 * @description 封装 `/api/ai-chat-admin` 的只读接口：分页运行列表与单次运行详情。
 */
export class AiChatAdminService extends BaseService {
  /**
   * 分页获取 AI 运行列表
   * @param {AiChatAdminRunsParams} params - 天数、范围、关键词与分页参数
   * @returns {Promise<AiChatAdminRunsResponse>} 当前页运行记录与总数
   * @description 列表不含逐轮 steps；scope=all 仅管理员生效，后端会把越权请求降级为 me。
   */
  fetchRuns = async (params: AiChatAdminRunsParams): Promise<AiChatAdminRunsResponse> => {
    const query = new URLSearchParams();
    if (params.days) query.set('days', String(params.days));
    if (params.scope) query.set('scope', params.scope);
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    query.set('onlyWithMessages', String(params.onlyWithMessages ?? true));
    return this.get<AiChatAdminRunsResponse>(`/ai-chat-admin/runs?${query.toString()}`);
  };

  /**
   * 获取单次运行详情
   * @param {string} runId - 运行 ID
   * @param {string} [messageScope='run'] - run=仅本次运行消息，conversation=完整会话消息
   * @returns {Promise<AiChatAdminDetailResponse>} 逐轮用量、工具调用明细与会话消息
   * @description 详情接口才返回 steps 明文与消息正文；默认只回传本次运行消息，避免重复展示历史。
   */
  fetchRunDetail = async (runId: string, messageScope: string = 'run'): Promise<AiChatAdminDetailResponse> => {
    const query = new URLSearchParams({ messageScope });
    return this.get<AiChatAdminDetailResponse>(`/ai-chat-admin/runs/${encodeURIComponent(runId)}?${query.toString()}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建 AI 回话管理页服务实例的工厂函数
 * @description 提供 AiChatAdminService 类的实例，确保服务实例的一致性
 * @returns {AiChatAdminService} 服务实例
 */
export const createAiChatAdminService = (): AiChatAdminService => new AiChatAdminService();

/**
 * 默认导出的 AI 回话管理页服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createAiChatAdminService 工厂函数
 */
export default createAiChatAdminService();
