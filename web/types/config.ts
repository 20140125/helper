/** 更新配置请求体 */
export interface UpdateConfigBody {
  updates?: Record<string, string>;
}

/** 禁止修改的系统环境变量 key 列表 */
export const FORBIDDEN_KEYS = ['PATH', 'HOME', 'USER', 'SHELL'];

/**
 * 旧版 .env 模型配置键的前缀
 * @description 模型配置已全部迁到 .cache/ai-model-configs.json；这里只保留前缀规则，
 *   用于挡住被手工写回 .env 的 LLM_* 键（尤其是 LLM_API_KEY 明文），不再维护具体键名清单
 */
export const LEGACY_LLM_KEY_PREFIX = 'LLM_';
