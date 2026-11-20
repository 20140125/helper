import { readApiCategories, readApiItems } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * query_api_categories 工具实现
 * @description 查询「接口分类」列表，并统计每个分类下已启用的接口条目数。
 *              接口条目明细用 list_apis。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "接口都分了哪些类？"                             → {}
 *   - "天气类的接口有几个"                              → { keyword: '天气' }
 */
export const queryApiCategoriesTool: ToolImpl = {
  name: 'query_api_categories',
  description:
    '查询「接口管理」的接口分类列表（category_key、名称、描述）及各分类下已启用的接口数量。'
    + '查具体接口条目用 list_apis。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '按分类名或描述模糊匹配',
      },
    },
  },
  requiredPermissions: ['api-category:view'],
  invoke: async (args): Promise<ToolResult> => {
    const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';
    const categories = readApiCategories();
    const items = readApiItems();

    const list = categories
      .filter((c) => {
        if (!kw) return true;
        return c.name.toLowerCase().includes(kw) || (c.description ?? '').toLowerCase().includes(kw);
      })
      .map((c) => ({
        category_key: c.category_key,
        name: c.name,
        description: c.description ?? '',
        enabled_items: items.filter((i) => i.category_id === c.category_key && i.enabled).length,
      }));

    return {
      ok: true,
      data: { categories: list, total: list.length },
      summary: `共 ${list.length} 个接口分类`,
    };
  },
};
