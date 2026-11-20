import type {
  PermissionRequestListParams,
  PermissionRequestListResponse,
  PermissionRequestActionResponse,
} from '@/types/permission-request';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 权限申请服务管理类
 * @description 封装权限申请相关的 API 接口，提供申请记录查询及批准/拒绝能力
 */
export class PermissionRequestService extends BaseService {
  /**
   * 获取权限申请列表
   * @param {PermissionRequestListParams} params - 查询参数（状态筛选、分页）
   * @returns {Promise<PermissionRequestListResponse>} 申请列表响应
   * @description 从服务端拉取权限申请记录，支持按状态过滤与分页
   * @example
   * const service = new PermissionRequestService();
   * const result = await service.fetchList({ status: 'pending', page: 1, pageSize: 20 });
   * console.log('申请列表:', result.list);
   */
  fetchList = async (params: PermissionRequestListParams): Promise<PermissionRequestListResponse> => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return this.get<PermissionRequestListResponse>(`/permission-apply/list?${query.toString()}`);
  };

  /**
   * 批准权限申请
   * @param {string} id - 申请记录 ID
   * @param {string} [resolvedBy] - 处理人（可选）
   * @returns {Promise<PermissionRequestActionResponse>} 批准操作响应
   * @description 批准指定申请记录，批准后由后端同步更新用户权限并推送企微通知
   */
  approveById = async (id: string, resolvedBy?: string): Promise<PermissionRequestActionResponse> => {
    return this.post<PermissionRequestActionResponse>('/permission-apply/approve-by-id', { id, resolvedBy });
  };

  /**
   * 拒绝权限申请
   * @param {string} id - 申请记录 ID
   * @param {string} [rejectReason] - 拒绝原因（可选）
   * @param {string} [resolvedBy] - 处理人（可选）
   * @returns {Promise<PermissionRequestActionResponse>} 拒绝操作响应
   * @description 拒绝指定申请记录，拒绝后后端会推送含拒绝原因的企微通知给申请人
   */
  rejectById = async (id: string, rejectReason?: string, resolvedBy?: string): Promise<PermissionRequestActionResponse> => {
    return this.post<PermissionRequestActionResponse>('/permission-apply/reject', { id, rejectReason, resolvedBy });
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建权限申请服务实例的工厂函数
 * @description 提供 PermissionRequestService 类的实例，确保服务实例的一致性
 * @returns {PermissionRequestService} 权限申请服务实例
 */
export const createPermissionRequestService = (): PermissionRequestService => new PermissionRequestService();

/**
 * 默认导出的权限申请服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createPermissionRequestService 工厂函数
 */
export default createPermissionRequestService();
