import { Router } from 'express';
import {
  returnResponse,
  ErrorCode,
  readLauncherStatus,
  startWebServiceByLauncher,
  scheduleWebServiceRestart,
} from './utils';
import {
  LAUNCHER_RESTART_DELAY,
  LAUNCHER_RESTART_MAX_DELAY,
} from '@/types/web-service';

const router = Router();

/**
 * GET /api/launcher/status
 * 查询 Web 服务（9527）运行状态：直接检查端口是否有进程监听
 */
router.get('/status', (_req, res) => {
  readLauncherStatus(({ running, pid }) => {
    returnResponse(res, ErrorCode.SUCCESS, { running, pid }, 'success');
  });
});

/**
 * POST /api/launcher/start
 * 启动 Web 服务
 */
router.post('/start', (_req, res) => {
  startWebServiceByLauncher(res);
});

/**
 * POST /api/launcher/restart
 * 重启 Web 服务（通过 launcher 触发，避免通过 9527 自身重启导致请求断开）
 * 立即响应，异步执行重启，避免客户端等待超时
 *
 * 可选入参 delay_ms（body 或 query）：延迟多少毫秒后再真正重启。
 * AI 助手触发重启时传较大值（如 8000），好让本轮回答先说完并落盘，
 * 避免 9527 在自己还没写完响应时就被杀掉、导致该轮会话丢失。
 */
router.post('/restart', (req, res) => {
  const raw = Number(req.body?.delay_ms ?? req.query?.delay_ms ?? LAUNCHER_RESTART_DELAY);
  const delayMs = Number.isFinite(raw) && raw > 0
    ? Math.min(Math.trunc(raw), LAUNCHER_RESTART_MAX_DELAY)
    : LAUNCHER_RESTART_DELAY;

  // 立即响应，异步执行重启
  returnResponse(res, ErrorCode.SUCCESS, {}, '重启指令已发送');
  console.log(`[launcher] restart command sent, delay=${delayMs}ms`);

  scheduleWebServiceRestart(delayMs);
});

export default router;
