import fs from 'fs';
import { exec, spawn } from 'child_process';
import { Response } from 'express';
import {
  WEB_DIR,
  WEB_SCRIPT,
  WEB_PORT,
  PID_FILE,
  LAUNCHER_PID_FILE,
  LEGACY_PID_FILE,
  LEGACY_LAUNCHER_PID_FILE,
  WEB_LOG_FILE,
  ACTION_TIMEOUT,
  STOP_ACTION_DELAY,
  WebServiceStatus,
} from '@/types/web-service';
import { PROJECT_DIR } from '@/utils/paths';
import { ensureRuntimeDir, readPidFile } from './runtime';
import { returnResponse, ErrorCode } from './response';

/**
 * 判断 Web 启动脚本是否存在
 * @returns {boolean} scripts/start_web.sh 存在返回 true
 */
export const webScriptExists = (): boolean => fs.existsSync(WEB_SCRIPT);

/**
 * 执行 Web 服务脚本
 * @param action - 操作类型：start | stop | restart
 * @param res - Express 响应对象
 */
export const runWebScript = (action: string, res: Response): void => {
  if (!webScriptExists()) {
    returnResponse(res, ErrorCode.NOT_FOUND, {}, '启动脚本不存在: start_web.sh');
    return;
  }
  const timeout = ACTION_TIMEOUT[action] ?? 30000;
  exec(`bash "${WEB_SCRIPT}" ${action}`, { cwd: WEB_DIR, timeout }, (err, stdout, stderr) => {
    if (err) {
      return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, stderr || err.message);
    }
    return returnResponse(res, ErrorCode.SUCCESS, { stdout, stderr }, 'success');
  });
};

/**
 * 读取 launcher.pid 文件中的 PID
 * @returns Launcher 进程 PID，读取失败返回 null
 */
export const readLauncherPid = (): number | null =>
  readPidFile(LAUNCHER_PID_FILE, LEGACY_LAUNCHER_PID_FILE);

/**
 * 通过端口反查当前监听 9527 的进程 PID
 * @param callback - PID 回调，未监听时返回 null
 * @description PID 文件可能缺失或过期（例如手工 nohup 启动服务），端口监听才是服务是否可用的最终依据
 */
const readWebPortPid = (callback: (pid: number | null) => void): void => {
  exec(`lsof -nP -t -iTCP:${WEB_PORT} -sTCP:LISTEN`, (err, stdout) => {
    if (err) {
      callback(null);
      return;
    }
    const pid = parseInt(stdout.trim().split('\n')[0], 10);
    callback(Number.isFinite(pid) && pid > 0 ? pid : null);
  });
};

/**
 * 读取 Web 服务当前运行状态
 * @description 优先读 PID 文件并通过 kill -0 检查；PID 缺失或进程已失效时，回退检查 9527 端口是否有进程监听
 * @param callback - 状态结果回调（避免调用方 await）
 */
export const readWebServiceStatus = (callback: (status: WebServiceStatus) => void): void => {
  const launcherPid = readLauncherPid();
  const webPid = readPidFile(PID_FILE, LEGACY_PID_FILE);

  if (webPid === null) {
    readWebPortPid((portPid) => {
      callback({ running: portPid !== null, pid: portPid, launcherPid });
    });
    return;
  }

  // kill -0 不发送信号，只检查进程是否存在
  exec(`kill -0 ${webPid}`, (err) => {
    if (!err) {
      callback({ running: true, pid: webPid, launcherPid });
      return;
    }
    // PID 文件存在但进程已退出，仍可能有其他方式拉起的服务在监听端口
    readWebPortPid((portPid) => {
      callback({ running: portPid !== null, pid: portPid, launcherPid });
    });
  });
};

/**
 * 以 Node 方式后台拉起 Web 服务
 * @returns {number} 子进程 PID
 * @description 用于 scripts/start_web.sh 缺失时的兜底：detached 方式 spawn `npx ts-node server.ts`，
 *   输出追加到 web/.runtime/web_server.log，PID 写入 web/.runtime/web.pid
 */
