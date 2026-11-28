import os from 'os';
import path from 'path';
import { PROJECT_DIR, CACHE_DIR } from '@/utils/paths';
import { formatDate } from '@/utils/script';
import { countCacheFiles } from '@/utils/cache';
import {
  getOsRelease,
  getMemoryInfo,
  getDiskInfo,
  getSystemUptime,
  readDaemonPidInfo,
  readAnnualPid,
} from '@/utils/system';
import { readRules } from '@/utils/storage';
import { listLogSources } from '@/utils/logs';
import { readWebServiceStatus } from '@/utils/web-service';
import { Permission } from '@/types/permission';
import type { WebServiceStatus } from '@/types/web-service';
import type { BootstrapData, BootstrapDataKey, SystemStatusSnapshot } from '@/types/bootstrap';

/**
 * 读取系统状态快照
 * @returns {Promise<SystemStatusSnapshot>} 与 GET /api/system 一致的系统状态
 * @description 抽成公共函数供 /api/system 与 /api/bootstrap 复用，避免两处重复构造；
 *   缓存条目数来自数据库，故本函数为异步
 */
export const getSystemStatus = async (): Promise<SystemStatusSnapshot> => {
  const daemonPidFile = path.join(PROJECT_DIR, 'scripts/reminder_daemon.pid');
  const annualPidFile = path.join(PROJECT_DIR, 'scripts/annual_scheduler.pid');
  const { pid: daemonPid, isRunning: daemonRunning, startTime: daemonStartTime } = readDaemonPidInfo(daemonPidFile);
  const annualPid = readAnnualPid(annualPidFile);

  return {
    projectDir: PROJECT_DIR,
    daemonRunning,
    daemonPid,
    daemonStartTime,
    annualPid,
    cacheFiles: await countCacheFiles(CACHE_DIR),
    serverTime: formatDate(),
    hostname: os.hostname(),
    osRelease: getOsRelease(),
    kernelVersion: os.release(),
    cpuCores: os.cpus().length,
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    systemUptime: getSystemUptime(),
    nodeVersion: process.version,
  };
};

/**
 * 以 Promise 形式读取 Web 服务状态
 * @returns {Promise<WebServiceStatus>} Web 服务运行状态
 * @description 底层工具是回调式异步，这里包装一层以便聚合接口并发等待
 */
const readWebServiceStatusAsync = (): Promise<WebServiceStatus> =>
  new Promise((resolve) => {
    readWebServiceStatus(resolve);
  });

/**
 * 解析 only 查询参数
 * @param {unknown} raw - express 原始查询值
 * @returns {BootstrapDataKey[] | null | undefined} undefined 表示返回全部数据块；null 表示参数非法
 * @description 按逗号切分并校验白名单，去重后交给聚合函数跳过不需要的数据块
 */
export const parseBootstrapOnly = (raw: unknown): BootstrapDataKey[] | null | undefined => {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') return null;
  const supportedKeys: BootstrapDataKey[] = ['system', 'webService', 'rules', 'logs'];
  const keys = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (keys.length === 0 || keys.some((key) => !supportedKeys.includes(key as BootstrapDataKey))) return null;
  return [...new Set(keys)] as BootstrapDataKey[];
};

/**
 * 构建首页首屏聚合数据
 * @param {Permission[]} permissions - 当前登录用户的权限码列表
 * @param {BootstrapDataKey[]} [only] - 只构造指定的数据块，缺省时构造全部
 * @returns {Promise<BootstrapData>} 按权限与 only 裁剪后的聚合数据
 * @description 每一块沿用原接口的权限码；系统状态需查库，Web 服务状态与日志并发获取避免串行等待
 */
export const buildBootstrapData = async (
  permissions: Permission[],
  only?: BootstrapDataKey[],
): Promise<BootstrapData> => {
  const can = (permission: Permission): boolean => permissions.includes(permission);
  const wants = (key: BootstrapDataKey): boolean => !only || only.includes(key);
  const data: BootstrapData = {};

  if (wants('system') && can(Permission.DASHBOARD_VIEW)) data.system = await getSystemStatus();
  if (wants('rules') && can(Permission.RULES_VIEW)) data.rules = await readRules();

  const [webService, logs] = await Promise.all([
    wants('webService') && can(Permission.WEB_SERVICE_VIEW) ? readWebServiceStatusAsync() : Promise.resolve(undefined),
    wants('logs') && can(Permission.LOGS_VIEW) ? listLogSources() : Promise.resolve(undefined),
  ]);
  if (webService) data.webService = webService;
  if (logs) data.logs = logs;

  return data;
};
