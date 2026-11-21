import path from 'path';
import os from 'os';
import {
  PROJECT_DIR,
  CACHE_DIR,
  countCacheFiles,
  getOsRelease,
  getMemoryInfo,
  getDiskInfo,
  getSystemUptime,
  readDaemonPidInfo,
  readAnnualPid,
} from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 提醒守护进程 PID 文件 */
const DAEMON_PID_FILE = path.join(PROJECT_DIR, 'scripts/reminder_daemon.pid');
/** 年度调度进程 PID 文件 */
const ANNUAL_PID_FILE = path.join(PROJECT_DIR, 'scripts/annual_scheduler.pid');

/**
 * 字节数转为 GB 文本
 * @param {number} bytes - 字节数
 * @returns {string} 形如 "3.42 GB" 的文本
 */
const toGbText = (bytes: number): string => `${(bytes / 1024 ** 3).toFixed(2)} GB`;

/**
 * 秒数转为"x 小时 y 分钟"文本
 * @param {number} seconds - 秒数
 * @returns {string} 可读时长
 */
const toDurationText = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
};

/**
 * 时间戳转本地时间文本
 * @param {number | null} ts - 毫秒时间戳
 * @returns {string} 本地时间文本，空值时返回空串
 */
const toTimeText = (ts: number | null): string => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
};

/**
 * query_system_status 工具实现
 * @description 查询系统运行状态（对应「仪表盘/概览」页）：主机与操作系统、内存磁盘占用、
 *              运行时长、提醒守护进程与年度调度进程是否在跑、缓存文件数量。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "服务器现在状态怎么样？"                         → {}
 *   - "提醒守护进程还活着吗？"                          → {}
 */
export const querySystemStatusTool: ToolImpl = {
  name: 'query_system_status',
  description:
    '查询系统运行状态：主机名/操作系统/CPU 核数、内存与磁盘占用、系统运行时长、'
    + '提醒守护进程（reminder_daemon）与年度调度进程（annual_scheduler）是否在跑、缓存文件数量。'
    + '查 Web 服务（9527/3001 端口）进程状态用 query_service_status。',
  parameters: {
    type: 'object',
    properties: {},
  },
  requiredPermissions: ['dashboard:view', 'daemon:view'],
  invoke: async (): Promise<ToolResult> => {
    const memory = getMemoryInfo();
    const disk = getDiskInfo();
    const uptime = getSystemUptime();
    const daemon = readDaemonPidInfo(DAEMON_PID_FILE);
    const annualPid = readAnnualPid(ANNUAL_PID_FILE);

    const data = {
      host: os.hostname(),
      os: getOsRelease(),
      kernel: os.release(),
      cpu_cores: os.cpus().length,
      node_version: process.version,
      memory: {
        total: toGbText(memory.total),
        used: toGbText(memory.used),
        free: toGbText(memory.free),
        used_percent: `${Math.round((memory.used / memory.total) * 100)}%`,
      },
      disk: disk
        ? {
          total: toGbText(disk.total),
          used: toGbText(disk.used),
          free: toGbText(disk.free),
          used_percent: disk.total > 0 ? `${Math.round((disk.used / disk.total) * 100)}%` : '未知',
        }
        : null,
      system_uptime: toDurationText(uptime),
      daemons: {
        reminder_daemon: {
          running: daemon.isRunning,
          pid: daemon.pid,
          started_at: toTimeText(daemon.startTime),
        },
        annual_scheduler: {
          running: annualPid !== null,
          pid: annualPid,
        },
      },
      cache_files: countCacheFiles(CACHE_DIR),
    };

    return {
      ok: true,
      data,
      summary: `守护进程${daemon.isRunning ? '运行中' : '未运行'}，内存占用 ${data.memory.used_percent}，`
        + `磁盘占用 ${data.disk ? data.disk.used_percent : '未知'}`,
    };
  },
};
