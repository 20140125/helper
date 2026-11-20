import type {
  ReminderQuotesListResponse,
  ReminderQuoteResponse,
  CreateReminderQuotePayload,
  UpdateReminderQuotePayload,
} from '@/types/reminder-quotes';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 提醒寄语服务管理类
 * @description 封装寄语库相关的 API 接口，提供寄语条目的增删改查能力
 */
export class ReminderQuotesService extends BaseService {
  /**
   * 获取所有寄语条目（扁平化）
   * @returns {Promise<ReminderQuotesListResponse>} 寄语列表响应
   * @description 从服务端拉取全部寄语条目，已按场景维度扁平化
   * @example
   * const service = new ReminderQuotesService();
   * const result = await service.fetchReminderQuotes();
   * console.log('寄语列表:', result.quotes);
   */
  fetchReminderQuotes = async (): Promise<ReminderQuotesListResponse> => {
    return this.get<ReminderQuotesListResponse>('/reminder-quotes');
  };

  /**
   * 创建寄语条目
   * @param {CreateReminderQuotePayload} payload - 寄语创建参数
   * @returns {Promise<ReminderQuoteResponse>} 创建后的寄语响应
   * @description 向服务端提交新的寄语数据并落库
   * @example
   * const service = new ReminderQuotesService();
   * const result = await service.createReminderQuote({ scene: 'morning', content: '...' });
   * console.log('创建的寄语:', result.quote);
   */
  createReminderQuote = async (payload: CreateReminderQuotePayload): Promise<ReminderQuoteResponse> => {
    return this.post<ReminderQuoteResponse>('/reminder-quotes', payload);
  };

  /**
   * 更新寄语条目
   * @param {string} id - 寄语唯一标识
   * @param {UpdateReminderQuotePayload} payload - 寄语更新参数
   * @returns {Promise<ReminderQuoteResponse>} 更新后的寄语响应
   * @description 根据 ID 更新指定寄语的数据
   * @example
   * const service = new ReminderQuotesService();
   * const result = await service.updateReminderQuote('abc123', { content: '新内容' });
   * console.log('更新后的寄语:', result.quote);
   */
  updateReminderQuote = async (id: string, payload: UpdateReminderQuotePayload): Promise<ReminderQuoteResponse> => {
    return this.put<ReminderQuoteResponse>(`/reminder-quotes/${encodeURIComponent(id)}`, payload);
  };

  /**
   * 删除寄语条目
   * @param {string} id - 寄语唯一标识
   * @returns {Promise<ReminderQuoteResponse>} 删除操作响应
   * @description 根据 ID 删除指定寄语条目
   * @example
   * const service = new ReminderQuotesService();
   * const result = await service.deleteReminderQuote('abc123');
   * if (result.code === 0) {
   *   console.log('删除成功');
   * }
   */
  deleteReminderQuote = async (id: string): Promise<ReminderQuoteResponse> => {
    return this.del<ReminderQuoteResponse>(`/reminder-quotes/${encodeURIComponent(id)}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建寄语服务实例的工厂函数
 * @description 提供 ReminderQuotesService 类的实例，确保服务实例的一致性
 * @returns {ReminderQuotesService} 寄语服务实例
 */
export const createReminderQuotesService = (): ReminderQuotesService => new ReminderQuotesService();

/**
 * 默认导出的寄语服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createReminderQuotesService 工厂函数
 */
export default createReminderQuotesService();
