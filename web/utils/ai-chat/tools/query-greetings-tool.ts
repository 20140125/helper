import { GREETINGS_GROUPS } from '@/routes/utils';
import { readGreetingsFromDb } from '@/utils/database/content-library';
import type { GreetingsGroup } from '@/types/greetings';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 单条祝福语默认返回条数 */
const DEFAULT_ITEMS = 20;
/** 单条祝福语返回上限，防止上下文爆炸 */
const MAX_ITEMS = 50;

/**
 * query_greetings 工具实现
 * @description 查询「节日祝福语」库（节气 / 节日 / 农历节日 / 特殊日子 / 生日模板），
 *   直接读数据库；库不可用时返回明确错误，不再读 .cache 文件。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "祝福语库里都配了哪些节日？"                      → {}
 *   - "立春的祝福语是什么"                              → { keyword: '立春' }
 *   - "看看生日模板"                                    → { group: 'birthday' }
 */
export const queryGreetingsTool: ToolImpl = {
  name: 'query_greetings',
  description:
    '查询「节日祝福语」库内容。group 可选：solar_terms=节气、holidays=节日、'
    + 'lunar_festivals=农历节日、special_days=特殊日子、birthday=生日模板；keyword 按名称/内容模糊匹配。',
  parameters: {
    type: 'object',
    properties: {
      group: {
        type: 'string',
        enum: [...GREETINGS_GROUPS],
        description: '按分组过滤；不传则查全部',
      },
      keyword: {
        type: 'string',
        description: '按名称或祝福语内容模糊匹配，如 "立春"',
      },
      limit: {
        type: 'number',
        description: '返回条数，默认 20，最大 50',
      },
    },
  },
  requiredPermissions: ['greetings:view'],
  invoke: async (args): Promise<ToolResult> => {
    try {
      const group = typeof args.group === 'string' ? args.group.trim() : '';
      if (group && !GREETINGS_GROUPS.includes(group as GreetingsGroup)) {
        return { ok: false, data: `不支持 group="${group}"，可用：${GREETINGS_GROUPS.join('、')}` };
      }
      const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';

      const allItems = await readGreetingsFromDb();

      const list = allItems
        .filter((i) => (group ? i.group === group : true))
        .filter((i) => {
          if (!kw) return true;
          return i.name.toLowerCase().includes(kw) || i.content.toLowerCase().includes(kw);
        });

      const limit = Math.min(Math.max(Number(args.limit) || DEFAULT_ITEMS, 1), MAX_ITEMS);
      const shown = list.slice(0, limit);
      return {
        ok: true,
        data: {
          items: shown.map((i) => ({ id: i.id, group: i.group, name: i.name, content: i.content })),
          total: list.length,
          truncated: list.length > limit,
        },
        summary: `命中 ${list.length} 条祝福语${list.length > limit ? `（仅返回前 ${limit} 条）` : ''}`,
      };
    } catch (err) {
      return { ok: false, data: `查询祝福语失败：${(err as Error).message}` };
    }
  },
};
