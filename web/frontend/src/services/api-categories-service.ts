import type {
  ApiCategoryListResponse,
  ApiCategoryResponse,
  ApiCategory,
} from '@/types/api-management';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 接口分类服务管理类
 * @description 封装接口分类相关的 API 接口，提供分类的增删改查能力
 */
export class ApiCategoriesService extends BaseService {
  /**
   * 获取所有接口分类
   * @returns {Promise<ApiCategoryListResponse>} 分类列表响应
   * @description 从服务端拉取全部接口分类，用于下拉选择与分类管理页
   * @example
   * const service = new ApiCategoriesService();
   * const result = await service.fetchCategories();
   * console.log('分类列表:', result.categories);
   */
  fetchCategories = async (): Promise<ApiCategoryListResponse> => {
    return this.get<ApiCategoryListResponse>('/api-management/categories');
  };

  /**
   * 创建接口分类
   * @param {Partial<ApiCategory>} payload - 分类创建参数
   * @returns {Promise<ApiCategoryResponse>} 创建后的分类响应
   * @description 向服务端提交新接口分类数据并落库
   */
  createCategory = async (payload: Partial<ApiCategory>): Promise<ApiCategoryResponse> => {
    return this.post<ApiCategoryResponse>('/api-management/categories', payload);
  };

  /**
   * 更新接口分类
   * @param {string} id - 分类 ID
   * @param {Partial<ApiCategory>} payload - 分类更新参数
   * @returns {Promise<ApiCategoryResponse>} 更新后的分类响应
   * @description 根据分类 ID 更新指定分类的数据
   */
  updateCategory = async (id: string, payload: Partial<ApiCategory>): Promise<ApiCategoryResponse> => {
    return this.put<ApiCategoryResponse>(`/api-management/categories/${id}`, payload);
  };

  /**
   * 删除接口分类
   * @param {string} id - 分类 ID
   * @returns {Promise<ApiCategoryResponse>} 删除操作响应
   * @description 根据分类 ID 删除指定分类
   */
  deleteCategory = async (id: string): Promise<ApiCategoryResponse> => {
    return this.del<ApiCategoryResponse>(`/api-management/categories/${id}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建接口分类服务实例的工厂函数
 * @description 提供 ApiCategoriesService 类的实例，确保服务实例的一致性
 * @returns {ApiCategoriesService} 接口分类服务实例
 */
export const createApiCategoriesService = (): ApiCategoriesService => new ApiCategoriesService();

/**
 * 默认导出的接口分类服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createApiCategoriesService 工厂函数
 */
export default createApiCategoriesService();
