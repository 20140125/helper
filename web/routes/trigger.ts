import { Router } from 'express';
import { SCRIPT_METAS, SCRIPT_META_MAP } from '@/types/trigger';
import { runScript, returnResponse, ErrorCode } from './utils';

const router = Router();

/**
 * 获取当前用户可见的脚本列表（按 view 权限过滤）
 * @route GET /trigger
 * @returns {{ ok: boolean, scripts: ScriptItem[] }}
 * @description 根据用户权限返回可见脚本，前端不再硬编码脚本列表
 */
router.get('/', (req, res) => {
  const permissions = req.userPermissions ?? [];
  
  const scripts = SCRIPT_METAS
    .filter((m) => permissions.includes(m.viewPermission))
    .map((m) => ({
      key: m.key,
      icon: m.icon,
      category: m.category,
      canEdit: permissions.includes(m.editPermission),
      scriptName: m.scriptName,
    }));

  return returnResponse(res, ErrorCode.SUCCESS, { scripts }, 'success');
});

/**
 * 触发单条自定义规则
 * @route POST /trigger/custom_rules/:ruleId
 * @param ruleId - 规则 ID
 * @returns 脚本执行的 stdout / stderr
 * @description 必须注册在 /:script 路由之前，避免被通用路由拦截
 */
router.post('/custom_rules/:ruleId', async (req, res) => {
  const meta = SCRIPT_META_MAP.get('custom_rules');
  if (!meta) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '脚本不存在');
  }

  // 检查 custom_rules 执行权限
  const permissions = req.userPermissions ?? [];
  if (!permissions.includes(meta.editPermission)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, { requiredPermission: meta.editPermission }, '权限不足，无法执行此操作');
  }

  const { ruleId } = req.params;
  if (!ruleId) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少 ruleId 参数');
  }
  try {
    const result = await runScript(meta.scriptPath, ['test', ruleId]);
    return returnResponse(res, ErrorCode.SUCCESS, { stdout: result.stdout, stderr: result.stderr }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

/**
 * 触发指定脚本
 * @route POST /trigger/:script
 * @param script - 脚本标识符，必须在 SCRIPT_META_MAP 中注册
 * @returns 脚本执行的 stdout / stderr
 * @description 仅允许触发已注册的脚本，防止任意命令执行
 */
router.post('/:script', async (req, res) => {
  const { script } = req.params;
  const meta = SCRIPT_META_MAP.get(script);
  if (!meta) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '不允许触发该脚本');
  }

  // 细粒度权限检查
  const permissions = req.userPermissions ?? [];
  if (!permissions.includes(meta.editPermission)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, { requiredPermission: meta.editPermission }, '权限不足，无法执行此操作');
  }

  try {
    const result = await runScript(meta.scriptPath, meta.args);
    return returnResponse(res, ErrorCode.SUCCESS, { stdout: result.stdout, stderr: result.stderr }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
