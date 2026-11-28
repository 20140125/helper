import { BaseService } from './base-service';
import type {
  AppBackgroundMutationResponse,
  AppBackgroundResponse,
  AppBackgroundSaveResponse,
  AppBackgroundUploadResponse,
} from '@/types/app-background';

// ==============================
// Service 类
// ==============================

/**
 * 系统背景图服务类
 * @description 封装背景配置的读取、图片上传、设置与清除接口
 */
export class AppBackgroundService extends BaseService {
  /**
   * 读取当前系统背景图地址
   * @returns {Promise<AppBackgroundResponse>} 背景配置
   * @description 公开接口，登录页与首屏启动时调用
   */
  fetchBackground = (): Promise<AppBackgroundResponse> =>
    this.get<AppBackgroundResponse>('/app-background');

  /**
   * 上传背景图
   * @param {File} file - 待上传的图片文件
   * @returns {Promise<AppBackgroundUploadResponse>} 站内相对地址
   * @description 用 FormData 交给 axios 自动设置 multipart boundary
   */
  uploadBackground = (file: File): Promise<AppBackgroundUploadResponse> => {
    const form = new FormData();
    form.append('file', file);
    return this.post<AppBackgroundUploadResponse>('/app-background/upload', form);
  };

  /**
   * 保存系统背景图本体
   * @param {string} url - 上传返回的图片本体 data URL
   * @returns {Promise<AppBackgroundSaveResponse>} 保存结果（含站内短地址）
   * @description 服务端把图片写入 hp_app_background，只返回几十字符的短地址
   */
  saveBackground = (url: string): Promise<AppBackgroundSaveResponse> =>
    this.put<AppBackgroundSaveResponse>('/app-background', { url });

  /**
   * 清除系统背景，恢复默认主题
   * @returns {Promise<AppBackgroundMutationResponse>} 清除结果
   * @description 只清空配置，不删除已上传的图片文件
   */
  clearBackground = (): Promise<AppBackgroundMutationResponse> =>
    this.del<AppBackgroundMutationResponse>('/app-background');
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建系统背景图服务实例的工厂函数
 * @description 提供 AppBackgroundService 类的实例，确保服务实例的一致性
 * @returns {AppBackgroundService} 系统背景图服务实例
 */
export const createAppBackgroundService = (): AppBackgroundService => new AppBackgroundService();

/**
 * 默认导出的系统背景图服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createAppBackgroundService 工厂函数
 */
export default createAppBackgroundService();
