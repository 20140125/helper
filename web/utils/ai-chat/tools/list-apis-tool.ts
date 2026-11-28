import { readApiItems } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * list_apis 工具实现
 * @description 列出"接口管理"中已配置的可用接口元数据（id、名称、方法、路径、描述等），便于了解系统支持哪些预设接口。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "系统里都接入了哪些接口？"                       → {}
 *   - "有没有跟天气相关的预设接口？"                    → { keyword: '天气' }
 */
export const listApisTool: ToolImpl = {
  name: 'list_apis',
  description: '列出"接口管理"中已配置的可用接口元数据（id、名称、方法、路径、描述）',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '按名称/描述/路径模糊匹配',
      },
    },
  },
  requiredPermissions: ['api-management:view'],
  invoke: async (args): Promise<ToolResult> => {
    const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';
    const items = await readApiItems();
    const list = items
      .filter((i) => i.enabled)
      .filter((i) => {
        if (!kw) return true;
        return (
          i.name.toLowerCase().includes(kw)
          || (i.description ?? '').toLowerCase().includes(kw)
          || i.path.toLowerCase().includes(kw)
        );
      })
      .map((i) => ({
        item_key: i.item_key,
        category_id: i.category_id,
        name: i.name,
        method: i.method,
        path: i.path,
        description: i.description ?? '',
      }));
    return {
      ok: true,
      data: { apis: list, total: list.length },
      summary: `共 ${list.length} 个可用接口`,
    };
  },
};
