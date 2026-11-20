import type { WebhookPayload, WebhooksResponse, WebhookResponse, WebhookDeleteResult } from '@/types/webhook';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * Webhook服务管理类
 * @description 封装Webhook相关的API接口，提供统一的Webhook管理操作
 */
export class WebhookService extends BaseService {
  /**
   * 获取Webhook列表
   * @returns {Promise<{ code: number; webhooks: Webhook[] }>} Webhook列表数据
   * @description 从服务端获取所有已配置的Webhook列表
   * @example
   * const service = new WebhookService();
   * const result = await service.fetchWebhooks();
   * console.log('Webhook列表:', result.webhooks);
   */
  fetchWebhooks = async (): Promise<WebhooksResponse> => {
    return this.get<WebhooksResponse>('/webhooks');
  };

  /**
   * 创建Webhook
   * @param {WebhookPayload} payload - Webhook创建参数
   * @returns {Promise<{ code: number; webhook: Webhook }>} 创建结果及新Webhook数据
   * @description 创建一个新的Webhook配置
   * @example
   * const service = new WebhookService();
   * const result = await service.createWebhook({ name: 'test', url: 'https://...' });
   * if (result.code === 0) {
   *   console.log('创建成功:', result.webhook);
   * }
   */
  createWebhook = async (payload: WebhookPayload): Promise<WebhookResponse> => {
    return this.post<WebhookResponse>('/webhooks', payload);
  };

  /**
   * 更新Webhook
   * @param {string} id - Webhook唯一标识符
   * @param {Partial<WebhookPayload>} payload - 需要更新的Webhook字段
   * @returns {Promise<{ code: number; webhook: Webhook }>} 更新结果及更新后的Webhook数据
   * @description 根据ID更新指定Webhook的配置信息
   * @example
   * const service = new WebhookService();
   * const result = await service.updateWebhook('abc123', { name: 'new-name' });
   * if (result.code === 0) {
   *   console.log('更新成功:', result.webhook);
   * }
   */
  updateWebhook = async (id: string, payload: Partial<WebhookPayload>): Promise<WebhookResponse> => {
    return this.put<WebhookResponse>(`/webhooks/${id}`, payload);
  };

  /**
   * 删除Webhook
   * @param {string} id - Webhook唯一标识符
   * @returns {Promise<{ code: number; message: string }>} 删除操作结果
   * @description 根据ID删除指定的Webhook配置
   * @example
   * const service = new WebhookService();
   * const result = await service.deleteWebhook('abc123');
   * if (result.code === 0) {
   *   console.log('删除成功');
   * }
   */
  deleteWebhook = async (id: string): Promise<WebhookDeleteResult> => {
    return this.del<WebhookDeleteResult>(`/webhooks/${id}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建Webhook服务实例的工厂函数
 * @description 提供WebhookService类的实例，确保服务实例的一致性
 * @returns {WebhookService} Webhook服务实例
 */
export const createWebhookService = (): WebhookService => {
  return new WebhookService();
};

/**
 * 默认导出的Webhook服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createWebhookService工厂函数
 */
export default createWebhookService();
