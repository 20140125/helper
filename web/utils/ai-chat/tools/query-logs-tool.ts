import { listLogSources, isLogSourceValid, readSourceLogRows } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * query_logs 工具实现
 * @description 可用日志来源直接来自 hp_run_logs 按 source 聚合的结果，log_key 就是库里的 source 原值；
 *   不再有静态注册表、中文别名或日志文件。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "系统里都有哪些日志可以看？"      → {}（list 模式）
 *   - "看一下 web_server 最近 100 行"   → { log_key: 'web_server', lines: 100 }
 */
export const queryLogsTool: ToolImpl = {
  name: 'query_logs',
  description:
    '查系统运行日志。不传 log_key 先返回库里实际存在的来源清单（source / rows / bytes / latest），'
    + '再传 log_key 读末尾 N 行；log_key 必须是清单里的 source 原值。'
    + '排查套路（缓存 / 接口原始响应、长日志提炼）见 log-audit 技能。',
  parameters: {
    type: 'object',
    properties: {
      log_key: {
        type: 'string',
        description: 'hp_run_logs.source 原值，不传则列出库里全部来源',
      },
      lines: {
        type: 'number',
        description: '末尾行数，默认 50，最大 500',
      },
    },
  },
  requiredPermissions: ['logs:view'],
  invoke: async (args): Promise<ToolResult> => {
    const source = typeof args.log_key === 'string' ? args.log_key.trim() : '';
    const lines = Math.min(Math.max(Number(args.lines) || 50, 1), 500);

    if (source && !isLogSourceValid(source)) {
      return {
        ok: false,
        data: `未知 log_key=${source}，请先不传参查看库里的来源清单`,
      };
    }

    // list 模式：只列库里真实存在的来源（GROUP BY source）
    if (!source) {
      try {
        const sources = await listLogSources();
        return {
          ok: true,
          data: { available_logs: sources },
          summary: `库里共有 ${sources.length} 个日志来源`,
        };
      } catch (err) {
        return { ok: false, data: `日志来源清单查询失败：${(err as Error).message}` };
      }
    }

    // 读模式：直接查库，库里没有该来源的记录就视为未知 key，不再依赖静态白名单
    const result = await readSourceLogRows(source, lines);
    if ('missing' in result) {
      return {
        ok: false,
        data: `未知 log_key=${source}，请先不传参查看库里的来源清单`,
      };
    }
    if ('error' in result) {
      return {
        ok: false,
        data: `未知 log_key=${source}（日志库查询失败：${result.error}），请先不传参查看库里的来源清单`,
      };
    }
    return {
      ok: true,
      data: { source, lines, content: result.content },
      summary: `读取 ${source} 末尾 ${lines} 行`,
    };
  },
};
