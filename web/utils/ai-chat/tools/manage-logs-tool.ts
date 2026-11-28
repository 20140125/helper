import { listLogSources, isLogSourceValid, clearLogSource } from '@/routes/utils';
import type { LogSourceInfo } from '@/types/log';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 把字节数格式化为易读文本
 * @param {number} bytes - 字节数
 * @returns {string} 形如「2.4 MB」的文本
 */
const formatSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

/**
 * manage_logs 工具实现（日志写能力）
 * @description 清空的是 hp_run_logs 中对应 source 的库记录，目标集合来自 SELECT ... GROUP BY source，
 *   不再涉及任何日志文件、静态注册表或中文别名。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把 web_access 日志清空" → { action: 'clear', log_key: 'web_access' }
 *   - "把所有日志都清了"       → { action: 'clear_all' }
 */
export const manageLogsTool: ToolImpl = {
  name: 'manage_logs',
  description:
    '清空系统运行日志（不可恢复，写入前先想清楚）。action：clear（必传 log_key）/ clear_all（全部）。'
    + 'log_key 必须是 query_logs 清单里的 source 原值，不确定时先用 query_logs 不带参数看列表。'
    + '清空范围、体积确认与审批见 log-audit 技能。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['clear', 'clear_all'],
        description: '操作类型：clear（清空单个） / clear_all（清空全部）',
      },
      log_key: {
        type: 'string',
        description: 'hp_run_logs.source 原值（clear 时必填）',
      },
    },
    required: ['action'],
  },
  requiredPermissions: ['logs:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const action = typeof args.action === 'string' ? args.action.trim() : '';
    if (action !== 'clear' && action !== 'clear_all') {
      return { ok: false, data: `不支持的 action：${action}（只支持 clear / clear_all）` };
    }

    // 列表快照来自库聚合：既用于体积统计，也用于 clear_all 的目标集合
    let sources: LogSourceInfo[];
    try {
      sources = await listLogSources();
    } catch (err) {
      return { ok: false, data: `日志来源清单查询失败：${(err as Error).message}` };
    }

    if (action === 'clear_all') {
      const targets = sources.filter((s) => s.rows > 0);
      if (targets.length === 0) {
        return { ok: true, data: { cleared: [], freed_bytes: 0 }, summary: '库里本来就没有日志记录，无需清空' };
      }
      const freedBytes = targets.reduce((sum, s) => sum + s.bytes, 0);
      const cleared = targets.map((s) => ({ source: s.source, size: s.bytes }));
      await Promise.all(targets.map((s) => clearLogSource(s.source)));
      return {
        ok: true,
        data: { cleared, freed_bytes: freedBytes },
        summary: `已清空 ${cleared.length} 个日志来源（删除对应库记录），释放 ${formatSize(freedBytes)}`,
      };
    }

    const source = typeof args.log_key === 'string' ? args.log_key.trim() : '';
    if (!source || !isLogSourceValid(source) || !sources.some((s) => s.source === source)) {
      return {
        ok: false,
        data: `未知 log_key=${source || '(空)'}，请先调 query_logs 不带参数查看库里的来源清单`,
      };
    }

    const target = sources.find((s) => s.source === source);
    const removed = await clearLogSource(source);
    return {
      ok: true,
      data: { source, freed_bytes: target?.bytes ?? 0, removed },
      summary: target?.rows
        ? `已清空 ${source}，删除 ${removed} 条库记录`
        : `已清空 ${source}，该来源原本没有记录`,
    };
  },
};
