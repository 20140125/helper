import { Router } from 'express';
import { ErrorCode, returnResponse, buildBootstrapData, parseBootstrapOnly } from './utils';

const router = Router();

/**
 * GET /bootstrap
 * @route GET /bootstrap
 * @description 一次性返回首页首屏所需的系统状态、Web 服务状态、规则与日志列表；
 *   only 参数可指定只返回部分数据块，供状态轮询轻量复用
 * @returns {object} 按当前用户权限裁剪后的聚合数据
 */
router.get('/', async (req, res) => {
  const only = parseBootstrapOnly(req.query.only);
  if (only === null) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'only 参数仅支持 system、webService、rules、logs');
  }
  try {
    const data = await buildBootstrapData(req.userPermissions ?? [], only);
    return returnResponse(res, ErrorCode.SUCCESS, { ...data }, 'success');
  } catch (err) {
    return returnResponse(
      res,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {},
      `首屏数据聚合失败：${(err as Error).message}`,
    );
  }
});

export default router;
