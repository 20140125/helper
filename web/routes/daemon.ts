import { Router } from 'express';
import { runDaemonScript } from './utils';

const router = Router();

/**
 * 启动守护进程
 * @route POST /daemon/start
 * @returns {{ code: number, data: { stdout: string, stderr: string }, message: string }}
 */
router.post('/start', (_req, res) => {
  runDaemonScript('start', res);
});

/**
 * 停止守护进程
 * @route POST /daemon/stop
 * @returns {{ code: number, data: { stdout: string, stderr: string }, message: string }}
 */
router.post('/stop', (_req, res) => {
  runDaemonScript('stop', res);
});

/**
 * 重启守护进程
 * @route POST /daemon/restart
 * @returns {{ code: number, data: { stdout: string, stderr: string }, message: string }}
 */
router.post('/restart', (_req, res) => {
  runDaemonScript('restart', res);
});

export default router;
