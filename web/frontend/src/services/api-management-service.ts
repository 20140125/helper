import type {
  ApiCategoryListResponse,
  ApiItemListResponse,
  ApiItemResponse,
  ApiItem,
  ApiExecuteRequest,
  ApiExecuteResponse,
} from '@/types/api-management';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * API 管理服务类
 * @description 封装 API 条目及执行相关的接口，提供分类查询、API 条目增删改查以及服务端代理执行能力
 */
export class ApiManagementService extends BaseService {
  // ==============================
  // 接口分类（只读，用于下拉选择）
  // ==============================

  /**
   * 获取所有接口分类
   * @returns {Promise<ApiCategoryListResponse>} 分类列表响应
   * @description 只读接口，用于 API 条目表单中的分类下拉选择
   * @example
   * const service = new ApiManagementService();
   * const result = await service.fetchCategories();
   * console.log('分类列表:', result.categories);
   */
  fetchCategories = async (): Promise<ApiCategoryListResponse> => {
    return this.get<ApiCategoryListResponse>('/api-management/categories');
  };

  // ==============================
  // API 条目
  // ==============================

  /**
   * 获取 API 条目列表
   * @param {string} [category_id] - 可选，按分类过滤
   * @returns {Promise<ApiItemListResponse>} API 条目列表响应
   * @description 从服务端拉取 API 条目列表，可按分类过滤
   * @example
   * const service = new ApiManagementService();
   * const result = await service.fetchItems('category-123');
   * console.log('API 条目列表:', result.items);
   */
  fetchItems = async (category_id?: string): Promise<ApiItemListResponse> => {
    return this.get<ApiItemListResponse>('/api-management/items', {
      params: category_id ? { category_id } : undefined,
    });
  };

  /**
   * 创建 API 条目
   * @param {Partial<ApiItem>} payload - API 条目创建参数
   * @returns {Promise<ApiItemResponse>} 创建后的 API 条目响应
   * @description 向服务端提交新的 API 条目数据并落库
   * @example
   * const service = new ApiManagementService();
   * const result = await service.createItem({ name: '测试接口', url: '/test' });
   * console.log('创建成功:', result.item);
   */
  createItem = async (payload: Partial<ApiItem>): Promise<ApiItemResponse> => {
    return this.post<ApiItemResponse>('/api-management/items', payload);
  };

  /**
   * 更新 API 条目
   * @param {string} id - API 条目 ID
   * @param {Partial<ApiItem>} payload - API 条目更新参数
   * @returns {Promise<ApiItemResponse>} 更新后的 API 条目响应
   * @description 根据 ID 更新指定 API 条目的数据
   * @example
   * const service = new ApiManagementService();
   * const result = await service.updateItem('item-456', { name: '更新后的接口名称' });
   * console.log('更新成功:', result.item);
   */
  updateItem = async (id: string, payload: Partial<ApiItem>): Promise<ApiItemResponse> => {
    return this.put<ApiItemResponse>(`/api-management/items/${id}`, payload);
  };

  /**
   * 删除 API 条目
   * @param {string} id - API 条目 ID
   * @returns {Promise<ApiItemResponse>} 删除操作响应
   * @description 根据 ID 删除指定 API 条目
   * @example
   * const service = new ApiManagementService();
   * const result = await service.deleteItem('item-789');
   * console.log('删除成功:', result);
   */
  deleteItem = async (id: string): Promise<ApiItemResponse> => {
    return this.del<ApiItemResponse>(`/api-management/items/${id}`);
  };

  // ==============================
  // API 执行
  // ==============================

  /**
   * 执行 API 请求（服务端代理）
   * @param {ApiExecuteRequest} payload - API 执行参数（含请求方法、URL、参数等）
   * @returns {Promise<ApiExecuteResponse>} 接口执行响应结果
   * @description 由服务端代理发起实际 HTTP 请求，避免跨域问题并统一鉴权
   */
  executeApi = async (payload: ApiExecuteRequest): Promise<ApiExecuteResponse> => {
    return this.post<ApiExecuteResponse>('/api-management/items/execute', payload);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建 API 管理服务实例的工厂函数
 * @description 提供 ApiManagementService 类的实例，确保服务实例的一致性
 * @returns {ApiManagementService} API 管理服务实例
 */
export const createApiManagementService = (): ApiManagementService => new ApiManagementService();

/**
 * 默认导出的 API 管理服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createApiManagementService 工厂函数
 */
export default createApiManagementService();
