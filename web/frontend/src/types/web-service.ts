import type { ApiResponse } from './api';

/**
 * Web服务状态数据
 * @description 描述Web服务的运行状态信息
 */
export interface WebServiceStatusData {
  /** 服务是否运行中 */
  running: boolean;
  /** 服务进程 PID（未运行为 null） */
  pid: number | null;
  /** 启动器进程 PID（未运行为 null） */
  launcherPid: number | null;
}

/**
 * Web服务状态响应接口
 */
export type WebServiceStatus = ApiResponse<WebServiceStatusData>;

/**
 * Web服务操作结果接口
 * @description 描述Web服务操作（启动/停止/重启）的返回结果
 */
export type WebServiceResult = ApiResponse<{ stdout?: string; stderr?: string }>;

/**
 * 进程ID项
 * @description 描述进程ID的标签和PID信息
 */
export interface PidItem {
  /** 进程标签（用于展示） */
  label: string;
  /** 进程 PID，未运行时为 null */
  pid: number | null;
}
