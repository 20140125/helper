import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { getUserPermissionsByEmail } from '@/utils/rbac';
import { isAdminEmail } from '@/utils/auth';
import { SCRIPTS_DIR, WEB_DIR } from '@/utils/paths';
import { runInspection, type InspectionResult } from './inspection';
import { isValidCron, matchCron } from './cron';

/**
 * 巡检调度器
 * @description 挂在 Web 进程内的轻量定时器（每分钟检查一次是否到点）。
 *   之所以不放进 reminder_daemon.sh：巡检要跑 LLM + 工具，走 HTTP 还得解决脚本侧鉴权，
 *   而 Web 进程本来就是长驻的、且已经持有工具与 RBAC 能力，放在这里最省事。
 *
 *   相比初版补齐的四件事：
 *   1. 运行标记入库（hp_ai_inspection_state 的 scheduler 行），Web 重启不再重复巡检；
 *   2. 到点判定改为「时间窗」而非「精确相等」，定时器漂移不会整天漏跑，
 *      服务晚启动也能在补跑窗口内补一次（AI_INSPECTOR_CATCHUP_MINUTES）；
 *   3. 每分钟重读 .env 的 AI_INSPECTOR_* 键，改配置不用重启 Web；
 *   4. 未启用 / 跑挂了都要有日志，不再静默。
 */

/** 巡检配置（读环境变量） */
export interface InspectorConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 每日触发时间 HH:mm（未配置 cron 时生效） */
  time: string;
  /** cron 表达式（五段，优先于 time；用于「每周一 9 点」这类订阅式调度） */
  schedule: string;
  /** 是否推送到企微群 */
  push: boolean;
  /** 执行身份邮箱（决定权限与工具可见范围） */
  email: string;
  /** 补跑窗口（分钟）：过了触发点但在窗口内启动/恢复，仍补跑一次；0 表示只在当分钟触发 */
  catchUpMinutes: number;
  /** 当日连续失败上限，达到后当天不再重试 */
  maxFails: number;
}

/** 调度器对外暴露的运行状态（供状态接口与前端展示） */
export interface InspectorStatus {
  /** 是否启用 */
  enabled: boolean;
  /** 是否正在执行 */
  running: boolean;
  /** 生效的时间配置（cron 表达式或 HH:mm） */
  schedule: string;
  /** 人类可读的调度描述 */
  scheduleText: string;
  /** 是否推送到企微群 */
  push: boolean;
  /** 执行身份邮箱 */
  email: string;
  /** 最近一次执行时间（ISO 字符串，从未执行为空串） */
  lastRunAt: string;
  /** 最近一次执行结果：idle 未跑过 / ok 成功 / fail 失败 */
  lastStatus: 'idle' | 'ok' | 'fail';
  /** 最近一次失败原因（成功为空串） */
  lastError: string;
  /** 最近一次执行摘要（token / 工具调用 / 是否推送） */
  lastSummary: string;
  /** 下一次预计执行时间（ISO 字符串，未启用或无法计算为空串） */
  nextRunAt: string;
  /** 当日连续失败次数 */
  failCount: number;
  /** 最近一次巡检的产出（含简报正文）；未跑过时为 null */
  lastResult: InspectionRunRecord | null;
}

/** 需要支持热更新的环境变量键（改 .env 后 60s 内自动生效） */
const INSPECTOR_ENV_KEYS = [
  'AI_INSPECTOR_ENABLED',
  'AI_INSPECTOR_TIME',
  'AI_INSPECTOR_SCHEDULE',
  'AI_INSPECTOR_PUSH',
  'AI_INSPECTOR_EMAIL',
  'AI_INSPECTOR_CATCHUP_MINUTES',
  'AI_INSPECTOR_MAX_FAILS',
];

/** 当前状态行的来源标识（hp_ai_inspection_state.source_file 唯一键） */
const STATE_SOURCE = 'scheduler';

/** 当前状态行的查询列 */
const STATE_COLUMNS = 'SELECT last_run_date, last_run_minute, last_run_at, last_status, last_error, '
  + 'last_summary, fail_count, last_result FROM hp_ai_inspection_state';

/** 定时器间隔（ms） */
const TICK_MS = 60_000;

/** 补跑窗口默认值（分钟） */
const DEFAULT_CATCHUP_MINUTES = 60;

