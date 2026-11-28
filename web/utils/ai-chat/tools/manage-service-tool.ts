import path from 'path';
import { runScript } from '@/routes/utils';
import { PROJECT_DIR } from '@/utils/paths';
import { readPidFile } from '@/utils/runtime';
import { PID_FILE, LEGACY_PID_FILE } from '@/types/web-service';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';
import { checkConsent } from './_consent-guard';

/** 可控目标：Web 服务 / 提醒守护进程 */
type ServiceTarget = 'web' | 'daemon';

/** 目标 → 管理脚本路径（相对 PROJECT_DIR） */
const SCRIPT_MAP: Record<ServiceTarget, string> = {
  web: path.posix.join('scripts', 'start_web.sh'),
  daemon: path.posix.join('scripts', 'daemon.sh'),
};

/** 目标 → 查看 / 执行权限码 */
const VIEW_PERMISSION_MAP: Record<ServiceTarget, string> = {
  web: 'web-service:view',
  daemon: 'daemon:view',
};
const EDIT_PERMISSION_MAP: Record<ServiceTarget, string> = {
  web: 'web-service:edit',
  daemon: 'daemon:edit',
};

/** 目标中文名（用于日志与返回文案） */
const TARGET_LABEL: Record<ServiceTarget, string> = {
  web: 'Web 服务（9527）',
  daemon: '提醒守护进程 / 年度调度器',
};

/**
 * 目标 → PID 文件读取器（管理脚本的 status 输出只进日志文件，需靠 PID 文件判断存活）
 * @description web 走 web/.runtime/web.pid，缺失时回退 scripts/web.pid 兼容历史部署
 */
const PID_READER_MAP: Record<ServiceTarget, () => number | null> = {
  web: () => readPidFile(PID_FILE, LEGACY_PID_FILE),
  daemon: () => readPidFile(path.join(PROJECT_DIR, 'scripts', 'reminder_daemon.pid')),
};

/** 脚本输出回传长度（字符），避免超长日志炸上下文 */
const OUTPUT_TAIL_LEN = 1500;

/** Launcher（3001）地址：重启 Web 服务必须借道它，否则 9527 属于自杀 */
const LAUNCHER_BASE_URL = 'http://127.0.0.1:3001';

/**
 * AI 触发重启时的延迟（毫秒）
 * @description 给本轮「说完结论 + 会话落盘 + 回 done」留出时间。
 *              会话落盘发生在流正常结束时（routes/ai-chat.ts 的 final_messages），
 *              若 9527 在回答写完前被杀，这一轮问答（含用户消息）会直接丢失。
 */
const AI_RESTART_DELAY_MS = 8000;

/**
 * 借道 launcher 异步重启 Web 服务（立即返回，由 launcher 延迟执行）
 * @returns {Promise<{ ok: boolean; message: string }>} 指令是否发出成功
 */
