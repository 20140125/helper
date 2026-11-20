import type { TriggerScriptsResponse, TriggerResult } from '@/types/trigger';
import type { UpdateToolKey, UpdateToolsResult } from '@/types/update-tools';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 触发器服务管理类
 * @description 封装手动触发脚本和 update-tools 相关的 API 接口
 */
export class TriggerService extends BaseService {
  /**
   * 获取当前用户可见的脚本列表（按 view 权限过滤）
   * @returns {Promise<TriggerScriptsResponse>} 脚本列表
   * @description 后端根据用户权限返回可见的脚本，包含 canEdit 标记
   * @example
   * const service = new TriggerService();
   * const result = await service.fetchScripts();
   * console.log('脚本列表:', result.scripts);
   */
  fetchScripts = async (): Promise<TriggerScriptsResponse> => {
    return this.get<TriggerScriptsResponse>('/trigger');
  };

  /**
   * 手动触发脚本
   * @param {string} script - 要触发的脚本标识
   * @returns {Promise<TriggerResult>} 脚本执行结果
   * @example
   * const service = new TriggerService();
   * const result = await service.triggerScript('deploy');
   * console.log('执行结果:', result.code);
   */
  triggerScript = async (script: string): Promise<TriggerResult> => {
    return this.post<TriggerResult>(`/trigger/${script}`);
  };

  /**
   * 获取 update-tools 脚本列表
   * @returns {Promise<UpdateToolsResult>} 脚本列表结果
   * @description 从服务端获取所有可用的 update-tools 脚本列表
   * @example
   * const service = new TriggerService();
   * const result = await service.fetchUpdateTools();
   * console.log('脚本列表:', result.scripts);
   */
  fetchUpdateTools = async (): Promise<UpdateToolsResult> => {
    return this.get<UpdateToolsResult>('/update-tools');
  };

  /**
   * 触发 update-tools 脚本
   * @param {UpdateToolKey} script - 要触发的脚本标识
   * @param {string[]} args - 脚本执行参数列表
   * @returns {Promise<TriggerResult>} 脚本执行结果
   * @description 触发指定的 update-tools 脚本并传入参数
   * @example
   * const service = new TriggerService();
   * const result = await service.triggerUpdateTool('update-node', ['--force']);
   * console.log('执行结果:', result.code);
   */
  triggerUpdateTool = async (script: UpdateToolKey, args: string[]): Promise<TriggerResult> => {
    return this.post<TriggerResult>(`/update-tools/${script}`, { args });
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建触发器服务实例的工厂函数
 * @description 提供 TriggerService 类的实例，确保服务实例的一致性
 * @returns {TriggerService} 触发器服务实例
 */
export const createTriggerService = (): TriggerService => {
  return new TriggerService();
};

/**
 * 默认导出的触发器服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createTriggerService 工厂函数
 */
export default createTriggerService();
