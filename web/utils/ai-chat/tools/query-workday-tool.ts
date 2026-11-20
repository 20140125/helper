import path from 'path';
import { runScript } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 单日工作日信息（与 scripts/tools/workday_query.sh 输出字段对齐） */
interface WorkdayInfo {
  date: string;
  weekday: string;
  is_workday: boolean;
  is_holiday: boolean;
  is_adjust_workday: boolean;
  holiday_name: string;
}

/** 一次最多查询天数，防止把整年都塞进上下文 */
const MAX_DAYS = 31;

/** 查询脚本相对 PROJECT_DIR 的路径 */
const SCRIPT_REL_PATH = path.posix.join('scripts', 'tools', 'workday_query.sh');

/**
 * 把单日信息转成人话
 * @param {WorkdayInfo} d - 单日信息
 * @returns {string} 如 "2026-10-10 周六 调休上班（国庆节调休上班）"
 */
const describeDay = (d: WorkdayInfo): string => {
  const suffix = d.holiday_name ? `（${d.holiday_name}）` : '';
  if (d.is_adjust_workday) return `${d.date} ${d.weekday} 调休上班${suffix}`;
  if (d.is_holiday) return `${d.date} ${d.weekday} 放假${suffix}`;
  return `${d.date} ${d.weekday} ${d.is_workday ? '工作日' : '休息日'}`;
};

/**
 * query_workday 工具实现
 * @description 查询某日（或连续多日）是否工作日，复用 holiday_config.sh 的权威判断
 *              （法定节假日 + 公司特别假 + 调休上班日），而非只看周末。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "今天要上班吗"                    → {}
 *   - "2026-10-10 是工作日吗"           → { date: '2026-10-10' }
 *   - "这周哪几天上班"                  → { days: 7 }
 *   - "最近一个月有哪些假期"             → { days: 30 }
 */
export const queryWorkdayTool: ToolImpl = {
  name: 'query_workday',
  description:
    '查询某日或连续多日是否为工作日（含法定节假日、公司特别假、调休上班日）。'
    + '不传 date 时从今天开始；days 为查询天数（默认 1，最大 31）。'
    + '返回每天的星期、是否工作日、是否放假、是否调休及节日名称。'
    + '问"今天/明天上班吗""这周哪几天上班""最近有什么假期"时用本工具，不要用模型知识推断。',
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: '起始日期 YYYY-MM-DD，不传则从今天开始',
      },
      days: {
        type: 'number',
        description: '连续查询天数，默认 1，最大 31',
      },
    },
  },
  requiredPermissions: ['cache:view'],
  invoke: async (args): Promise<ToolResult> => {
    const rawDate = typeof args.date === 'string' ? args.date.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '';
    const rawDays = Number(args.days);
    const days = Number.isFinite(rawDays) && rawDays > 0
      ? Math.min(Math.trunc(rawDays), MAX_DAYS)
      : 1;

    let result: { stdout: string; stderr: string };
    try {
      // date 为空时传空串占位，脚本侧按 ${1:-今天} 兜底
      result = await runScript(SCRIPT_REL_PATH, [date, String(days)]);
    } catch (err) {
      return { ok: false, data: `工作日查询失败：${(err as Error).message}` };
    }

    const stdout = (result.stdout ?? '').trim();
    let parsed: { days?: WorkdayInfo[] } | null = null;
    try {
      parsed = JSON.parse(stdout) as { days?: WorkdayInfo[] };
    } catch {
      parsed = null;
    }
    const list = parsed?.days ?? [];
    if (list.length === 0) {
      return { ok: false, data: `工作日查询没有返回结果：${stdout.slice(0, 200) || '空输出'}` };
    }

    const workdayCount = list.filter((d) => d.is_workday).length;
    const holidays = list.filter((d) => d.is_holiday);
    const adjusts = list.filter((d) => d.is_adjust_workday);

    const summary = list.length === 1
      ? describeDay(list[0])
      : `${list[0].date} ~ ${list[list.length - 1].date} 共 ${list.length} 天，工作日 ${workdayCount} 天`
        + `${holidays.length > 0 ? `，放假 ${holidays.length} 天（${holidays.map((d) => d.holiday_name || d.date).join('、')}）` : ''}`
        + `${adjusts.length > 0 ? `，调休上班 ${adjusts.length} 天` : ''}`;

    return {
      ok: true,
      data: {
        days: list,
        range: { start: list[0].date, end: list[list.length - 1].date, count: list.length },
        workday_count: workdayCount,
        holidays,
        adjust_workdays: adjusts,
      },
      summary,
    };
  },
};