const restartWebViaLauncher = async (): Promise<{ ok: boolean; message: string }> => {
  try {
    const resp = await fetch(`${LAUNCHER_BASE_URL}/api/launcher/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delay_ms: AI_RESTART_DELAY_MS }),
    });
    const text = await resp.text();
    return { ok: resp.ok, message: text.slice(0, 200) };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
};

/**
 * 探测服务进程是否存活（读 PID 文件 + kill -0 探活）
 * @param {ServiceTarget} target - 目标服务
 * @returns {{ alive: boolean; pid: number }} 存活状态与 PID
 */
const probeAlive = (target: ServiceTarget): { alive: boolean; pid: number } => {
  try {
    const pid = PID_READER_MAP[target]() ?? 0;
    if (!Number.isInteger(pid) || pid <= 0) return { alive: false, pid: 0 };
    process.kill(pid, 0);
    return { alive: true, pid };
  } catch {
    return { alive: false, pid: 0 };
  }
};

/**
 * manage_service 工具实现
 * @description 启停 / 重启 Web 服务与提醒守护进程，或查询它们的状态。
 *              status 为只读；start / stop / restart 属于副作用，必须带 user_consent_phrase，
 *              并持有对应的 :edit 权限码——双重护栏，避免 AI 擅自重启生产服务。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "Web 服务现在跑着吗"                 → { target: 'web', action: 'status' }
 *   - "帮我把 Web 服务重启一下"             → { target: 'web', action: 'restart', user_consent_phrase: '帮我把 Web 服务重启一下' }
 *   - "守护进程停掉"                        → { target: 'daemon', action: 'stop', user_consent_phrase: '守护进程停掉' }
 */
export const manageServiceTool: ToolImpl = {
  name: 'manage_service',
  description:
    '启停 / 重启 Web 服务（9527）与提醒守护进程，或查询运行状态。'
    + 'action=status 为只读；start / stop / restart 需 user_consent_phrase（摘录用户原话，禁止编造）与对应权限。'
    + 'restart web 借道 launcher 延迟约 8 秒执行，回答先说完，之后刷新页面即可；'
    + 'stop web 会连 launcher（3001）一起停，之后无法再用本工具拉起，须用户手动启动，务必确认意图。'
    + '只看状态用 query_service_status / query_system_status；排障顺序见 ops-troubleshoot 技能。',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: ['web', 'daemon'],
        description: 'web = Web 服务（9527，承载 AI 对话后端）；daemon = 提醒守护进程 + 年度调度器',
      },
      action: {
        type: 'string',
        enum: ['status', 'start', 'stop', 'restart'],
        description: '默认 status（只读）',
      },
      user_consent_phrase: {
        type: 'string',
        description: 'start / stop / restart 必填：摘录用户原话中能体现该意图的短语',
      },
    },
    required: ['target', 'action'],
  },
  requiredPermissions: ['web-service:view', 'daemon:view'],
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const target = typeof args.target === 'string' ? args.target : '';
    const action = typeof args.action === 'string' ? args.action : 'status';
    if (target !== 'web' && target !== 'daemon') {
      return { ok: false, data: 'target 必须是 web 或 daemon' };
    }
    if (!['start', 'stop', 'restart', 'status'].includes(action)) {
      return { ok: false, data: `不支持的 action：${action}` };
    }

    const permissions = ctx.userPermissions ?? [];
    const isReadonly = action === 'status';
    const needPermission = isReadonly ? VIEW_PERMISSION_MAP[target] : EDIT_PERMISSION_MAP[target];
    if (!permissions.includes(needPermission)) {
      return {
        ok: false,
        data: `无权限${isReadonly ? '查看' : '操作'}${TARGET_LABEL[target]}（需 ${needPermission}）`,
      };
    }

    // 副作用动作：要求 LLM 如实摘录用户意图短语
    if (!isReadonly) {
      const consent = checkConsent(String(args.user_consent_phrase ?? ''), 'exec');
      if (!consent.ok) {
        return { ok: false, data: consent.reason };
      }
    }

    // Web 服务重启必须借道 launcher（3001 独立进程）异步执行：
    // 在 9527 进程内同步 kill 自己会立刻掐断当前 SSE 流，本轮问答来不及落盘就丢了
    if (target === 'web' && action === 'restart') {
      const sent = await restartWebViaLauncher();
      if (sent.ok) {
        const probe = probeAlive(target);
        return {
          ok: true,
          data: {
            target,
            action,
            scheduled: true,
            delay_ms: AI_RESTART_DELAY_MS,
            pid: probe.pid,
            launcher_response: sent.message,
          },
          summary: `Web 服务重启指令已发送，约 ${AI_RESTART_DELAY_MS / 1000} 秒后执行（当前 PID ${probe.pid}）；本轮回答会先完成并保存，之后刷新页面即可`,
        };
      }
      // launcher 不可用时回退同步重启：会中断本轮会话，如实说明
      const fallback = await runScript(SCRIPT_MAP[target], [action]).catch((err: Error) => err);
      if (fallback instanceof Error) {
        return {
          ok: false,
          data: `launcher 不可用（${sent.message}），且同步重启失败：${fallback.message}`,
        };
      }
      return {
        ok: true,
        data: {
          target,
          action,
          scheduled: false,
          warning: `launcher 不可用（${sent.message}），已同步重启，本轮会话可能中断丢失`,
          stdout: (fallback.stdout ?? '').trim().slice(-OUTPUT_TAIL_LEN),
        },
        summary: 'Web 服务已同步重启（launcher 不可用，本轮会话可能中断）',
      };
    }

    let result: { stdout: string; stderr: string };
    try {
      result = await runScript(SCRIPT_MAP[target], [action]);
    } catch (err) {
      return { ok: false, data: `${TARGET_LABEL[target]} ${action} 执行失败：${(err as Error).message}` };
    }

    const stdout = (result.stdout ?? '').trim();
    const stderr = (result.stderr ?? '').trim();
    // 管理脚本的输出基本都走 log_utils（只进日志文件），stdout 常为空，用 stderr 兜底
    const output = (stdout || stderr).slice(-OUTPUT_TAIL_LEN);
    const probe = probeAlive(target);

    return {
      ok: true,
      data: {
        target,
        action,
        alive: probe.alive,
        pid: probe.pid,
        output,
        note: output ? undefined : '管理脚本 stdout 为空属正常；运行日志已写入 hp_run_logs，可在日志查看页检索',
      },
      summary: isReadonly
        ? `${TARGET_LABEL[target]}：${probe.alive ? `运行中（PID ${probe.pid}）` : '未运行'}${output ? `；${output}` : ''}`
        : `${TARGET_LABEL[target]} 已执行 ${action}；当前${probe.alive ? `运行中（PID ${probe.pid}）` : '未运行'}`,
    };
  },
};
