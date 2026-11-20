import { readWebhooks } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 对 Webhook URL 做脱敏：只保留协议 + 域名 + 路径，丢弃查询串（含 key 等敏感参数）
 * @param {string} url - 原始 URL
 * @returns {string} 脱敏后的 URL
 */
const maskUrl = (url: string): string => {
  const qIndex = url.indexOf('?');
  return qIndex === -1 ? url : `${url.slice(0, qIndex)}?***`;
};

/**
 * query_webhooks 工具实现
 * @description 查询已配置的企业微信 Webhook 列表（名称、消息风格、创建时间）。
 *              URL 一律脱敏，只展示到路径，不泄露 key。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "现在配了哪些 webhook？"                         → {}
 *   - "有几个推送群"                                    → {}
 */
export const queryWebhooksTool: ToolImpl = {
  name: 'query_webhooks',
  description:
    '查询已配置的企业微信 Webhook 列表（名称、消息风格、创建时间）。出于安全考虑 URL 只展示到路径，'
    + '不含 key 等敏感参数。实际推送消息用 send_wecom_message（需用户明确要求推送）。',
  parameters: {
    type: 'object',
    properties: {},
  },
  requiredPermissions: ['webhook:view'],
  invoke: async (): Promise<ToolResult> => {
    const list = readWebhooks().map((w) => ({
      id: w.id,
      name: w.name,
      style: w.style,
      url: maskUrl(w.url),
      created_at: w.created_at,
    }));
    return {
      ok: true,
      data: { webhooks: list, total: list.length },
      summary: `共 ${list.length} 个 Webhook`,
    };
  },
};
