import { listLogFiles, isLogKeyValid, readLogTail } from '@/routes/utils';
import { LOG_LABELS } from '@/types/log';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 反向映射：中文标签 → log_key
 * @description 用户口语化提及"生日提醒/工作日提醒"时，LLM 可能直接传中文，本表用于反查 key。
 *   首次访问惰性构建，后续命中 O(1)。
 */
let labelToKeyCache: Record<string, string> | null = null;
const getLabelToKey = (): Record<string, string> => {
  if (labelToKeyCache) return labelToKeyCache;
  const map: Record<string, string> = {};
  for (const [key, label] of Object.entries(LOG_LABELS)) {
    map[label] = key;
  }
  labelToKeyCache = map;
  return map;
};

/**
 * 把用户传入的 log_key 解析为合法 key：
 *   1) 已是合法英文 key 直接返回
 *   2) 命中中文标签则映射回英文 key
 *   3) 兜底：去除空白后再判一次
 * @param {string} raw - 原始入参
 * @returns {string} 合法 key；未命中时返回空字符串
 */
const resolveLogKey = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (isLogKeyValid(trimmed)) return trimmed;
  const labelMap = getLabelToKey();
  const fromLabel = labelMap[trimmed];
  if (fromLabel) return fromLabel;
  return '';
};

/**
 * query_logs 工具实现
 * @description 查询系统运行日志。可以列出可用的日志文件，或读取指定日志文件的最近若干行。
 *              常用于排查故障、查看脚本执行情况。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "系统里都有哪些日志可以看？"                  → {}（list 模式）
 *   - "看一下生日提醒日志最近 100 行"                → { log_key: 'birthday', lines: 100 }
 *   - "最近天气脚本有没有报错"                       → { log_key: 'weather' }
 */
export const queryLogsTool: ToolImpl = {
  name: 'query_logs',
  description:
    '查系统运行日志。不传 log_key 先返回可用日志列表（含中文名），再传 log_key 读末尾 N 行；'
    + 'log_key 支持英文 key 或对应中文名。'
    + '排查套路（缓存 / 接口原始响应、长日志提炼）见 log-audit 技能。',
  parameters: {
    type: 'object',
    properties: {
      log_key: {
        type: 'string',
        description: '日志标识，支持英文 key（如 birthday）或对应中文名（如「生日提醒」）；不传则列出全部',
      },
      lines: {
        type: 'number',
        description: '末尾行数，默认 50，最大 500',
      },
    },
  },
  requiredPermissions: ['logs:view'],
  invoke: async (args): Promise<ToolResult> => {
    const rawKey = typeof args.log_key === 'string' ? args.log_key : '';
    const lines = Math.min(Math.max(Number(args.lines) || 50, 1), 500);

    // list 模式：返回可用日志（带中文标签，方便 LLM 后续按中文名引导用户）
    if (!rawKey) {
      const files = await listLogFiles();
      const enriched = files.map((f) => ({
        ...f,
        label: LOG_LABELS[f.key] ?? f.key,
      }));
      return {
        ok: true,
        data: { available_logs: enriched },
        summary: `当前共有 ${enriched.length} 个可用日志来源`,
      };
    }

    // 读取模式：英文 / 中文 → 合法 key
    const logKey = resolveLogKey(rawKey);
    if (!logKey) {
      return {
        ok: false,
        data: `未知 log_key=${rawKey}，请先不传参查看可用列表（中文/英文均可）`,
      };
    }

    const result = await readLogTail(logKey, lines);
    const label = LOG_LABELS[logKey] ?? logKey;
    if ('missing' in result) {
      return { ok: true, data: { log_key: logKey, label, content: '' }, summary: `${label}（${logKey}）暂无日志记录` };
    }
    if ('error' in result) {
      return { ok: false, data: `读取 ${label}（${logKey}）日志失败：${result.error}` };
    }
    return {
      ok: true,
      data: { log_key: logKey, label, lines, content: result.content },
      summary: `读取 ${label} 末尾 ${lines} 行`,
    };
  },
};
