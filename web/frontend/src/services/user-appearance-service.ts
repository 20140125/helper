import { BaseService } from './base-service';
import type {
  UserAppearanceMutationResponse,
  UserAppearanceResponse,
} from '@/types/user-appearance';

// ==============================
// Service 类
// ==============================

/**
 * 按用户外观偏好服务类
 * @description 封装背景图遮挡层不透明度的读取与保存接口
 */
export class UserAppearanceService extends BaseService {
  /**
   * 读取当前登录用户的外观偏好
   * @returns {Promise<UserAppearanceResponse>} 外观偏好
   * @description 按 JWT 用户隔离，未设置时后端返回默认值
   */
  fetchAppearance = (): Promise<UserAppearanceResponse> =>
    this.get<UserAppearanceResponse>('/user-appearance');

  /**
   * 保存当前登录用户的遮挡层不透明度
   * @param {number} surfaceOpacity - 不透明度百分比（20–100）
   * @returns {Promise<UserAppearanceMutationResponse>} 保存结果
   * @description 服务端只接受 20–100 的整数，其余返回 400
   */
  updateSurfaceOpacity = (surfaceOpacity: number): Promise<UserAppearanceMutationResponse> =>
    this.put<UserAppearanceMutationResponse>('/user-appearance', { surfaceOpacity });
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建按用户外观偏好服务实例的工厂函数
 * @description 提供 UserAppearanceService 类的实例，确保服务实例的一致性
 * @returns {UserAppearanceService} 按用户外观偏好服务实例
 */
export const createUserAppearanceService = (): UserAppearanceService => new UserAppearanceService();

/**
 * 默认导出的按用户外观偏好服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createUserAppearanceService 工厂函数
 */
export default createUserAppearanceService();
