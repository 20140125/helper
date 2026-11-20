import type { CacheFilesResponse, CacheFileContentResponse, CacheResult } from '@/types/cache';
import { BaseService } from './base-service';
import { encodeFilenamePath } from '@/utils/format/common';

/**
 * 缓存服务管理类
 * @description 封装缓存文件相关的API接口，提供缓存文件的查询、读取和保存功能
 */
export class CacheService extends BaseService {
  /**
   * 获取缓存文件列表
   * @returns {Promise<CacheFilesResponse>} 缓存文件列表响应
   * @description 从服务端获取所有缓存文件的列表信息
   * @example
   * const service = new CacheService();
   * const result = await service.fetchCacheFiles();
   * console.log('缓存文件列表:', result.files);
   */
  fetchCacheFiles = async (): Promise<CacheFilesResponse> => {
    return this.get<CacheFilesResponse>('/cache');
  };

  /**
   * 读取缓存文件内容
   * @param {string} filename - 缓存文件名
   * @returns {Promise<CacheFileContentResponse>} 缓存文件内容响应
   * @description 根据文件名读取指定缓存文件的内容
   * @example
   * const service = new CacheService();
   * const result = await service.fetchCacheFileContent('example.json');
   * console.log('文件内容:', result.content);
   */
  fetchCacheFileContent = async (filename: string): Promise<CacheFileContentResponse> => {
    return this.get<CacheFileContentResponse>(`/cache/${encodeFilenamePath(filename)}`);
  };

  /**
   * 保存缓存文件内容
   * @param {string} filename - 缓存文件名
   * @param {string} content - 要保存的文件内容
   * @returns {Promise<CacheResult>} 保存操作结果
   * @description 将指定内容保存到对应的缓存文件中
   * @example
   * const service = new CacheService();
   * const result = await service.saveCacheFile('example.json', '{"key":"value"}');
   * if (result.code === 0) {
   *   console.log('保存成功');
   * }
   */
  saveCacheFile = async (filename: string, content: string): Promise<CacheResult> => {
    return this.put<CacheResult>(`/cache/${encodeFilenamePath(filename)}`, { content });
  };
}

/**
 * 创建缓存服务实例的工厂函数
 * @description 提供CacheService类的实例，确保服务实例的一致性
 * @returns {CacheService} 缓存服务实例
 */
export const createCacheService = (): CacheService => {
  return new CacheService();
};

/**
 * 默认导出的缓存服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createCacheService工厂函数
 */
export default createCacheService();
