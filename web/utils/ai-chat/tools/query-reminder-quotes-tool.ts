import { readReminderQuotesFromDb } from '@/utils/database/content-library';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * query_reminder_quotes 工具实现
 * @description 查询系统的提醒寄语库（包含三餐贴士、营养建议、周末问候、寄语等），可按场景关键词过滤。
 *   直接读数据库；库不可用时返回明确错误，不再读 .cache 文件。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "看一下早餐相关的提醒寄语"                       → { bucket_keyword: 'breakfast' }
 *   - "周末问候语都有哪些？"                           → { bucket_keyword: 'weekend' }
 *   - "把所有寄语列 50 条出来"                          → { limit: 50 }
 */
export const queryReminderQuotesTool: ToolImpl = {
  name: 'query_reminder_quotes',
  description: '查询提醒寄语库（三餐贴士、营养建议、周末问候等），可按场景关键词过滤',
  parameters: {
    type: 'object',
    properties: {
      bucket_keyword: {
        type: 'string',
        description: 'bucket 关键词，如 breakfast、weekend；不传返回全部',
      },
      limit: {
        type: 'number',
        description: '返回条数，默认 20，最大 100',
      },
    },
  },
  requiredPermissions: ['reminder-quotes:view'],
  invoke: async (args): Promise<ToolResult> => {
    try {
      const kw = typeof args.bucket_keyword === 'string' ? args.bucket_keyword.toLowerCase() : '';
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);

      const items = await readReminderQuotesFromDb();
      const filtered = kw
        ? items.filter((it) => it.bucket.toLowerCase().includes(kw))
        : items;
      const slice = filtered.slice(0, limit);
      return {
        ok: true,
        data: { items: slice, total: filtered.length, returned: slice.length },
        summary: `匹配 ${filtered.length} 条，返回 ${slice.length} 条`,
      };
    } catch (err) {
      return { ok: false, data: `查询提醒寄语失败：${(err as Error).message}` };
    }
  },
};
