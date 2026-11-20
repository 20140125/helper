import { notifyAllWebhooks } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import { checkConsent } from './_consent-guard';

/**
 * send_wecom_message 工具实现
 * @description 把【已经存在的】查询结果或对话内容推送到企业微信群（webhook 机器人）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把刚才的查询结果发到群里"                        → { content: '## 今日规则触发情况\n- ...', user_consent_phrase: '发到群里' }
 *   - "提醒一下大家明天放假"                            → { content: '📢 明天为节假日', user_consent_phrase: '提醒一下大家' } // 仅当含"通知/告诉大家"等词才有效
 */
export const sendWecomMessageTool: ToolImpl = {
  name: 'send_wecom_message',
  description:
    '把【已有的】查询结果或对话内容【立即】推送到企微群，需 user_consent_phrase（摘录用户原话，禁止编造）。'
    + '「查看 / 有没有」类查询禁止调用本工具，改用查询工具。'
    + '【定时 / 每天 / 某时刻推送】禁止用本工具，只能用 create_rule 建规则，建完不要补发。'
    + 'content 必须来自上游工具返回或用户原文，禁止自造。'
    + '推送规范与企微排版限制见 wecom-push 技能。',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '推送内容（Markdown），须来自上游工具返回或用户原文',
      },
      user_consent_phrase: {
        type: 'string',
        description: '从用户原话中摘录、能体现推送意图的短语，禁止编造',
      },
    },
    required: ['content', 'user_consent_phrase'],
  },
  requiredPermissions: ['webhook:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const rawContent = typeof args.content === 'string' ? args.content.trim() : '';
    // 模型偶尔会把换行双重转义成字面 \n 存进参数，推送前还原为真实换行
    const content = rawContent.replace(/\\r\\n|\\n/g, '\n').trim();
    if (!content) {
      return { ok: false, data: 'content 不能为空' };
    }
    const phrase = typeof args.user_consent_phrase === 'string' ? args.user_consent_phrase : '';
    const consent = checkConsent(phrase, 'push');
    if (!consent.ok) {
      return { ok: false, data: consent.reason };
    }
    try {
      const allOk = await notifyAllWebhooks(content);
      return {
        ok: allOk,
        data: { all_success: allOk },
        summary: allOk ? '已推送到全部已配置的机器人' : '部分机器人推送失败',
      };
    } catch (err) {
      return { ok: false, data: `推送失败：${(err as Error).message}` };
    }
  },
};
