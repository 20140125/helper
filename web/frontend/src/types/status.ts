import type { ApiResponse } from './api';

/** 系统状态数据 */
export interface SystemStatusData {
  projectDir: string;
  daemonRunning: boolean;
  daemonPid: number | null;
  /** 年度调度器进程 PID，进程未运行时为 null */
  annualPid: number | null;
  /** 守护进程启动时间戳（毫秒），进程未运行时为 null */
  daemonStartTime: number | null;
  cacheFiles: number;
  serverTime: string;
  /** 主机名 */
  hostname: string;
  /** 操作系统发行版名称 */
  osRelease: string;
  /** 内核版本 */
  kernelVersion: string;
  /** CPU 核心数 */
  cpuCores: number;
  /** 内存信息（字节） */
  memory: {
    total: number;
    used: number;
    free: number;
  };
  /** 根分区磁盘信息（字节），获取失败时为 null */
  disk: {
    total: number;
    used: number;
    free: number;
  } | null;
  /** 系统运行时长（秒） */
  systemUptime: number;
  /** Node.js 版本 */
  nodeVersion: string;
}

/** 系统状态响应 */
export type SystemStatus = ApiResponse<SystemStatusData>;

/** 守护进程操作结果（启动/停止/重启） */
export type DaemonActionResult = ApiResponse<{ stdout?: string }>;
