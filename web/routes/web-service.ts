import { Router } from 'express';
import {
  startWebService,
  stopWebService,
  returnResponse,
  ErrorCode,
  readWebServiceStatus,
  scheduleWebServiceRestart,
} from './utils';

const router = Router();

/** POST /web-service/start - 启动 Web 服务（无 start_web.sh 时以 Node 方式拉起） */
router.post('/start', (_req, res) => {
  startWebService(res);
});

/** POST /web-service/stop - 停止 Web 服务（无 start_web.sh 时直接结束进程） */
router.post('/stop', (_req, res) => {
  stopWebService(res);
});

/**
 * POST /web-service/restart - 重启 Web 服务
 * 由于 restart 会杀掉当前进程（自身），无法等待执行结果，
 * 因此先立即响应客户端，再延迟在后台异步执行重启
 */
router.post('/restart', (_req, res) => {
  // 立即响应，告知前端已接受重启请求
  returnResponse(res, ErrorCode.SUCCESS, {}, '重启请求已接受，服务即将重启');
  scheduleWebServiceRestart();
});

/** GET /web-service/status - 查询 Web 服务运行状态及 PID */
router.get('/status', (_req, res) => {
  readWebServiceStatus((status) => {
    returnResponse(res, ErrorCode.SUCCESS, { ...status }, 'success');
  });
});

export default router;
