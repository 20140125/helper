import { BaseService } from './base-service';
import type {
  AmapGeocodeListResponse,
  AmapGeocodeMutationResponse,
  AmapGeocodeWritePayload,
} from '@/types/amap-geocode';

// ==============================
// Service 类
// ==============================

/**
 * 高德地理编码缓存服务类
 * @description 封装独立管理页的地址坐标列表、保存与删除接口
 */
export class AmapGeocodeService extends BaseService {
  /**
   * 按关键字读取地址坐标列表
   * @param {string} keyword - 地址模糊匹配关键字，空串表示全部
   * @returns {Promise<AmapGeocodeListResponse>} 地址坐标列表响应
   * @description 只返回展平表的扁平行，按地址排序
   */
  fetchEntries = (keyword: string): Promise<AmapGeocodeListResponse> =>
    this.get<AmapGeocodeListResponse>('/amap-geocode', { params: { keyword } });

  /**
   * 新增或更新一条地址坐标
   * @param {AmapGeocodeWritePayload} payload - 地址、坐标与可选原地址
   * @returns {Promise<AmapGeocodeMutationResponse>} 保存结果
   * @description 地址变更时后端在事务内删除旧行，避免主键残留
   */
  saveEntry = (payload: AmapGeocodeWritePayload): Promise<AmapGeocodeMutationResponse> =>
    this.put<AmapGeocodeMutationResponse>('/amap-geocode', payload);

  /**
   * 删除一条地址坐标
   * @param {string} address - 地址文本
   * @returns {Promise<AmapGeocodeMutationResponse>} 删除结果
   * @description 按地址定位展平行，删除后运行时缓存下次读取即不再命中
   */
  deleteEntry = (address: string): Promise<AmapGeocodeMutationResponse> =>
    this.del<AmapGeocodeMutationResponse>('/amap-geocode', { params: { address } });
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建高德地理编码缓存服务实例的工厂函数
 * @description 提供 AmapGeocodeService 类的实例，确保服务实例的一致性
 * @returns {AmapGeocodeService} 高德地理编码缓存服务实例
 */
export const createAmapGeocodeService = (): AmapGeocodeService => new AmapGeocodeService();

/**
 * 默认导出的高德地理编码缓存服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createAmapGeocodeService 工厂函数
 */
export default createAmapGeocodeService();