/** 当日连续失败上限默认值 */
const DEFAULT_MAX_FAILS = 3;

/** 下次运行时间最多向后扫描的天数（cron 兜底，避免死循环） */
const NEXT_SCAN_DAYS = 8;

/** 最近一次巡检的产出（供状态接口回查，避免调用方同步干等） */
export interface InspectionRunRecord {
  /** 是否成功产出简报 */
  ok: boolean;
  /** 简报正文（Markdown） */
  report: string;
  /** 失败原因（成功为空串） */
  error: string;
  /** 端到端耗时（ms） */
  duration_ms: number;
  /** 消耗 token 总数 */
  total_tokens: number;
  /** 工具调用次数 */
  tool_calls: number;
  /** 是否已推送到企微群 */
  pushed: boolean;
  /** 本次执行时间（ISO） */
  run_at: string;
  /** 是否手动触发 */
  manual: boolean;
}

/** 入库的运行标记 */
interface PersistedState {
  /** 最近一次成功执行的本地日期（YYYY-MM-DD，每日一次模式去重） */
  lastRunDate: string;
  /** 最近一次巡检的产出（最近一次简报，供界面回查） */
  lastResult: InspectionRunRecord | null;
  /** 最近一次执行的本地分钟（YYYY-MM-DD HH:mm，cron 模式去重） */
  lastRunMinute: string;
  /** 最近一次执行时间（ISO） */
  lastRunAt: string;
  /** 最近一次执行结果 */
  lastStatus: 'idle' | 'ok' | 'fail';
  /** 最近一次失败原因 */
  lastError: string;
  /** 最近一次执行摘要 */
  lastSummary: string;
  /** 当日连续失败次数 */
  failCount: number;
}

const DEFAULT_PERSISTED: PersistedState = {
  lastRunDate: '',
  lastRunMinute: '',
  lastRunAt: '',
  lastStatus: 'idle',
  lastError: '',
  lastSummary: '',
  failCount: 0,
  lastResult: null,
};

/** 内存状态：持久化字段 + 执行中标记 */
const state: PersistedState & { running: boolean } = {
  ...DEFAULT_PERSISTED,
  running: false,
};

/** 状态恢复 Promise：tick 在它完成前不判断是否巡检，避免重启后重复跑 */
let stateReady: Promise<void> = Promise.resolve();

/** 是否已经打印过「未启用」提示（避免每分钟刷屏） */
let disabledLogged = false;

/** 上一次生效的启用状态（用于检测配置变化并打印日志） */
let lastEnabled: boolean | null = null;

/** hp_ai_inspection_state 中 scheduler 行的字段 */
interface InspectionStateRow {
  last_run_date: string | null;
  last_run_minute: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_summary: string | null;
  fail_count: number;
  last_result: InspectionRunRecord | string | null;
}

/**
 * 解析库里的 last_result JSON 列
 * @param {unknown} raw - mysql2 返回值（通常已是对象，兼容字符串形态）
 * @returns {InspectionRunRecord | null} 最近一次巡检产出
 */
const parseLastResult = (raw: unknown): InspectionRunRecord | null => {
  if (!raw) return null;
  const value = typeof raw === 'string' ? JSON.parse(raw) as InspectionRunRecord : raw as InspectionRunRecord;
  return typeof value === 'object' && value !== null ? value : null;
};

/**
 * 读取数据库中的运行标记
 * @returns {Promise<PersistedState>} 运行标记；无记录或读取失败时返回默认值
 * @description 只在进程启动时读一次；之后由内存态维护并写回，避免每次 tick 都查库。
 */
export const loadPersistedState = async (): Promise<PersistedState> => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `${STATE_COLUMNS} WHERE source_file = ? LIMIT 1`,
      [STATE_SOURCE],
    );
    const row = (rows as InspectionStateRow[])[0];
    if (!row) return { ...DEFAULT_PERSISTED };
    return {
      lastRunDate: typeof row.last_run_date === 'string' ? row.last_run_date : '',
      lastRunMinute: typeof row.last_run_minute === 'string' ? row.last_run_minute : '',
      lastRunAt: typeof row.last_run_at === 'string' ? row.last_run_at : '',
      lastStatus: row.last_status === 'ok' || row.last_status === 'fail' ? row.last_status : 'idle',
      lastError: typeof row.last_error === 'string' ? row.last_error : '',
      lastSummary: typeof row.last_summary === 'string' ? row.last_summary : '',
      failCount: Number.isInteger(row.fail_count) && Number(row.fail_count) >= 0
        ? Number(row.fail_count)
        : 0,
      lastResult: parseLastResult(row.last_result),
    };
  } catch (err) {
    console.warn(`[ai-inspect] 读取运行标记失败，按未执行处理：${(err as Error).message}`);
    return { ...DEFAULT_PERSISTED };
  }
};

