import { Router } from 'express';
import { returnResponse, ErrorCode, getSystemStatus } from './utils';

const router = Router();

/**
 * GET /system
 * @description 获取系统状态信息，包括守护进程运行状态、缓存文件数量、服务器时间及服务器基础信息
 * @returns {object} 系统状态对象
 */
router.get('/', async (_req, res) => {
  const status = await getSystemStatus();
  return returnResponse(res, ErrorCode.SUCCESS, { ...status }, 'success');
});

export default router;