const spawnWebService = (): number => {
  const logFd = fs.openSync(WEB_LOG_FILE, 'a');
  const child = spawn('npx', ['ts-node', 'server.ts'], {
    cwd: WEB_DIR,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, PROJECT_DIR },
  });
  child.on('error', (err) => {
    console.error('[web-service] spawn failed:', err.message);
  });
  child.unref();
  if (!child.pid) {
    throw new Error('未能获取子进程 PID，服务可能未拉起');
  }
  fs.writeFileSync(PID_FILE, String(child.pid), 'utf-8');
  return child.pid;
};

/**
 * 等待 Web 端口进入监听状态
 * @param {number} timeoutMs - 最长等待毫秒数
 * @param {(running: boolean) => void} callback - 回调：端口是否已在监听
 */
const waitForPortListening = (timeoutMs: number, callback: (running: boolean) => void): void => {
  const startedAt = Date.now();
  const check = (): void => {
    exec(`lsof -nP -t -iTCP:${WEB_PORT} -sTCP:LISTEN`, (err, stdout) => {
      if (!err && stdout.trim()) {
        callback(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        callback(false);
        return;
      }
      setTimeout(check, 1000);
    });
  };
  check();
};

/**
 * 以 Node 方式启动 Web 服务（start_web.sh 缺失时的兜底）
 * @param res - Express 响应对象
 */
export const startWebServiceByNode = (res: Response): void => {
  ensureRuntimeDir();
  let pid: number;
  try {
    pid = spawnWebService();
  } catch (err) {
    returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `Web 服务启动失败：${(err as Error).message}`);
    return;
  }
  waitForPortListening(ACTION_TIMEOUT.start ?? 30000, (running) => {
    if (!running) {
      returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, `Web 服务启动超时，查看日志：${WEB_LOG_FILE}`);
      return;
    }
    returnResponse(res, ErrorCode.SUCCESS, { pid }, '启动成功');
  });
};

/**
 * 启动 Web 服务：优先使用 start_web.sh，缺失时以 Node 方式拉起
 * @param res - Express 响应对象
 */
export const startWebService = (res: Response): void => {
  if (webScriptExists()) {
    runWebScript('start', res);
    return;
  }
  startWebServiceByNode(res);
};

/**
 * 杀掉 Web 服务进程（PID 文件 + 端口兜底）
 * @param {() => void} callback - 清理完成回调
 */
export const stopWebServiceProcesses = (callback: () => void): void => {
  const pid = readPidFile(PID_FILE, LEGACY_PID_FILE);
  if (pid) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // 进程已退出，忽略
    }
  }
  // 兜底：强杀仍占用端口的残留进程（npx 退出后 ts-node 子进程常被 init 收养，不响应 SIGTERM）
  exec(`lsof -ti:${WEB_PORT}`, (_err, stdout) => {
    stdout
      .split('\n')
      .map((line) => parseInt(line.trim(), 10))
      .filter((portPid) => Number.isInteger(portPid) && portPid > 0)
      .forEach((portPid) => {
        try {
          process.kill(portPid, 'SIGKILL');
        } catch {
          // 进程已退出，忽略
        }
      });
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      // 文件不存在，忽略
    }
    callback();
  });
};

/**
 * 停止 Web 服务：优先使用 start_web.sh，缺失时直接杀进程
 * @param res - Express 响应对象
 * @description 无脚本路径下先响应再停止——停止会杀掉当前进程（9527 自身），否则响应发不出去
 */
export const stopWebService = (res: Response): void => {
  if (webScriptExists()) {
    runWebScript('stop', res);
    return;
  }
  returnResponse(res, ErrorCode.SUCCESS, {}, '停止指令已发送，服务即将停止');
  setTimeout(() => {
    stopWebServiceProcesses(() => {
      console.log('[web-service] stopped (node fallback)');
    });
  }, STOP_ACTION_DELAY);
};

/**
 * 以 Node 方式重启 Web 服务（start_web.sh 缺失时的兜底）
 * @description 供 launcher（3001）异步调用：先杀旧进程，再重新拉起
 */
export const restartWebServiceByNode = (): void => {
  ensureRuntimeDir();
  stopWebServiceProcesses(() => {
    try {
      spawnWebService();
      console.log('[web-service] restarted (node fallback)');
    } catch (err) {
      console.error('[web-service] restart failed:', (err as Error).message);
    }
  });
};
