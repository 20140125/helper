import type { BootstrapResponse } from '@/types/bootstrap';
import { BaseService } from './base-service';

/**
 * 首屏聚合数据服务类
 * @description 封装首页首屏聚合接口，一次请求替代系统状态、Web 服务状态、规则、日志四次请求
 */
export class BootstrapService extends BaseService {
  /**
   * 获取首页首屏聚合数据
   * @returns {Promise<BootstrapResponse>} 首屏聚合数据
   * @description 合并返回系统状态、Web 服务状态、规则列表与日志列表；后端按权限裁剪
   * @example
   * const service = new BootstrapService();
   * const { data } = await service.fetchBootstrap();
   */
  fetchBootstrap = async (): Promise<BootstrapResponse> => {
    return this.get<BootstrapResponse>('/bootstrap');
  };

  /**
   * 获取状态轮询快照
   * @returns {Promise<BootstrapResponse>} 仅含系统状态与 Web 服务状态的聚合响应
   * @description 通过 only 参数让后端跳过规则与日志读取，一次请求替代轮询中的两个状态接口
   * @example
   * const service = new BootstrapService();
   * const { data } = await service.fetchStatusSnapshot();
   * if (data.webService) statusStore.hydrateWebService(data.webService);
   */
  fetchStatusSnapshot = async (): Promise<BootstrapResponse> => {
    return this.get<BootstrapResponse>('/bootstrap', { params: { only: 'system,webService' } });
  };
}

/**
 * 创建首屏聚合数据服务实例的工厂函数
 * @description 提供 BootstrapService 类的单例实例，确保服务实例的一致性
 * @returns {BootstrapService} 首屏聚合数据服务实例
 */
export const createBootstrapService = (): BootstrapService => {
  return new BootstrapService();
};

/**
 * 默认导出的首屏聚合数据服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createBootstrapService 工厂函数
 */
export default createBootstrapService();
