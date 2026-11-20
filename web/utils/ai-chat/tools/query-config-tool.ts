import { readEnvFile } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 敏感配置键名特征
 * @description 命中这些特征的键，值一律脱敏，绝不明文返回给 LLM / 会话。
 *              注意用 (^|_)(KEY|TOKEN)(_|$) 这类边界写法，避免误伤 LLM_MAX_TOKENS 等非敏感项。
 */
const SENSITIVE_KEY_PATTERN = new RegExp(
  [
    'SECRET',
    'PASSWORD',
    'PASSWD',
    'PASS(_|$)',
    'CREDENTIAL',
    'COOKIE',
    'DSN',
    'WEBHOOK',
    'AUTH',
    'SIGN',
    '(^|_)(KEY|TOKEN)(_|$)',
  ].join('|'),
  'i',
);

/** 脱敏占位符 */
const MASKED = '***（已脱敏）';

/**
 * query_config 工具实现
 * @description 查询「系统配置」（web/.env，缺失时回退 scripts/.env）的键与值；命中敏感特征的键（密钥/Token/Webhook 地址等）一律脱敏。
 *              只读，不修改任何配置。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "当前系统配置是什么？"                           → {}
 *   - "现在用的是哪个大模型"                            → { keyword: 'LLM' }
 */
export const queryConfigTool: ToolImpl = {
  name: 'query_config',
  description:
    '查询「系统配置」（.env）的键与值。含 KEY / SECRET / TOKEN / PASSWORD / WEBHOOK 等敏感特征的键只返回脱敏值，'
    + '不泄露真实密钥。只读，不能修改配置。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '按键名模糊过滤，如 LLM / EMAIL / CITY',
      },
    },
  },
  requiredPermissions: ['config:view'],
  invoke: async (args): Promise<ToolResult> => {
    const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';
    const env = readEnvFile();

    const entries = Object.entries(env)
      .filter(([key]) => (kw ? key.toLowerCase().includes(kw) : true))
      .map(([key, value]) => ({
        key,
        value: SENSITIVE_KEY_PATTERN.test(key) ? MASKED : value,
        masked: SENSITIVE_KEY_PATTERN.test(key),
      }));

    if (entries.length === 0) {
      return { ok: true, data: { configs: [], total: 0 }, summary: '没有匹配的配置项' };
    }

    return {
      ok: true,
      data: { configs: entries, total: entries.length },
      summary: `共 ${entries.length} 项配置，其中 ${entries.filter((e) => e.masked).length} 项已脱敏`,
    };
  },
};
