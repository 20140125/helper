import { SCRIPT_METAS } from '@/types/trigger';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';

/**
 * list_scripts 工具实现
 * @description 列出「脚本触发」页中当前用户可见/可执行的脚本清单（key、脚本名、分类、是否有执行权限）。
 *              只读清单，不执行任何脚本；真正执行用 trigger_script。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "系统里都能手动触发哪些脚本？"                    → {}
 *   - "有没有跟生日有关的脚本"                          → { keyword: 'birthday' }
 */
export const listScriptsTool: ToolImpl = {
  name: 'list_scripts',
  description:
    '列出「脚本触发」页中当前用户可见的脚本清单（key、脚本文件名、分类、是否可执行）。'
    + '只返回清单不执行；用户想执行某个任务时用 trigger_script。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '按 key / 脚本名 / 分类 模糊过滤',
      },
    },
  },
  requiredPermissions: ['trigger:view'],
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const kw = typeof args.keyword === 'string' ? args.keyword.toLowerCase().trim() : '';
    const permissions = ctx.userPermissions ?? [];

    const list = SCRIPT_METAS
      .filter((m) => permissions.includes(m.viewPermission))
      .filter((m) => {
        if (!kw) return true;
        return (
          m.key.toLowerCase().includes(kw)
          || m.scriptName.toLowerCase().includes(kw)
          || m.category.toLowerCase().includes(kw)
        );
      })
      .map((m) => ({
        key: m.key,
        script_name: m.scriptName,
        category: m.category,
        can_execute: permissions.includes(m.editPermission),
      }));

    return {
      ok: true,
      data: { scripts: list, total: list.length },
      summary: `可见脚本 ${list.length} 个，其中可执行 ${list.filter((s) => s.can_execute).length} 个`,
    };
  },
};
