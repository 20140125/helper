import { readRules, writeRules } from '@/utils/storage';
import { VALID_TYPES, VALID_OUTPUT_MODES, type Rule } from '@/types/rule';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 可修改的字段白名单（id / 时间戳类字段不允许改） */
const UPDATABLE_FIELDS = ['name', 'type', 'condition', 'time', 'message', 'template_id', 'output_mode'] as const;

/**
 * 生成「YYYY-MM-DD HH:mm:ss」时间戳
 * @returns {string} 本地时间字符串
 * @description 与 create_rule 的入库格式保持一致，避免两处写法漂移
 */
const nowStamp = (): string => {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
    + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

/**
 * manage_rule 工具实现（规则写能力）
 * @description create_rule 只能新建，改/停用/删除此前只能去 Web 页面点。
 *   本工具补齐这三件事，并纳入副作用白名单——严格模式下会先建审批单，由超级管理员通过后生效。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把周报提醒改到 18:00"        → { action: 'update', rule_id: 'rule_xxx', time: '18:00' }
 *   - "先停掉喝水提醒"              → { action: 'toggle', rule_id: 'rule_xxx', enabled: false }
 *   - "删掉那条生日提醒"            → { action: 'delete', rule_id: 'rule_xxx' }
 */
export const manageRuleTool: ToolImpl = {
  name: 'manage_rule',
  description:
    '修改 / 停用启用 / 删除已有的自定义提醒规则。需要 rule_id：不确定时先 query_rules 查清单，不要用名称猜测。'
    + 'action：update（改字段，只传要改的）/ toggle（启用停用，enabled 不传则取反）/ delete（不可恢复）。'
    + '字段口径与陷阱（time 格式、condition 要求、删除前确认）加载 reminder-rules 技能后再调。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['update', 'toggle', 'delete'],
        description: '操作类型：update / toggle / delete',
      },
      rule_id: { type: 'string', description: '规则 ID（rule_xxx），先用 query_rules 查' },
      name: { type: 'string', description: '规则名称（update 时可选）' },
      type: { type: 'string', description: `规则类型（update 时可选）：${VALID_TYPES.join(' / ')}` },
      condition: { type: 'string', description: '触发条件（update 时可选）' },
      time: { type: 'string', description: '触发时间 HH:mm（update 时可选）' },
      message: { type: 'string', description: '提醒内容（update 时可选）' },
      template_id: { type: 'string', description: '消息模板 ID（update 时可选）' },
      output_mode: {
        type: 'string',
        description: `输出形态（update 时可选）：${VALID_OUTPUT_MODES.join(' / ')}`,
      },
      enabled: { type: 'boolean', description: '是否启用（toggle 时可选，不传则取反）' },
    },
    required: ['action', 'rule_id'],
  },
  requiredPermissions: ['rules:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const action = typeof args.action === 'string' ? args.action.trim() : '';
    const ruleId = typeof args.rule_id === 'string' ? args.rule_id.trim() : '';
    if (!ruleId) return { ok: false, data: 'rule_id 不能为空：先用 query_rules 查到规则 ID' };
    if (!['update', 'toggle', 'delete'].includes(action)) {
      return { ok: false, data: `action 必须是 update / toggle / delete，当前为 ${action || '空'}` };
    }

    const rules = await readRules();
    const idx = rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) {
      return { ok: false, data: `未找到规则 ${ruleId}：请用 query_rules 重新确认 ID` };
    }
    const target: Rule = rules[idx];

    // ── 删除 ──
    if (action === 'delete') {
      const rest = rules.filter((r) => r.id !== ruleId);
      writeRules(rest);
      return {
        ok: true,
        data: { rule_id: ruleId, name: target.name, deleted: true },
        summary: `已删除规则「${target.name}」（${target.time}）`,
      };
    }

    // ── 启用 / 停用 ──
    if (action === 'toggle') {
      const nextEnabled = typeof args.enabled === 'boolean' ? args.enabled : !target.enabled;
      const updated: Rule = { ...target, enabled: nextEnabled, updated_at: nowStamp() };
      rules[idx] = updated;
      writeRules(rules);
      return {
        ok: true,
        data: { rule_id: ruleId, name: updated.name, enabled: updated.enabled },
        summary: `规则「${updated.name}」已${updated.enabled ? '启用' : '停用'}`,
      };
    }

    // ── 改字段：只合并实际传了的白名单字段 ──
    const patch: Partial<Rule> = {};
    for (const field of UPDATABLE_FIELDS) {
      const raw = args[field];
      if (typeof raw !== 'string') continue;
      const value = raw.trim();
      if (!value) continue;
      patch[field] = value as never;
    }
    if (typeof args.enabled === 'boolean') patch.enabled = args.enabled;

    if (Object.keys(patch).length === 0) {
      return { ok: false, data: 'update 至少要传一个要改的字段（name / time / condition / message / template_id / output_mode / enabled）' };
    }
    if (patch.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) {
      return { ok: false, data: 'time 必须是 HH:mm 24 小时制（如 09:30）' };
    }
    if (patch.type && !VALID_TYPES.includes(patch.type as typeof VALID_TYPES[number])) {
      return { ok: false, data: `type 必须是以下之一：${VALID_TYPES.join(' / ')}` };
    }
    if (patch.output_mode && !VALID_OUTPUT_MODES.includes(patch.output_mode as typeof VALID_OUTPUT_MODES[number])) {
      return { ok: false, data: `output_mode 必须是以下之一：${VALID_OUTPUT_MODES.join(' / ')}` };
    }
    // type 与 condition 联动：改成了需要条件的类型却没给条件时，沿用原值兜底，不能静默留空
    const finalType = patch.type ?? target.type;
    const finalCondition = patch.condition ?? target.condition;
    if (!['daily', 'workday'].includes(finalType) && !finalCondition) {
      return { ok: false, data: `${finalType} 类型必须提供 condition（当前规则也没有历史 condition 可沿用）` };
    }

    const updated: Rule = {
      ...target,
      ...patch,
      custom_content: patch.message !== undefined ? true : target.custom_content,
      updated_at: nowStamp(),
    };
    rules[idx] = updated;
    writeRules(rules);

    return {
      ok: true,
      data: {
        rule_id: ruleId,
        name: updated.name,
        time: updated.time,
        type: updated.type,
        condition: updated.condition,
        enabled: updated.enabled,
        changed_fields: Object.keys(patch),
      },
      summary: `已更新规则「${updated.name}」：改了 ${Object.keys(patch).join('、')}`,
    };
  },
};
