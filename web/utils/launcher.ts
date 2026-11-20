import { exec } from 'child_process';
import type { Response } from 'express';
import type { LauncherStatus } from '@/types/launcher';
import {
  WEB_DIR,
  WEB_SCRIPT,
  WEB_PORT,
  LAUNCHER_RESTART_TIMEOUT,
  LAUNCHER_RESTART_DELAY,
} from '@/types/web-service';
import { startWebService, restartWebServiceByNode, webScriptExists } from './web-service';

export type { LauncherStatus } from '@/types/launcher';
export { webScriptExists };

/**
 * 通过 lsof 检查 Web 端口是否有进程监听
 * @param callback - 状态结果回调
 */
export const readLauncherStatus = (callback: (status: LauncherStatus) => void): void => {
  exec(`lsof -ti:${WEB_PORT}`, (err, stdout) => {
    const pidStr = stdout.trim().split('\n')[0];
    const pidNum = parseInt(pidStr, 10);
    const running = !err && !isNaN(pidNum) && pidNum > 0;
    callback({ running, pid: running ? pidNum : null });
  });
};

/**
 * 启动 Web 服务（同步响应）
 * @param res - Express 响应对象
 * @description 有 start_web.sh 时走脚本，缺失时以 Node 方式拉起 server.ts
 */
export const startWebServiceByLauncher = (res: Response): void => {
  startWebService(res);
};

/**
 * 异步触发 Web 服务重启
 * @description 调用方需先响应客户端，避免重启杀掉当前进程导致响应断开
 * @param {number} [delayMs] - 延迟执行毫秒数，默认 LAUNCHER_RESTART_DELAY
 *                             AI 助手触发时会传更大的值，好让本轮回答先落盘
 */
export const scheduleWebServiceRestart = (delayMs: number = LAUNCHER_RESTART_DELAY): void => {
  setTimeout(() => {
    if (webScriptExists()) {
      exec(`bash "${WEB_SCRIPT}" restart`, { cwd: WEB_DIR, timeout: LAUNCHER_RESTART_TIMEOUT }, (err, _stdout, stderr) => {
        if (err) {
          console.error('[launcher] restart failed:', stderr || err.message);
        } else {
          console.log('[launcher] restart success');
        }
      });
      return;
    }
    restartWebServiceByNode();
  }, delayMs);
};
