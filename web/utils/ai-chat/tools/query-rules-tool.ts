import { readRules } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * query_rules 工具实现
 * @description 查询系统中已配置的所有自定义规则（每条规则定义在什么时间触发什么行为）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "我现在配置了哪些自定义规则？"                 → {}
 *   - "只看启用中的规则"                              → { enabled_only: true }
 */
export const queryRulesTool: ToolImpl = {
  name: 'query_rules',
  description: '查询系统已配置的自定义规则（每条规则定义触发时间和行为）',
  parameters: {
    type: 'object',
    properties: {
      enabled_only: {
        type: 'boolean',
        description: '只返回已启用的规则，默认 false',
      },
    },
  },
  requiredPermissions: ['rules:view'],
  invoke: async (args): Promise<ToolResult> => {
    const enabledOnly = Boolean(args.enabled_only);
    const all = await readRules();
    const list = enabledOnly ? all.filter((r) => r.enabled) : all;
    return {
      ok: true,
      data: { rules: list },
      summary: `共 ${list.length} 条规则${enabledOnly ? '（仅已启用）' : ''}`,
    };
  },
};
