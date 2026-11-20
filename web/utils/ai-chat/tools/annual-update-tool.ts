import { UPDATE_TOOLS_SCRIPTS } from '@/types/update-tools';
import type { UpdateToolScript } from '@/types/update-tools';
import { SCRIPT_META_MAP } from '@/types/trigger';
import { Permission } from '@/types/permission';
import {
  runScript,
  validateRequiredArgs,
  buildFinalArgs,
  execUpdateScript,
  resolveUpdateScriptPath,
  updateScriptExists,
} from '@/routes/utils';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';
import { checkConsent } from './_consent-guard';

/**
 * 年度数据更新主脚本在 SCRIPT_METAS 中的 key
 * @description 主脚本与 update-tools 下的子工具走同一入口，靠这个 key 区分
 */
const ANNUAL_UPDATE_SCRIPT_KEY = 'annual_update';

/** stdout/stderr 截断长度（字符），与 triggerScriptTool 对齐，防止上下文爆炸 */
const OUTPUT_TAIL_LEN = 2000;

/**
 * 列出可用的年度更新脚本（主脚本 + update-tools 子工具）
 * @returns {ToolResult} 工具清单（key / 中文名 / 脚本路径 / 参数说明）
 * @description 只读，不执行任何脚本
 */
const buildToolListResult = (): ToolResult => {
  const main = SCRIPT_META_MAP.get(ANNUAL_UPDATE_SCRIPT_KEY);
  const tools = [
    ...(main
      ? [{
        key: ANNUAL_UPDATE_SCRIPT_KEY,
        label: '年度数据更新（主脚本）',
        filename: main.scriptName,
        params: [] as Array<{ name: string; label: string; required: boolean }>,
      }]
      : []),
    ...Object.entries(UPDATE_TOOLS_SCRIPTS).map(([key, info]) => ({
      key,
      label: info.label,
      filename: info.filename,
      params: info.params.map((p) => ({ name: p.name, label: p.label, required: p.required })),
    })),
  ];
  return {
    ok: true,
    data: { tools, total: tools.length },
    summary: `可用年度更新工具 ${tools.length} 个，请用 tool 指定`,
  };
};

/**
 * 执行 update-tools 下的子工具
 * @param {string} key - 工具 key
 * @param {UpdateToolScript} toolInfo - 工具配置（参数定义 / autoArgs）
 * @param {string[]} strArgs - 用户传入的位置参数（按 params 顺序）
 * @returns {Promise<ToolResult>} 执行结果（stdout/stderr 尾部截断）
 * @description 与 web/routes/update-tools.ts 保持同一套校验与参数构建逻辑：
 *              必填校验 → autoArgs 注入年份与路径 → 脚本存在性检查 → 执行
 */
const runUpdateTool = async (
  key: string,
  toolInfo: UpdateToolScript,
  strArgs: string[],
): Promise<ToolResult> => {
  const missing = validateRequiredArgs(toolInfo.params, strArgs);
  if (missing) {
    return { ok: false, data: `${key} 缺少必填参数：${missing}` };
  }
  const scriptPath = resolveUpdateScriptPath(toolInfo);
  if (!updateScriptExists(scriptPath)) {
    return { ok: false, data: `脚本不存在：${toolInfo.filename}` };
  }
  try {
    const result = await execUpdateScript(scriptPath, buildFinalArgs(toolInfo, strArgs));
    return {
      ok: true,
      data: {
        tool: key,
        stdout: result.stdout?.slice(-OUTPUT_TAIL_LEN) ?? '',
        stderr: result.stderr?.slice(-OUTPUT_TAIL_LEN) ?? '',
      },
      summary: `${toolInfo.label} 执行完成`,
    };
  } catch (err) {
    return { ok: false, data: `执行异常：${(err as Error).message}` };
  }
};

/**
 * 执行年度数据更新主脚本（scripts/annual_update.sh）
 * @param {string} scriptPath - 脚本相对路径
 * @param {string[]} args - 脚本默认参数
 * @returns {Promise<ToolResult>} 执行结果
 */
