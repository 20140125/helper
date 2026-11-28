/** 权限申请记录 */
export interface PermissionRequest {
  /** 请求唯一 ID */
  request_id: string;
  /** 申请人邮箱 */
  email: string;
  /** 申请人希望访问的页面路径 */
  fromPath: string;
  /** 申请原因（由前端传入，可为空） */
  reason?: string;
  /** 申请状态 */
  status: 'pending' | 'approved' | 'rejected';
  /** 申请时间 */
  created_at: string;
  /** 审批时间 */
  resolvedAt?: string;
  /** 操作人（管理员邮箱或 "system"） */
  resolvedBy?: string;
  /** 拒绝原因 */
  rejectReason?: string;
}

/** 权限申请存储结构 */
export interface PermissionRequestsStore {
  requests: PermissionRequest[];
}

/** 提交申请请求体 */
export interface ApplyPermissionBody {
  fromPath?: string;
  reason?: string;
}

/** 审批申请请求体 */
export interface ApprovePermissionBody {
  id?: string;
  resolvedBy?: string;
}

/** 拒绝申请请求体 */
export interface RejectPermissionBody {
  id?: string;
  rejectReason?: string;
  resolvedBy?: string;
}
