import os from 'os';
import path from 'path';
import { Router } from 'express';
import {
  PROJECT_DIR,
  CACHE_DIR,
  formatDate,
  returnResponse,
  ErrorCode,
  countCacheFiles,
  getOsRelease,
  getMemoryInfo,
  getDiskInfo,
  getSystemUptime,
  readDaemonPidInfo,
  readAnnualPid,
} from './utils';

const router = Router();

/**
 * GET /system
 * @description 获取系统状态信息，包括守护进程运行状态、缓存文件数量、服务器时间及服务器基础信息
 * @returns {object} 系统状态对象
 */
router.get('/', (_req, res) => {
  const daemonPidFile = path.join(PROJECT_DIR, 'scripts/reminder_daemon.pid');
  const annualPidFile = path.join(PROJECT_DIR, 'scripts/annual_scheduler.pid');

  const { pid: daemonPid, isRunning: isDaemonRunning, startTime: daemonStartTime } = readDaemonPidInfo(daemonPidFile);
  const annualPid = readAnnualPid(annualPidFile);

  return returnResponse(res, ErrorCode.SUCCESS, {
    projectDir: PROJECT_DIR,
    daemonRunning: isDaemonRunning,
    daemonPid,
    daemonStartTime,
    annualPid,
    cacheFiles: countCacheFiles(CACHE_DIR),
    serverTime: formatDate(),
    // 服务器基础信息
    hostname: os.hostname(),
    osRelease: getOsRelease(),
    kernelVersion: os.release(),
    cpuCores: os.cpus().length,
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    systemUptime: getSystemUptime(),
    nodeVersion: process.version,
  }, 'success');
});

export default router;
