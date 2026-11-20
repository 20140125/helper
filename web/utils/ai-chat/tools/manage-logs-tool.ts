import { listLogFiles, isLogKeyValid, clearLogFile } from '@/routes/utils';
import { LOG_LABELS } from '@/types/log';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 反向映射：中文标签 → log_key
 * @description 用户口语化提及「守护进程日志 / 自定义规则日志」时，LLM 可能直接传中文，本表用于反查 key。
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
 * 把用户传入的 log_key 解析为合法 key：英文 key 直接命中，中文标签反查，都失败返回空串
 * @param {string} raw - 原始入参
 * @returns {string} 合法 key；未命中时返回空字符串
 */
const resolveLogKey = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (isLogKeyValid(trimmed)) return trimmed;
  const fromLabel = getLabelToKey()[trimmed];
  return fromLabel ?? '';
};

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
 * @description query_logs 只能看，清空此前只能去 Web「运行日志」页手点。
 *   本工具补齐清空能力（单个 / 全部），并纳入增删改白名单——严格模式下会先建审批单，
 *   由超级管理员通过后生效。只覆盖 LOG_FILES 里已注册的日志，不动 scripts/logs 下的历史归档。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把自定义规则日志清空"        → { action: 'clear', log_key: 'custom_rules' }
 *   - "清空「守护进程」日志"        → { action: 'clear', log_key: '守护进程' }
 *   - "把所有日志都清了"            → { action: 'clear_all' }
 */
export const manageLogsTool: ToolImpl = {
  name: 'manage_logs',
  description:
    '清空系统运行日志（不可恢复，写入前先想清楚）。action：clear（必传 log_key）/ clear_all（全部）。'
    + 'log_key 支持英文 key 或中文名，不确定时先用 query_logs 不带参数看列表。'
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
        description: '日志标识（clear 时必填），支持英文 key 或中文名，如 custom_rules / 自定义规则',
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

    // 列表快照：既用于体积统计，也用于 clear_all 的目标集合
    const files = listLogFiles();

    if (action === 'clear_all') {
      const targets = files.filter((f) => f.exists && f.size > 0);
      if (targets.length === 0) {
        return { ok: true, data: { cleared: [], freed_bytes: 0 }, summary: '所有日志本来就是空的，无需清空' };
      }
      const freedBytes = targets.reduce((sum, f) => sum + f.size, 0);
      const cleared = targets.map((f) => ({ key: f.key, label: LOG_LABELS[f.key] ?? f.key, size: f.size }));
      targets.forEach((f) => clearLogFile(f.key));
      return {
        ok: true,
        data: { cleared, freed_bytes: freedBytes },
        summary: `已清空 ${cleared.length} 个日志文件，释放 ${formatSize(freedBytes)}`,
      };
    }

    // clear：单个日志
    const rawKey = typeof args.log_key === 'string' ? args.log_key : '';
    const logKey = resolveLogKey(rawKey);
    if (!logKey) {
      return {
        ok: false,
        data: `未知 log_key=${rawKey || '(空)'}，请先调 query_logs 不带参数看可用列表（中文/英文均可）`,
      };
    }

    const target = files.find((f) => f.key === logKey);
    const label = LOG_LABELS[logKey] ?? logKey;
    clearLogFile(logKey);
    return {
      ok: true,
      data: { key: logKey, label, freed_bytes: target?.size ?? 0 },
      summary: target?.exists
        ? `已清空「${label}」（${logKey}），释放 ${formatSize(target.size)}`
        : `已清空「${label}」（${logKey}），文件原本为空`,
    };
  },
};