/**
 * 写回运行标记到数据库
 * @param {PersistedState} [persisted] - 要保存的状态，默认取内存态
 * @returns {Promise<void>}
 * @description 以 source_file='scheduler' 做 UPSERT；写库失败只告警不抛出，
 *   它只影响「重启后是否重复跑」，不该拖垮巡检本身。
 */
export const savePersistedState = async (persisted: PersistedState = state): Promise<void> => {
  try {
    const {
      lastRunDate, lastRunMinute, lastRunAt, lastStatus, lastError, lastSummary, failCount, lastResult,
    } = persisted;
    const r = lastResult;
    await getPool().execute(
      'INSERT INTO hp_ai_inspection_state '
      + '(source_file, last_run_date, last_run_minute, last_run_at, last_status, last_error, last_summary, '
      + 'fail_count, report, duration_ms, total_tokens, tool_calls, pushed, run_at, manual, last_result) '
      + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
      + 'ON DUPLICATE KEY UPDATE '
      + 'last_run_date = VALUES(last_run_date), last_run_minute = VALUES(last_run_minute), '
      + 'last_run_at = VALUES(last_run_at), last_status = VALUES(last_status), '
      + 'last_error = VALUES(last_error), last_summary = VALUES(last_summary), '
      + 'fail_count = VALUES(fail_count), report = VALUES(report), '
      + 'duration_ms = VALUES(duration_ms), total_tokens = VALUES(total_tokens), '
      + 'tool_calls = VALUES(tool_calls), pushed = VALUES(pushed), run_at = VALUES(run_at), '
      + 'manual = VALUES(manual), last_result = VALUES(last_result)',
      [
        STATE_SOURCE, lastRunDate, lastRunMinute, lastRunAt, lastStatus, lastError, lastSummary, failCount,
        r ? r.report : null, r ? r.duration_ms : 0, r ? r.total_tokens : 0, r ? r.tool_calls : 0,
        r && r.pushed ? 1 : 0, r ? r.run_at : null, r && r.manual ? 1 : 0,
        r ? JSON.stringify(r) : null,
      ],
    );
  } catch (err) {
    console.warn(`[ai-inspect] 写入运行标记失败：${(err as Error).message}`);
  }
};

/**
 * 重新加载 .env 中的 AI_INSPECTOR_* 配置
 * @returns {void}
 * @description process.env 不会因为文件被改而更新，所以每分钟自己 parse 一次。
 *   只覆盖巡检相关的键，避免误伤其它配置；web/.env 优先，缺失时回退 scripts/.env。
 */
const reloadInspectorEnv = (): void => {
  const files = [path.join(WEB_DIR, '.env'), path.join(SCRIPTS_DIR, '.env')];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = dotenv.parse(fs.readFileSync(file, 'utf-8'));
      INSPECTOR_ENV_KEYS.forEach((key) => {
        if (typeof parsed[key] === 'string') process.env[key] = parsed[key] as string;
      });
      return;
    } catch (err) {
      console.warn(`[ai-inspect] 解析 ${file} 失败，沿用当前配置：${(err as Error).message}`);
    }
  }
};

/**
 * 取本地日期键（YYYY-MM-DD）
 * @param {Date} date - 时间
 * @returns {string} 本地日期键
 * @description 不能用 toISOString()：那是 UTC 日期，与本地 HH:mm 触发判定会错位
 *   （东八区 00:30 会被算成「前一天」，导致一天跑两次）。
 */
const localDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 取本地分钟键（YYYY-MM-DD HH:mm）
 * @param {Date} date - 时间
 * @returns {string} 本地分钟键
 */
