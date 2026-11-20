/**
 * 权限申请记录
 */
export interface PermissionRequestItem {
  request_id: string;
  email: string;
  fromPath: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolvedAt?: string;
  resolvedBy?: string;
  rejectReason?: string;
}

/**
 * 权限申请列表查询参数
 */
export interface PermissionRequestListParams {
  status?: 'all' | 'pending' | 'approved' | 'rejected';
  page?: number;
  pageSize?: number;
}

/**
 * 权限申请列表响应
 */
export interface PermissionRequestListResponse {
  code: number;
  message: string;
  data: {
    items: PermissionRequestItem[];
    total: number;
    page: number;
    pageSize: number;
    pendingCount: number;
  };
}

/**
 * 权限申请操作响应（批准/拒绝）
 */
export interface PermissionRequestActionResponse {
  code: number;
  message: string;
}
