import { Router } from 'express';
import {
  PROJECT_DIR,
  readEnvFile,
  writeEnvFile,
  formatEnvValue,
  readEnvConfigMap,
  upsertEnvConfig,
  returnResponse,
  ErrorCode,
} from './utils';
import { UpdateConfigBody, FORBIDDEN_KEYS, LEGACY_LLM_KEY_PREFIX } from '@/types/config';

const router = Router();

/**
 * 获取当前配置
 * @route GET /api/config
 * @returns 返回 .env 与 hp_env_config 合并后的配置项，并附加 PROJECT_DIR
 * @description 数据库表里的运行时配置（如默认验证码）优先覆盖 .env 同名键；
 *   LLM_* 旧键一律剔除，避免 API Key 明文出现在响应里
 */
router.get('/', async (_req, res) => {
  const env = readEnvFile();
  Object.keys(env).forEach((key) => {
    if (key.startsWith(LEGACY_LLM_KEY_PREFIX)) delete env[key];
  });

  let dbConfig: Record<string, string> = {};
  try {
    dbConfig = await readEnvConfigMap();
  } catch (err) {
    console.warn('[config] 读取 hp_env_config 失败，仅返回 .env：', (err as Error).message);
  }

  return returnResponse(res, ErrorCode.SUCCESS, { config: { ...env, ...dbConfig, PROJECT_DIR } }, 'success');
});

/**
 * 更新配置项
 * @route POST /api/config
 * @body {UpdateConfigBody} updates - 需要更新的键值对，禁止修改系统环境变量
 * @description 已在 hp_env_config 登记的配置项写库并立即生效，其余仍写 .env（需重启 Web）
 */
router.post('/', async (req, res) => {
  const { updates } = req.body as UpdateConfigBody;
  if (!updates || typeof updates !== 'object') {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '参数错误：需要 updates 对象');
  }
  const hasForbidden = Object.keys(updates).some((k) => FORBIDDEN_KEYS.includes(k));
  if (hasForbidden) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '不允许修改系统环境变量');
  }

  let dbKeys = new Set<string>();
  try {
    dbKeys = new Set(Object.keys(await readEnvConfigMap()));
  } catch (err) {
    console.warn('[config] 读取 hp_env_config 失败，本次全部写入 .env：', (err as Error).message);
  }

  const envUpdates: Record<string, string> = {};
  const dbUpdates: Record<string, string> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (key.startsWith(LEGACY_LLM_KEY_PREFIX)) return;
    const text = String(value ?? '');
    if (dbKeys.has(key)) {
      dbUpdates[key] = text;
    } else {
      // 值含空格或 | & $ 等字符时补引号，否则脚本 source .env 会被拆成命令
      envUpdates[key] = formatEnvValue(text);
    }
  });

  try {
    if (Object.keys(dbUpdates).length > 0) await upsertEnvConfig(dbUpdates);
    if (Object.keys(envUpdates).length > 0) writeEnvFile(envUpdates);
    const tip = Object.keys(dbUpdates).length > 0 && Object.keys(envUpdates).length > 0
      ? '配置已保存（数据库项立即生效，.env 项需重启 Web）'
      : '配置已保存';
    return returnResponse(res, ErrorCode.SUCCESS, {}, tip);
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
