import type { ConfigResult, ConfigSaveResult } from '@/types/config';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 配置服务管理类
 * @description 封装系统配置相关的API接口，提供配置的读取与保存功能
 */
export class ConfigService extends BaseService {
  /**
   * 获取系统配置
   * @returns {Promise<ConfigResult>} 配置信息
   * @description 从服务端获取当前系统配置的所有键值对
   * @example
   * const service = new ConfigService();
   * const result = await service.fetchConfig();
   * console.log('配置项:', result.config);
   */
  fetchConfig = async (): Promise<ConfigResult> => {
    return this.get<ConfigResult>('/config');
  };

  /**
   * 保存系统配置
   * @param {Record<string, string>} updates - 需要更新的配置键值对
   * @returns {Promise<ConfigSaveResult>} 保存结果对象
   * @description 将指定的配置键值对保存到服务端
   * @example
   * const service = new ConfigService();
   * const result = await service.saveConfig({ theme: 'dark' });
   * if (result.code === 0) {
   *   console.log('保存成功');
   * }
   */
  saveConfig = async (updates: Record<string, string>): Promise<ConfigSaveResult> => {
    return this.post<ConfigSaveResult>('/config', { updates });
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建配置服务实例的工厂函数
 * @description 提供ConfigService类的实例，确保服务实例的一致性
 * @returns {ConfigService} 配置服务实例
 */
export const createConfigService = (): ConfigService => {
  return new ConfigService();
};

/**
 * 默认导出的配置服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createConfigService工厂函数
 */
export default createConfigService();
