import type { ApiResponse } from './api';
import type { SystemStatusData } from './status';
import type { WebServiceStatusData } from './web-service';
import type { Rule } from './rule';
import type { LogSourceInfo } from './log';

/**
 * 首页首屏聚合数据
 * @description 后端按各子接口原有权限码逐块返回，未授权的块为 undefined
 */
export interface BootstrapData {
  /** 系统状态 */
  system?: SystemStatusData;
  /** Web 服务状态 */
  webService?: WebServiceStatusData;
  /** 自定义规则列表 */
  rules?: Rule[];
  /** 日志来源列表 */
  logs?: LogSourceInfo[];
}

/** 首屏聚合接口响应 */
export type BootstrapResponse = ApiResponse<BootstrapData>;
