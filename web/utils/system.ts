import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

/**
 * 获取操作系统发行版名称
 * @description 优先读取 /etc/os-release 中的 PRETTY_NAME，失败时回退到 os.type()
 * @returns {string} 操作系统发行版名称，失败时返回空字符串
 */
export const getOsRelease = (): string => {
  try {
    const content = fs.readFileSync('/etc/os-release', 'utf-8');
    const prettyName = content.match(/^PRETTY_NAME="(.+)"$/m);
    if (prettyName) return prettyName[1];
    const name = content.match(/^NAME="(.+)"$/m);
    const version = content.match(/^VERSION="(.+)"$/m);
    if (name) return version ? `${name[1]} ${version[1]}` : name[1];
  } catch {
    // 非 Linux 系统或无权限
  }
  return os.type();
};

/**
 * 获取服务器内存使用信息
 * @returns {{ total: number; used: number; free: number }} 内存总量、已用量、可用量（单位：字节）
 */
export const getMemoryInfo = (): { total: number; used: number; free: number } => {
  const total = os.totalmem();
  const free = os.freemem();
  return { total, used: total - free, free };
};

/**
 * 获取根分区磁盘使用信息
 * @description 通过 df 命令读取根分区（/）的磁盘占用情况
 * @returns {{ total: number; used: number; free: number } | null} 磁盘总量、已用量、可用量（单位：字节），获取失败时返回 null
 */
export const getDiskInfo = (): { total: number; used: number; free: number } | null => {
  try {
    const output = execSync('df -k / --output=size,used,avail 2>/dev/null | tail -1').toString().trim();
    const parts = output.split(/\s+/);
    if (parts.length >= 3) {
      const total = parseInt(parts[0], 10) * 1024;
      const used = parseInt(parts[1], 10) * 1024;
      const free = parseInt(parts[2], 10) * 1024;
      return { total, used, free };
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * 获取系统运行时长
 * @returns {number} 系统自启动以来的运行时长（单位：秒）
 */
export const getSystemUptime = (): number => Math.floor(os.uptime());

/**
 * 判断 PID 对应的进程是否存活（跨平台）
 * @description Linux/macOS 统一用 kill(pid, 0) 探测；EPERM 表示进程存在但无权限，也视为存活
 * @param {number} pid 目标进程的 PID
 * @returns {boolean} 进程存活返回 true，否则 false
 */
const isProcessAlive = (pid: number): boolean => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * 通过 PID 读取进程启动时间戳
 * @description Linux 读取 /proc/<pid>/stat 第22字段；macOS 等平台回退到 ps -o lstart=
 * @param {number} pid 目标进程的 PID
 * @returns {number | null} 进程启动时间戳（毫秒），读取失败时返回 null
 */
export const getProcessStartTime = (pid: number): number | null => {
  if (process.platform !== 'linux') {
    try {
      const started = execSync(`LC_ALL=C ps -o lstart= -p ${pid}`).toString().trim();
      if (started) {
        const ts = new Date(started).getTime();
        if (!Number.isNaN(ts)) return ts;
      }
    } catch {
      // 进程已退出或 ps 不支持该参数
    }
    return null;
  }
  try {
    // /proc/<pid>/stat 第22字段为进程启动时间（单位：clock ticks，相对系统启动）
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf-8');
    const fields = stat.split(' ');
    const startTicks = parseInt(fields[21], 10);
    if (isNaN(startTicks)) return null;

    // 读取系统启动时间（秒）
    const uptimeStr = fs.readFileSync('/proc/uptime', 'utf-8');
    const systemUptimeSec = parseFloat(uptimeStr.split(' ')[0]);

    // 读取 clock ticks per second
    const clkTck = parseInt(execSync('getconf CLK_TCK').toString().trim(), 10);

    // 进程启动时间 = 当前时间 - (系统运行时长 - 进程启动ticks/clkTck)
    const processUptimeSec = systemUptimeSec - startTicks / clkTck;
    return Date.now() - Math.floor(processUptimeSec * 1000);
  } catch {
    return null;
  }
};

/**
 * 通过 ps 命令查找守护进程 PID（fallback 机制）
 * @description 当 PID 文件丢失时，通过 ps 匹配进程名称来发现仍在运行的守护进程
 * @param {string} scriptName - 脚本名称（如 reminder_daemon.sh）
 * @returns {number | null} 匹配到的唯一进程 PID，未找到或匹配多个时返回 null
 */
const findDaemonPidByPs = (scriptName: string): number | null => {
  try {
    const output = execSync(
      `ps -eo pid,args | grep "bash.*${scriptName}" | grep -v grep | awk '{print $1}'`,
      { timeout: 3000 },
    ).toString().trim();
    if (!output) return null;
    const pids = output.split('\n').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    // 仅当恰好找到一个进程时才返回，避免多实例场景下的歧义
    return pids.length === 1 ? pids[0] : null;
  } catch {
    return null;
  }
};

/**
 * 读取守护进程 PID 文件，返回运行状态信息
 * @description 优先读取 PID 文件；若文件不存在则通过 ps 命令查找进程（自动恢复 PID 文件）；
 *              若 PID 文件存在但进程已退出，则自动清理残留文件
 * @param {string} pidFile - PID 文件路径
 * @returns {{ pid: number | null; isRunning: boolean; startTime: number | null }} 守护进程状态
 */
export const readDaemonPidInfo = (pidFile: string): { pid: number | null; isRunning: boolean; startTime: number | null } => {
  // 1. 优先从 PID 文件读取
  if (fs.existsSync(pidFile)) {
    try {
      const parsed = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      if (!isNaN(parsed) && isProcessAlive(parsed)) {
        return { pid: parsed, isRunning: true, startTime: getProcessStartTime(parsed) };
      }
      // PID 文件残留但进程已不存在，清理文件
      try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    } catch {
      // ignore
    }
  }

  // 2. PID 文件不存在或已被清理，通过 ps 命令查找进程（fallback）
  const scriptName = pidFile.includes('reminder_daemon') ? 'reminder_daemon.sh' : null;
  if (scriptName) {
    const foundPid = findDaemonPidByPs(scriptName);
    if (foundPid && isProcessAlive(foundPid)) {
      // 自动恢复 PID 文件，后续请求无需再走 ps fallback
      try { fs.writeFileSync(pidFile, String(foundPid), 'utf-8'); } catch { /* ignore */ }
      return { pid: foundPid, isRunning: true, startTime: getProcessStartTime(foundPid) };
    }
  }

  return { pid: null, isRunning: false, startTime: null };
};

/**
 * 读取指定 PID 文件，返回进程 PID（进程不存在时返回 null）
 * @param {string} pidFile - PID 文件路径
 * @returns {number | null} 进程 PID，读取失败或进程不存在时返回 null
 */
export const readAnnualPid = (pidFile: string): number | null => {
  if (!fs.existsSync(pidFile)) return null;
  try {
    const parsed = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    if (!isNaN(parsed) && isProcessAlive(parsed)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};
