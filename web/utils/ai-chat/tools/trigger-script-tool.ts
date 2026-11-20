import path from 'path';
import fs from 'fs';
import { PROJECT_DIR, runScript } from '@/routes/utils';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';
import { checkConsent } from './_consent-guard';

/**
 * trigger_script 工具实现
 * @description 执行项目内的提醒脚本（位于 scripts/ 目录），用于手动触发提醒任务。仅允许执行 .sh 脚本，且名字限合法字符。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "现在跑一下生日提醒脚本"                         → { script_name: 'birthday_reminder.sh', user_consent_phrase: '跑一下' }
 *   - "手动触发一下每日提醒"                            → { script_name: 'daily_reminder.sh', user_consent_phrase: '手动触发' }
 */
export const triggerScriptTool: ToolImpl = {
  name: 'trigger_script',
  description:
    '执行 scripts/（含 scripts/tools/）下的 .sh 脚本（仅允许字母数字下划线命名）。'
    + '按用户语义意图判断：用户明确要求执行某项任务（如"生日提醒发一下""跑下每周总结"）即可调用，不要求特定动词；'
    + '纯查询/查看意图不要调用本工具。'
    + '注意：热搜/天气/行情/黄历等"卡片技能"优先用 card_skill（能传参数、返回卡片图），本工具只做兜底执行。',
  parameters: {
    type: 'object',
    properties: {
      script_name: {
        type: 'string',
        description: '脚本名（不含路径，如 birthday_reminder.sh）',
      },
      user_consent_phrase: {
        type: 'string',
        description: '从用户原话中摘录、能体现执行意图的短语，禁止编造',
      },
    },
    required: ['script_name', 'user_consent_phrase'],
  },
  requiredPermissions: ['trigger:view'],
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const scriptName = typeof args.script_name === 'string' ? args.script_name : '';
    if (!scriptName || !/^[a-z0-9_]+\.sh$/i.test(scriptName)) {
      return { ok: false, data: 'script_name 必须是合法的 .sh 文件名（仅字母数字下划线）' };
    }
    const phrase = typeof args.user_consent_phrase === 'string' ? args.user_consent_phrase : '';
    const consent = checkConsent(phrase, 'exec');
    if (!consent.ok) {
      return { ok: false, data: consent.reason };
    }
    // 脚本可能位于 scripts/ 根目录（提醒类脚本）或 scripts/tools/（卡片技能脚本）
    const relScriptPath = ['scripts', path.join('scripts', 'tools')]
      .map((dir) => path.join(dir, scriptName))
      .find((rel) => fs.existsSync(path.join(PROJECT_DIR, rel)));
    if (!relScriptPath) {
      return {
        ok: false,
        data: `脚本不存在：scripts/${scriptName}、scripts/tools/${scriptName}；可用 list_scripts 查看提醒类脚本清单，卡片技能用 card_skill 查看`,
      };
    }
    // 鉴权：执行脚本需要任一 trigger:*:edit 权限（粗粒度，按权限模型约定）
    const hasEdit = ctx.userPermissions.some((p) => p.startsWith('trigger:') && p.endsWith(':edit'));
    if (!hasEdit) {
      return { ok: false, data: '当前用户无权限执行任何 trigger 脚本（需 trigger:*:edit）' };
    }
    try {
      const result = await runScript(relScriptPath, []);
      return {
        ok: true,
        data: {
          script: scriptName,
          stdout: result.stdout?.slice(-2000) ?? '',
          stderr: result.stderr?.slice(-2000) ?? '',
        },
        summary: `脚本 ${scriptName} 执行完成`,
      };
    } catch (err) {
      return { ok: false, data: `执行异常：${(err as Error).message}` };
    }
  },
};
