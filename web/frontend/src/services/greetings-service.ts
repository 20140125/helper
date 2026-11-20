import type {
  GreetingsListResponse,
  GreetingResponse,
  CreateGreetingPayload,
  UpdateGreetingPayload,
} from '@/types/greetings';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 节日祝福语服务管理类
 * @description 封装祝福语相关的 API 接口，提供祝福语条目的增删改查能力
 */
export class GreetingsService extends BaseService {
  /**
   * 获取所有祝福语条目（扁平化）
   * @returns {Promise<GreetingsListResponse>} 祝福语列表响应
   * @description 从服务端拉取全部祝福语条目，已按节日维度扁平化
   * @example
   * const service = new GreetingsService();
   * const result = await service.fetchGreetings();
   * console.log('祝福语列表:', result.greetings);
   */
  fetchGreetings = async (): Promise<GreetingsListResponse> => {
    return this.get<GreetingsListResponse>('/greetings');
  };

  /**
   * 创建祝福语条目
   * @param {CreateGreetingPayload} payload - 祝福语创建参数
   * @returns {Promise<GreetingResponse>} 创建后的祝福语响应
   * @description 向服务端提交新的祝福语数据并落库
   * @example
   * const service = new GreetingsService();
   * const result = await service.createGreeting({ festival: '春节', content: '...' });
   * console.log('创建的祝福语:', result.greeting);
   */
  createGreeting = async (payload: CreateGreetingPayload): Promise<GreetingResponse> => {
    return this.post<GreetingResponse>('/greetings', payload);
  };

  /**
   * 更新祝福语条目
   * @param {string} id - 祝福语唯一标识
   * @param {UpdateGreetingPayload} payload - 祝福语更新参数
   * @returns {Promise<GreetingResponse>} 更新后的祝福语响应
   * @description 根据 ID 更新指定祝福语的数据
   * @example
   * const service = new GreetingsService();
   * const result = await service.updateGreeting('abc123', { content: '新内容' });
   * console.log('更新后的祝福语:', result.greeting);
   */
  updateGreeting = async (id: string, payload: UpdateGreetingPayload): Promise<GreetingResponse> => {
    return this.put<GreetingResponse>(`/greetings/${encodeURIComponent(id)}`, payload);
  };

  /**
   * 删除祝福语条目
   * @param {string} id - 祝福语唯一标识
   * @returns {Promise<GreetingResponse>} 删除操作响应
   * @description 根据 ID 删除指定祝福语条目
   * @example
   * const service = new GreetingsService();
   * const result = await service.deleteGreeting('abc123');
   * if (result.code === 0) {
   *   console.log('删除成功');
   * }
   */
  deleteGreeting = async (id: string): Promise<GreetingResponse> => {
    return this.del<GreetingResponse>(`/greetings/${encodeURIComponent(id)}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建祝福语服务实例的工厂函数
 * @description 提供 GreetingsService 类的实例，确保服务实例的一致性
 * @returns {GreetingsService} 祝福语服务实例
 */
export const createGreetingsService = (): GreetingsService => new GreetingsService();

/**
 * 默认导出的祝福语服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createGreetingsService 工厂函数
 */
export default createGreetingsService();
