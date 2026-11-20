import { readRules, writeRules } from '@/utils/storage';
import { VALID_TYPES, VALID_OUTPUT_MODES, type Rule } from '@/types/rule';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * create_rule 工具实现（写能力）
 * @description 贾维斯的第一个「写」工具：把用户口头描述的提醒固化成一条自定义规则。
 *   之所以先开放它而不是配置/模板写入：规则有明确的字段校验与既有页面兜底（Web 上能改能删），
 *   写错了代价可控；配置写错会让整个系统起不来，暂不放开。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "每周五 17:30 提醒我写周报"      → { name: '周报提醒', type: 'weekday', condition: '5', time: '17:30', message: '该写周报了' }
 *   - "每天 9 点提醒我喝水"             → { name: '喝水提醒', type: 'daily', time: '09:00', message: '喝水时间到' }
 */
export const createRuleTool: ToolImpl = {
  name: 'create_rule',
  description:
    '新增一条自定义提醒规则并立即生效。必填 name / type / time，message 与 template_id 至少给一个；'
    + '用户只是问有哪些规则时用 query_rules，不要用本工具。'
    + '【定时推送 ≠ 立即推送】建完即止，禁止再调 send_wecom_message 补发一条。'
    + '字段口径（type×condition 搭配、template_id 清单、占位符与排版限制）加载 reminder-rules 技能后再调。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '规则名称（用户可见）' },
      type: {
        type: 'string',
        description: `规则类型：${VALID_TYPES.join(' / ')}`,
      },
      condition: {
        type: 'string',
        description: '触发条件（daily / workday 类型不填；weekday 填 1-7；date 填 MM-DD；monthly 填日号）',
      },
      time: { type: 'string', description: '触发时间 HH:mm（24 小时制，如 09:30）' },
      message: { type: 'string', description: '提醒内容（使用模板时可不填）' },
      template_id: { type: 'string', description: '消息模板 ID（与 message 二选一）' },
      output_mode: {
        type: 'string',
        description: '卡片技能的输出形态：text=数据文本（默认）/ card=图片卡片；用户明确要"图片/卡片"时才传 card',
      },
      enabled: { type: 'boolean', description: '是否立即启用（默认 true）' },
    },
    required: ['name', 'type', 'time'],
  },
  requiredPermissions: ['rules:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const name = typeof args.name === 'string' ? args.name.trim() : '';
    const type = typeof args.type === 'string' ? args.type.trim() : '';
    const time = typeof args.time === 'string' ? args.time.trim() : '';
    const condition = typeof args.condition === 'string' ? args.condition.trim() : '';
    // 模型偶尔会把换行双重转义成字面 \n，入库前还原为真实换行
    const message = typeof args.message === 'string' ? args.message.replace(/\\r\\n|\\n/g, '\n').trim() : '';
    const templateId = typeof args.template_id === 'string' ? args.template_id.trim() : '';
    const rawOutputMode = typeof args.output_mode === 'string' ? args.output_mode.trim() : '';
    const outputMode = VALID_OUTPUT_MODES.includes(rawOutputMode as typeof VALID_OUTPUT_MODES[number])
      ? (rawOutputMode as typeof VALID_OUTPUT_MODES[number])
      : 'text';

    if (!name) return { ok: false, data: 'name 不能为空' };
    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return { ok: false, data: `type 必须是以下之一：${VALID_TYPES.join(' / ')}` };
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return { ok: false, data: 'time 必须是 HH:mm 24 小时制（如 09:30）' };
    }
    const noConditionTypes = ['daily', 'workday'];
    if (!noConditionTypes.includes(type) && !condition) {
      return { ok: false, data: `${type} 类型必须提供 condition` };
    }
    if (!message && !templateId) {
      return { ok: false, data: 'message 与 template_id 至少提供一个' };
    }

    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const rules = readRules();
    const rule: Rule = {
      id: `rule_${Date.now()}`,
      name,
      type,
      condition,
      time,
      message,
      template_id: templateId || undefined,
      enabled: args.enabled === undefined ? true : Boolean(args.enabled),
      webhookIds: [],
      created_at: stamp,
      updated_at: stamp,
      custom_content: Boolean(message),
      output_mode: outputMode,
      lastTriggeredAt: '',
    };
    rules.push(rule);
    writeRules(rules);

    return {
      ok: true,
      data: { rule_id: rule.id, name: rule.name, time: rule.time, type: rule.type },
      summary: `已创建规则「${rule.name}」（${rule.time}，${rule.enabled ? '已启用' : '未启用'}）`,
    };
  },
};
