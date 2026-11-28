import type { Rule } from '@/types/rule';
import type { WebServiceStatus } from '@/types/web-service';
import type { LogSourceInfo } from '@/types/log';

/**
 * 首屏聚合数据块标识
 * @description GET /api/bootstrap 的 only 参数白名单，用于指定只构造哪些数据块
 */
export type BootstrapDataKey = 'system' | 'webService' | 'rules' | 'logs';

/**
 * 系统状态快照
 * @description 与 GET /api/system 返回结构一致，供首屏聚合接口复用
 */
export interface SystemStatusSnapshot {
  /** 项目根目录 */
  projectDir: string;
  /** 守护进程是否运行 */
  daemonRunning: boolean;
  /** 守护进程 PID */
  daemonPid: number | null;
  /** 守护进程启动时间戳（毫秒） */
  daemonStartTime: number | null;
  /** 年度调度器 PID */
  annualPid: number | null;
  /** 缓存文件数量 */
  cacheFiles: number;
  /** 服务器时间 */
  serverTime: string;
  /** 主机名 */
  hostname: string;
  /** 操作系统发行版 */
  osRelease: string;
  /** 内核版本 */
  kernelVersion: string;
  /** CPU 逻辑核心数 */
  cpuCores: number;
  /** 内存信息（字节） */
  memory: { total: number; used: number; free: number };
  /** 磁盘信息（字节），获取失败时为 null */
  disk: { total: number; used: number; free: number } | null;
  /** 系统运行时长（秒） */
  systemUptime: number;
  /** Node.js 版本 */
  nodeVersion: string;
}

/**
 * 首页首屏聚合数据
 * @description 按各子接口原有的权限码逐块裁剪，未授权的块不出现在响应中
 */
export interface BootstrapData {
  /** 系统状态：需 dashboard:view */
  system?: SystemStatusSnapshot;
  /** Web 服务状态：需 web-service:view */
  webService?: WebServiceStatus;
  /** 自定义规则列表：需 rules:view */
  rules?: Rule[];
  /** 日志来源列表：需 logs:view */
  logs?: LogSourceInfo[];
}
