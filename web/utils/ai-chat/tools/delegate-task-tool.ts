import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import { runSubAgent } from '../sub-agent';

/**
 * delegate_task 工具实现（子 Agent 委派）
 * @description 主 Agent 遇到「要翻很多数据但只要一句结论」的子任务时，把它委派给子 Agent：
 *   子 Agent 在自己的小循环里查工具、消化原始返回，只把结论交回来，主上下文不被污染。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把最近三天日志里的报错摘出来"  → { task: '从系统日志中提取最近三天的 ERROR 记录，按次数排序', allowed_tools: ['query_logs'] }
 *   - "看看哪些规则没启用"             → { task: '列出所有 enabled=false 的自定义规则及其名称', allowed_tools: ['query_rules'] }
 */
export const delegateTaskTool: ToolImpl = {
  name: 'delegate_task',
  description:
    '把「要查很多数据、但只要一句结论」的子任务委派给子 Agent：'
    + '子 Agent 在独立上下文里自行调用只读工具、消化原始返回，只把 300 字内的结论交回给你，'
    + '避免大量原始数据挤占你的上下文。'
    + '适用：日志筛查、长列表提炼、批量统计、多条件交叉比对——即需要连续 3 次以上同类工具调用的任务。'
    + '不适用：单次就能查完的简单查询，这类场景直接调对应工具，不要委派。',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '子任务指令：写清楚要查什么、按什么口径整理、要什么形式的结论',
      },
      allowed_tools: {
        type: 'array',
        items: { type: 'string' },
        description: '允许子 Agent 使用的工具名（建议只给必需的 1~2 个，如 query_logs / query_rules）',
      },
    },
    required: ['task'],
  },
  invoke: async (args, ctx): Promise<ToolResult> => {
    const task = typeof args.task === 'string' ? args.task.trim() : '';
    if (!task) {
      return { ok: false, data: 'task 不能为空' };
    }
    const allowedTools = Array.isArray(args.allowed_tools)
      ? args.allowed_tools.filter((v): v is string => typeof v === 'string')
      : [];

    try {
      const result = await runSubAgent({
        task,
        context: ctx,
        allowedToolNames: allowedTools,
      });
      if (!result.ok) {
        return { ok: false, data: '子 Agent 未产出结论' };
      }
      return {
        ok: true,
        data: {
          answer: result.answer,
          tool_calls: result.tool_calls,
          iterations: result.iterations,
        },
        summary: `子任务完成（调用 ${result.tool_calls} 次工具）`,
      };
    } catch (err) {
      return { ok: false, data: `子 Agent 执行失败：${(err as Error).message}` };
    }
  },
};
