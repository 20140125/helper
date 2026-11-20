import fs from 'fs';
import { exec } from 'child_process';
import { Response } from 'express';
import { PROJECT_DIR } from '@/routes/utils';
import { DAEMON_SCRIPT, ACTION_MESSAGE, ACTION_TIMEOUT } from '@/types/daemon';
import { returnResponse, ErrorCode } from './response';

/**
 * 执行守护进程脚本
 * @param action - 操作类型：start | stop | restart
 * @param res - Express 响应对象
 */
export const runDaemonScript = (action: string, res: Response): void => {
  if (!fs.existsSync(DAEMON_SCRIPT)) {
    returnResponse(res, ErrorCode.NOT_FOUND, {}, '脚本不存在: daemon.sh');
    return;
  }
  const timeout = ACTION_TIMEOUT[action] ?? 30000;
  exec(`bash "${DAEMON_SCRIPT}" ${action}`, { cwd: PROJECT_DIR, timeout }, (err, stdout, stderr) => {
    if (err) {
      return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, stderr || err.message);
    }
    return returnResponse(res, ErrorCode.SUCCESS, { stdout, stderr }, ACTION_MESSAGE[action]);
  });
};