const runAnnualUpdateScript = async (scriptPath: string, args: string[]): Promise<ToolResult> => {
  try {
    const result = await runScript(scriptPath, args);
    return {
      ok: true,
      data: {
        tool: ANNUAL_UPDATE_SCRIPT_KEY,
        stdout: result.stdout?.slice(-OUTPUT_TAIL_LEN) ?? '',
        stderr: result.stderr?.slice(-OUTPUT_TAIL_LEN) ?? '',
      },
      summary: `年度数据更新主脚本执行完成`,
    };
  } catch (err) {
    return { ok: false, data: `执行异常：${(err as Error).message}` };
  }
};

/**
 * annual_update 工具实现
 * @description 执行「年度数据更新」相关脚本（一年只用一两次，Web 上对应手动触发页的年度更新卡片）：
 *               主脚本 scripts/annual_update.sh，以及 scripts/update-tools/ 下的 4 个子工具
 *               （拉取节假日数据 / 生成节假日配置 / 更新月份配置 / 发送更新通知）。
 *               不传 tool 时只返回清单，不执行任何脚本。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "年度更新都能跑哪些工具？"                        → {}
 *   - "把明年的节假日数据拉下来"                        → { tool: 'get_holidays', user_consent_phrase: '把节假日数据拉下来' }
 *   - "生成一下明年的节假日配置"                        → { tool: 'generate_holiday_config', args: ['2027-01-02'], user_consent_phrase: '生成节假日配置' }
 *   - "发一下年度更新通知"                              → { tool: 'send_update_notification', args: ['✅ 成功', '', '✅ 成功'], user_consent_phrase: '发一下年度更新通知' }
 */
export const annualUpdateTool: ToolImpl = {
  name: 'annual_update',
  description:
    '执行「年度数据更新」脚本（跨年维护专用，平时不要调用）；不传 tool 只返回清单。'
    + 'tool：annual_update（主脚本，无参数）/ get_holidays / generate_holiday_config（args[0]=特别假日期）'
    + '/ update_month_config / send_update_notification（args=[holiday_status, special_holiday, month_status]，'
    + '状态只能填「✅ 成功」或「❌ 失败」）。'
    + 'args 按声明顺序传，多日期用英文逗号连接成一个字符串；年份由系统取当前年，不要传。',
  parameters: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        description: '工具 key，不传则返回清单；取值见描述',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: '按该工具 params 顺序传入的参数；无参数工具不要传',
      },
      user_consent_phrase: {
        type: 'string',
        description: '从用户原话中摘录、能体现执行意图的短语，禁止编造',
      },
    },
  },
  requiredPermissions: [Permission.TRIGGER_ANNUAL_UPDATE_VIEW],
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const toolKey = typeof args.tool === 'string' ? args.tool.trim() : '';
    // list 模式（不传 tool）无副作用，只读清单，view 权限即可
    if (!toolKey) {
      return buildToolListResult();
    }
    // 执行模式有副作用，必须持有年度更新的 edit 权限
    if (!(ctx.userPermissions ?? []).includes(Permission.TRIGGER_ANNUAL_UPDATE_EDIT)) {
      return {
        ok: false,
        data: `当前用户无权限执行年度更新脚本（需 ${Permission.TRIGGER_ANNUAL_UPDATE_EDIT}）`,
      };
    }
    const phrase = typeof args.user_consent_phrase === 'string' ? args.user_consent_phrase : '';
    const consent = checkConsent(phrase, 'exec');
    if (!consent.ok) {
      return { ok: false, data: consent.reason };
    }

    if (toolKey === ANNUAL_UPDATE_SCRIPT_KEY) {
      const meta = SCRIPT_META_MAP.get(ANNUAL_UPDATE_SCRIPT_KEY);
      if (!meta) {
        return { ok: false, data: `脚本未注册：${ANNUAL_UPDATE_SCRIPT_KEY}` };
      }
      return runAnnualUpdateScript(meta.scriptPath, meta.args ?? []);
    }

    const toolInfo = UPDATE_TOOLS_SCRIPTS[toolKey];
    if (!toolInfo) {
      return {
        ok: false,
        data: `未知 tool=${toolKey}。可用：${ANNUAL_UPDATE_SCRIPT_KEY}、${Object.keys(UPDATE_TOOLS_SCRIPTS).join(', ')}`,
      };
    }
    const rawArgs = Array.isArray(args.args) ? args.args : [];
    const strArgs = rawArgs.map((a) => (typeof a === 'string' ? a : String(a ?? '')));
    return runUpdateTool(toolKey, toolInfo, strArgs);
  },
};
