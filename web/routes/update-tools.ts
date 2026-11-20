import { Router } from 'express';
import { returnResponse, ErrorCode } from './utils';
import {
  UPDATE_TOOLS_SCRIPTS,
  validateRequiredArgs,
  buildFinalArgs,
  execUpdateScript,
  resolveUpdateScriptPath,
  updateScriptExists,
} from './utils';

const router = Router();

/**
 * 获取 update-tools 脚本列表及参数说明
 * @route GET /update-tools
 * @returns {{ code: number, data: { scripts: Array<{ key: string, label: string, filename: string, params: object[] }> }, message: string }}
 */
router.get('/', (_req, res) => {
  const list = Object.entries(UPDATE_TOOLS_SCRIPTS).map(([key, info]) => ({
    key,
    label: info.label,
    filename: info.filename,
    params: info.params,
  }));
  return returnResponse(res, ErrorCode.SUCCESS, { scripts: list }, 'success');
});

/**
 * 触发指定的 update-tools 脚本
 * @route POST /update-tools/:script
 * @param {string} req.params.script - 脚本标识符，必须在 UPDATE_TOOLS_SCRIPTS 中定义
 * @param {unknown[]} req.body.args - 脚本参数列表，顺序与 params 定义一致
 * @returns {{ code: number, data: { stdout: string, stderr: string }, message: string }}
 */
router.post('/:script', async (req, res) => {
  const { script } = req.params;
  const toolInfo = UPDATE_TOOLS_SCRIPTS[script];
  if (!toolInfo) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '不允许触发该脚本');
  }

  const { args = [] } = req.body as { args?: unknown[] };
  if (!Array.isArray(args)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '参数格式错误：args 必须是数组');
  }

  const strArgs = args.map(String);

  const missingParam = validateRequiredArgs(toolInfo.params, strArgs);
  if (missingParam) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `缺少必填参数：${missingParam}`);
  }

  const finalArgs = buildFinalArgs(toolInfo, strArgs);
  const scriptPath = resolveUpdateScriptPath(toolInfo);
  if (!updateScriptExists(scriptPath)) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, `脚本不存在: ${toolInfo.filename}`);
  }
  try {
    const result = await execUpdateScript(scriptPath, finalArgs);
    return returnResponse(res, ErrorCode.SUCCESS, { stdout: result.stdout, stderr: result.stderr }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
