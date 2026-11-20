import { Router } from 'express';
import { PROJECT_DIR, readEnvFile, writeEnvFile, formatEnvValue, returnResponse, ErrorCode } from './utils';
import { UpdateConfigBody, FORBIDDEN_KEYS, LEGACY_LLM_KEY_PREFIX } from '@/types/config';

const router = Router();

/**
 * 获取当前配置
 * @route GET /api/config
 * @returns 返回 .env 中的非模型配置项，并附加 PROJECT_DIR
 * @description LLM_* 模型配置已迁移到 .cache/ai-model-configs.json；万一旧键被手工写回 .env，
 *   这里按前缀剔除，避免 API Key 明文出现在配置接口响应里
 */
router.get('/', (_req, res) => {
  const env = readEnvFile();
  Object.keys(env).forEach((key) => {
    if (key.startsWith(LEGACY_LLM_KEY_PREFIX)) delete env[key];
  });
  return returnResponse(res, ErrorCode.SUCCESS, { config: { ...env, PROJECT_DIR } }, 'success');
});

/**
 * 更新配置项
 * @route POST /api/config
 * @body {UpdateConfigBody} updates - 需要更新的键值对，禁止修改系统环境变量
 * @description LLM_* 前缀的旧键一律忽略，模型配置统一由 /api/ai-model-configs 写入 JSON
 */
router.post('/', (req, res) => {
  const { updates } = req.body as UpdateConfigBody;
  if (!updates || typeof updates !== 'object') {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '参数错误：需要 updates 对象');
  }
  const hasForbidden = Object.keys(updates).some((k) => FORBIDDEN_KEYS.includes(k));
  if (hasForbidden) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '不允许修改系统环境变量');
  }
  try {
    // 值含空格或 | & $ 等字符时补引号，否则脚本 source .env 会被拆成命令
    const safeUpdates: Record<string, string> = {};
    Object.entries(updates).forEach(([k, v]) => {
      if (k.startsWith(LEGACY_LLM_KEY_PREFIX)) return;
      safeUpdates[k] = formatEnvValue(String(v ?? ''));
    });
    if (Object.keys(safeUpdates).length > 0) {
      writeEnvFile(safeUpdates);
    }
    return returnResponse(res, ErrorCode.SUCCESS, {}, '配置已保存');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