const minuteKey = (date: Date): string =>
  `${localDateKey(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * 解析 HH:mm
 * @param {string} value - 时间字符串
 * @returns {{ hour: number; minute: number } | null} 解析结果；非法返回 null
 */
const parseTime = (value: string): { hour: number; minute: number } | null => {
  const matched = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim());
  if (!matched) return null;
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

/**
 * 读取巡检配置
 * @returns {InspectorConfig} 当前生效的配置
 * @description 未配置 AI_INSPECTOR_EMAIL 时回退到 MAIL_USERNAME（管理员邮箱）。
 */
export const readInspectorConfig = (): InspectorConfig => {
  const catchUp = Number((process.env.AI_INSPECTOR_CATCHUP_MINUTES ?? '').trim());
  const maxFails = Number((process.env.AI_INSPECTOR_MAX_FAILS ?? '').trim());
  return {
    enabled: (process.env.AI_INSPECTOR_ENABLED ?? '').trim() === 'true',
    time: (process.env.AI_INSPECTOR_TIME ?? '09:30').trim() || '09:30',
    schedule: (process.env.AI_INSPECTOR_SCHEDULE ?? '').trim(),
    push: (process.env.AI_INSPECTOR_PUSH ?? 'true').trim() !== 'false',
    email: (process.env.AI_INSPECTOR_EMAIL ?? '').trim() || (process.env.MAIL_USERNAME ?? '').trim(),
    catchUpMinutes: Number.isFinite(catchUp) && catchUp >= 0 ? catchUp : DEFAULT_CATCHUP_MINUTES,
    maxFails: Number.isInteger(maxFails) && maxFails >= 1 ? maxFails : DEFAULT_MAX_FAILS,
  };
};

/**
 * 判断当前时刻是否应该触发
 * @param {InspectorConfig} config - 巡检配置
 * @param {Date} now - 当前时间
 * @returns {boolean} 到点返回 true
 * @description cron 模式：命中表达式且这一分钟没跑过（允许一天多次，如每 30 分钟一次）。
 *   HH:mm 模式：到点后处于补跑窗口内且今天没跑过——用时间窗代替精确相等，
 *   这样定时器漂移、进程卡顿、服务晚启动都不会导致整天漏跑。
 */
const isTimeToRun = (config: InspectorConfig, now: Date): boolean => {
  if (config.schedule) {
    if (!isValidCron(config.schedule)) return false;
    return matchCron(config.schedule, now) && state.lastRunMinute !== minuteKey(now);
  }
  const parsed = parseTime(config.time);
  if (!parsed) return false;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsed.hour, parsed.minute, 0, 0);
  const diffMinutes = (now.getTime() - target.getTime()) / 60_000;
  if (diffMinutes < 0 || diffMinutes > config.catchUpMinutes) return false;
  return state.lastRunDate !== localDateKey(now);
};

/**
 * 计算下一次预计执行时间
 * @param {InspectorConfig} config - 巡检配置
 * @param {Date} now - 当前时间
 * @returns {string} ISO 时间字符串；未启用、配置非法或算不出来时返回空串
 */
const computeNextRunAt = (config: InspectorConfig, now: Date): string => {
  if (config.schedule) {
    if (!isValidCron(config.schedule)) return '';
    const cursor = new Date(now.getTime());
    cursor.setSeconds(0, 0);
    const limit = NEXT_SCAN_DAYS * 24 * 60;
    for (let i = 0; i < limit; i += 1) {
      cursor.setTime(cursor.getTime() + 60_000);
      if (matchCron(config.schedule, cursor)) return cursor.toISOString();
    }
    return '';
  }
  const parsed = parseTime(config.time);
  if (!parsed) return '';
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsed.hour, parsed.minute, 0, 0);
  if (state.lastRunDate === localDateKey(now)) {
    target.setDate(target.getDate() + 1);
    return target.toISOString();
  }
  if (target.getTime() > now.getTime()) return target.toISOString();
  // 已过今天的触发点：还在补跑窗口内就是「马上跑」，超出窗口只能等明天
  if ((now.getTime() - target.getTime()) / 60_000 <= config.catchUpMinutes) return now.toISOString();
  target.setDate(target.getDate() + 1);
  return target.toISOString();
};

/**
 * 执行一轮巡检并更新运行标记
 * @param {InspectorConfig} config - 巡检配置
 * @param {object} [options] - 可选参数
 * @param {boolean} [options.manual] - 是否手动触发（手动不占用当日的定时配额）
 * @param {string} [options.focus] - 额外关注点
 * @param {boolean} [options.push] - 是否推送（不传走配置）
 * @param {string} [options.model] - 指定模型
 * @returns {Promise<InspectionResult>} 巡检结果
 * @description 成功才写 lastRunDate（今日配额已用），失败不写——补跑窗口内下一分钟自动重试，
 *   连续失败达到 maxFails 后当天停手，避免 LLM 限流/故障时限流式刷调用。
 */
const runOnce = async (
  config: InspectorConfig,
  options: { manual?: boolean; focus?: string; push?: boolean; model?: string } = {},
): Promise<InspectionResult> => {
  state.running = true;
  const now = new Date();
  const today = localDateKey(now);
  try {
    const isAdmin = isAdminEmail(config.email);
    const permissions = await getUserPermissionsByEmail(config.email, isAdmin);
    console.log(`[ai-inspect] 开始${options.manual ? '手动' : '定时'}巡检（身份 ${config.email}）`);
    const result = await runInspection({
      userEmail: config.email,
      userPermissions: permissions,
      push: options.push ?? config.push,
      focus: options.focus,
      model: options.model,
    });

    state.lastRunAt = new Date().toISOString();
    state.lastRunMinute = minuteKey(new Date());
    state.lastResult = {
      ok: result.ok,
      report: result.report,
      error: result.error,
      duration_ms: result.duration_ms,
      total_tokens: result.total_tokens,
      tool_calls: result.tool_calls,
      pushed: result.pushed,
      run_at: state.lastRunAt,
      manual: Boolean(options.manual),
    };
    if (result.ok) {
      state.lastRunDate = options.manual ? state.lastRunDate : today;
      state.lastStatus = 'ok';
      state.lastError = '';
      state.failCount = 0;
      state.lastSummary = `tokens=${result.total_tokens} tools=${result.tool_calls} pushed=${result.pushed}`;
      console.log(`[ai-inspect] 巡检完成 ${state.lastSummary} ${result.duration_ms}ms`);
    } else {
      state.lastStatus = 'fail';
      state.lastError = result.error || '巡检未产出简报';
      state.failCount += 1;
      state.lastSummary = '';
      console.warn(`[ai-inspect] 巡检未产出简报：${state.lastError}（当日第 ${state.failCount} 次）`);
    }
    await savePersistedState();
    return result;
  } catch (err) {
    state.lastRunAt = new Date().toISOString();
    state.lastStatus = 'fail';
    state.lastError = (err as Error).message;
    state.failCount += 1;
    state.lastSummary = '';
    await savePersistedState();
    console.warn(`[ai-inspect] 巡检失败：${state.lastError}（当日第 ${state.failCount} 次）`);
    throw err;
  } finally {
    state.running = false;
  }
};

/**
 * 后台发起一次巡检（供 HTTP 接口与界面按钮调用，不等待结果）
 * @param {object} input - 触发参数
 * @param {string} input.userEmail - 执行身份邮箱（接口侧登录用户，权限按它重新解析）
 * @param {boolean} [input.push] - 是否推送到企微群（不传走配置）
 * @param {string} [input.focus] - 额外关注点
 * @param {string} [input.model] - 指定模型
 * @returns {{ started: boolean; error: string }} 是否成功发起；已在跑时 started=false
 * @description 一轮巡检要跑完整 Agent（多轮 LLM + 工具），几十秒到几分钟都可能，
 *   让 HTTP 请求同步干等必然撞上网关/浏览器超时——所以这里只负责「点火」：
 *   立即返回，调用方通过 GET /inspect/status 轮询 running 与 lastResult 取结果。
 *   与定时巡检共用同一把锁，避免两边同时跑导致重复推送。
 */
export const startInspectionNow = (input: {
  userEmail: string;
  push?: boolean;
  focus?: string;
  model?: string;
}): { started: boolean; error: string } => {
  if (state.running) return { started: false, error: '已有巡检正在执行，请稍后再试' };
  const config = readInspectorConfig();
  void runOnce(
    { ...config, email: input.userEmail },
    { manual: true, focus: input.focus, push: input.push, model: input.model },
  ).catch(() => undefined);
  return { started: true, error: '' };
};

/**
 * 取调度器当前状态
 * @returns {InspectorStatus} 状态快照（含配置、上次/下次执行时间）
 */
export const getInspectorStatus = (): InspectorStatus => {
  const config = readInspectorConfig();
  const now = new Date();
  const useCron = Boolean(config.schedule) && isValidCron(config.schedule);
  return {
    enabled: config.enabled,
    running: state.running,
    schedule: config.schedule || config.time,
    scheduleText: useCron
      ? `cron「${config.schedule}」`
      : config.enabled
        ? `每天 ${config.time}`
        : `未启用（配置后每天 ${config.time}）`,
    push: config.push,
    email: config.email,
    lastRunAt: state.lastRunAt,
    lastStatus: state.lastStatus,
    lastError: state.lastError,
    lastSummary: state.lastSummary,
    nextRunAt: config.enabled ? computeNextRunAt(config, now) : '',
    failCount: state.failCount,
    lastResult: state.lastResult,
  };
};

/**
 * 跨天重置失败计数
 * @param {Date} now - 当前时间
 * @returns {Promise<void>}
 * @description 昨天的失败不该占用今天的重试额度，否则一次限流会让巡检永久停摆。
 */
const resetIfNewDay = async (now: Date): Promise<void> => {
  if (!state.lastRunAt || state.failCount === 0) return;
  if (localDateKey(new Date(state.lastRunAt)) === localDateKey(now)) return;
  state.failCount = 0;
  state.lastError = '';
  state.lastSummary = '';
  if (state.lastStatus === 'fail') state.lastStatus = 'idle';
  await savePersistedState();
};

/**
 * 定时器每Tick逻辑：判断是否该跑，跑就跑
 * @returns {Promise<void>}
 */
const tick = async (): Promise<void> => {
  await stateReady;
  reloadInspectorEnv();
  const config = readInspectorConfig();
  await resetIfNewDay(new Date());

  if (!config.enabled) {
    if (!disabledLogged) {
      disabledLogged = true;
      console.log('[ai-inspect] 定时巡检未启用（AI_INSPECTOR_ENABLED=true 开启，改 .env 后无需重启）');
    }
    lastEnabled = false;
    return;
  }
  if (lastEnabled !== true) {
    console.log(`[ai-inspect] 检测到巡检已启用：${config.schedule ? `cron「${config.schedule}」` : `每天 ${config.time}`}`);
  }
  disabledLogged = false;
  lastEnabled = true;

  if (!config.email) {
    console.warn('[ai-inspect] 已启用但未配置 AI_INSPECTOR_EMAIL / MAIL_USERNAME，跳过本次调度');
    return;
  }
  if (state.running) return;
  if (state.failCount >= config.maxFails && state.lastStatus === 'fail') {
    return;
  }
  const now = new Date();
  if (!isTimeToRun(config, now)) return;
  try {
    await runOnce(config);
  } catch {
    // 失败细节已在 runOnce 内记日志并入库，这里只吞掉异常避免定时器崩掉
  }
};

/**
 * 启动巡检调度器
 * @returns {() => void} 停止函数（清理定时器，供进程退出时调用）
 * @description 定时器常驻：即使当前未启用也会每分钟重读一次 .env，
 *   这样在界面/配置里把 AI_INSPECTOR_ENABLED 改成 true 后无需重启即生效。
 *   未启用的常态开销只有「读一个文件 + 几次字符串比较」。
 */
export const startInspectionScheduler = (): (() => void) => {
  stateReady = loadPersistedState()
    .then((persisted) => {
      Object.assign(state, persisted);
      if (state.lastRunAt) {
        console.log(`[ai-inspect] 已恢复上次运行标记：${state.lastRunAt}（${state.lastStatus}）`);
      }
    })
    .catch((err: Error) => {
      console.warn(`[ai-inspect] 恢复运行标记失败：${err.message}`);
    });

  const timer = setInterval(() => void tick(), TICK_MS);
  // 不阻止进程退出：巡检是附属能力，不该把事件循环钉住
  timer.unref?.();

  // 启动即检查一次：服务在触发点之后才起来时，落在补跑窗口内可以马上补一次
  void tick();

  return () => clearInterval(timer);
};
