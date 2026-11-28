import { BaseService } from './base-service';
import type {
  NavigationResponse,
  NavigationMutationResponse,
  NavGroup,
  NavItem,
} from '@/types/navigation';

/**
 * 侧边栏导航服务类
 * @description 封装导航分组与页面注册表的读取、保存与删除接口
 */
export class NavigationService extends BaseService {
  /**
   * 读取当前用户可见的分组与页面
   * @returns {Promise<NavigationResponse>} 导航数据响应
   * @description 服务端按用户权限裁剪；导航管理页维护者拿到全量（含停用项与隐藏项）
   */
  fetchNavigation = (): Promise<NavigationResponse> =>
    this.get<NavigationResponse>('/navigation');

  /**
   * 新增分组
   * @param {NavGroup} group - 分组数据
   * @returns {Promise<NavigationMutationResponse>} 保存结果
   */
  saveGroup = (group: NavGroup): Promise<NavigationMutationResponse> =>
    this.post<NavigationMutationResponse>('/navigation/groups', group);

  /**
   * 更新分组
   * @param {string} groupKey - 分组标识
   * @param {NavGroup} group - 分组数据
   * @returns {Promise<NavigationMutationResponse>} 保存结果
   */
  updateGroup = (groupKey: string, group: NavGroup): Promise<NavigationMutationResponse> =>
    this.put<NavigationMutationResponse>(`/navigation/groups/${encodeURIComponent(groupKey)}`, group);

  /**
   * 删除分组
   * @param {string} groupKey - 分组标识
   * @returns {Promise<NavigationMutationResponse>} 删除结果
   */
  deleteGroup = (groupKey: string): Promise<NavigationMutationResponse> =>
    this.del<NavigationMutationResponse>(`/navigation/groups/${encodeURIComponent(groupKey)}`);

  /**
   * 新增页面
   * @param {NavItem} item - 页面数据
   * @returns {Promise<NavigationMutationResponse>} 保存结果
   */
  saveItem = (item: NavItem): Promise<NavigationMutationResponse> =>
    this.post<NavigationMutationResponse>('/navigation/items', item);

  /**
   * 更新页面
   * @param {string} routeName - 路由名
   * @param {NavItem} item - 页面数据
   * @returns {Promise<NavigationMutationResponse>} 保存结果
   */
  updateItem = (routeName: string, item: NavItem): Promise<NavigationMutationResponse> =>
    this.put<NavigationMutationResponse>(`/navigation/items/${encodeURIComponent(routeName)}`, item);

  /**
   * 删除页面
   * @param {string} routeName - 路由名
   * @returns {Promise<NavigationMutationResponse>} 删除结果
   */
  deleteItem = (routeName: string): Promise<NavigationMutationResponse> =>
    this.del<NavigationMutationResponse>(`/navigation/items/${encodeURIComponent(routeName)}`);


}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建导航服务实例的工厂函数
 * @returns {NavigationService} 导航服务实例
 */
export const createNavigationService = (): NavigationService => new NavigationService();

/**
 * 默认导出的导航服务实例
 * @description 为向后兼容性保留，推荐使用 createNavigationService 工厂函数
 */
export default createNavigationService();
