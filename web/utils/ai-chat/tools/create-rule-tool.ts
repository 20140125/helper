import { randomUUID } from 'crypto';
import { readRules, writeRules } from '@/utils/storage';
import { VALID_TYPES, VALID_OUTPUT_MODES, type Rule } from '@/types/rule';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 预览有效期（毫秒）：10 分钟，避免隔天拿旧 token 建规则 */
const PREVIEW_TTL_MS = 10 * 60 * 1000;

/** 预览中保存的规则字段，与最终写入的字段一一对应 */
type RuleFields = Pick<Rule, 'name' | 'type' | 'condition' | 'time' | 'message' | 'template_id' | 'output_mode' | 'enabled'>;

/** 一条待确认的规则预览 */
interface RulePreview {
  /** 规范化后的规则字段 */
  fields: RuleFields;
  /** 预览发起人邮箱（防止他人冒用 token） */
  user: string;
  /** 过期时间戳（ms） */
  expiresAt: number;
}

/** 进程内预览表：重启即失效，不落盘存储 */
const previews = new Map<string, RulePreview>();

/** 字段校验结果 */
type NormalizeResult = { ok: true; fields: RuleFields } | { ok: false; reason: string };

/**
 * 校验并规范化规则字段（预览与写入共用同一套口径）
 * @param args - LLM 传入的原始参数
 * @returns 规范化字段或错误描述
 */
const normalizeRuleFields = (args: Record<string, unknown>): NormalizeResult => {
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

  if (!name) return { ok: false, reason: 'name 不能为空' };
  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return { ok: false, reason: `type 必须是以下之一：${VALID_TYPES.join(' / ')}` };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { ok: false, reason: 'time 必须是 HH:mm 24 小时制（如 09:30）' };
  }
  const noConditionTypes = ['daily', 'workday'];
  if (!noConditionTypes.includes(type) && !condition) {
    return { ok: false, reason: `${type} 类型必须提供 condition` };
  }
  if (!message && !templateId) {
    return { ok: false, reason: 'message 与 template_id 至少提供一个' };
  }

  return {
    ok: true,
    fields: {
      name,
      type,
      condition,
      time,
      message,
      template_id: templateId || undefined,
      output_mode: outputMode,
      enabled: args.enabled === undefined ? true : Boolean(args.enabled),
    },
  };
};

/**
 * 把规则字段渲染成用户可读的预览文本
 * @param fields - 规范化后的规则字段
 * @returns 多行预览文本
 */
const formatPreview = (fields: RuleFields): string => {
  const typeNames: Record<string, string> = {
    daily: '每天',
    workday: '每个工作日',
    weekday: '每周',
    monthly: '每月',
    date: '每年',
    lunar_date: '农历',
    countdown: '倒计时',
  };
  const when = `${typeNames[fields.type] ?? fields.type}${fields.condition ? ` ${fields.condition}` : ''} ${fields.time}`;
  const content = fields.template_id ? `使用模板：${fields.template_id}` : `提醒文案：${fields.message}`;
  return `规则名：${fields.name}\n触发：${when}\n${content}\n输出：${fields.output_mode}，状态：${fields.enabled ? '启用' : '停用'}`;
};

/**
 * create_rule 工具实现（写能力，两阶段确认）
 * @description 把用户口头描述的提醒固化成一条自定义规则。
 *   自然语言建规则必须走「preview=true 展示解析 → 用户确认 → 带 preview_token 正式写入」两步，
 *   避免模型把时间/类型解析错时直接落库；严格模式下正式写入仍会按既有审批机制建单。
 *   之所以先开放这个写工具：规则有明确的字段校验与既有页面兜底（Web 上能改能删），
 *   写错代价可控；配置写错会让整个系统起不来，暂不放开。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "每周五 17:30 提醒我写周报" → 先 { preview: true, name: '周报提醒', type: 'weekday', condition: '5', time: '17:30', message: '该写周报了' }
 *   - "确认，就按这个建"           → 再带 preview_token + 完全相同的字段正式写入
 */
export const createRuleTool: ToolImpl = {
  name: 'create_rule',
  description:
    '新增一条自定义提醒规则并立即生效。必填 name / type / time，message 与 template_id 至少给一个。'
    + '\n【两步确认】用户用自然语言描述要新建提醒时，必须先以 preview=true 调用本工具只做解析（不写入），'
    + '把返回的 preview 原文展示给用户并询问是否确认；用户确认后，再用完全相同的字段并带上 preview_token 正式写入。'
    + '不要跳过预览直接写入（除非用户明确说"直接建 / 不用确认"）。'
    + '\n【定时推送 ≠ 立即推送】建完即止，禁止再调 send_wecom_message 补发一条。'
    + '\n字段口径（type×condition 搭配、template_id 清单、占位符与排版限制）加载 reminder-rules 技能后再调。',
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
      preview: { type: 'boolean', description: 'true=只解析并展示预览，不写入；用户确认后带 preview_token 再正式创建' },
      preview_token: { type: 'string', description: '上一轮 preview=true 返回的 token，确认时原样带回；字段须与预览完全一致' },
    },
    required: ['name', 'type', 'time'],
  },
  examples: [
    {
      user: '每周五 17:30 提醒我写周报',
      args: { preview: true, name: '周报提醒', type: 'weekday', condition: '5', time: '17:30', message: '该写周报了' },
    },
    {
      user: '确认，就按这个建',
      args: { preview_token: '<上一步返回的 preview_token>', name: '周报提醒', type: 'weekday', condition: '5', time: '17:30', message: '该写周报了' },
    },
  ],
  requiredPermissions: ['rules:edit'],
  invoke: async (args, ctx): Promise<ToolResult> => {
    const normalized = normalizeRuleFields(args);
    if (!normalized.ok) return { ok: false, data: normalized.reason };
    const fields = normalized.fields;

    // 预览模式：只解析、只展示，不写盘、不建审批单
    if (args.preview === true || args.preview === 'true') {
      const now = Date.now();
      for (const [key, item] of previews) {
        if (item.expiresAt <= now) previews.delete(key);
      }
      const token = randomUUID();
      previews.set(token, { fields, user: ctx.userEmail, expiresAt: now + PREVIEW_TTL_MS });
      return {
        ok: true,
        data: {
          preview_token: token,
          preview: formatPreview(fields),
          parsed: fields,
          hint: '把 preview 原文展示给用户确认；确认后用同样的字段并带上 preview_token 再次调用本工具正式创建。',
        },
        summary: '已生成规则解析预览，等待用户确认',
      };
    }

    // 确认模式：一次性 token 校验字段一致性与归属，防止确认时偷偷改内容
    const token = typeof args.preview_token === 'string' ? args.preview_token.trim() : '';
    if (token) {
      const preview = previews.get(token);
      if (!preview) {
        return { ok: false, data: 'preview_token 无效或已使用，请重新以 preview=true 生成预览' };
      }
      if (preview.expiresAt <= Date.now()) {
        previews.delete(token);
        return { ok: false, data: '预览已过期（10 分钟），请重新生成后再确认' };
      }
      if (preview.user !== ctx.userEmail) {
        return { ok: false, data: '该预览属于其他用户，不能冒用确认' };
      }
      if (JSON.stringify(preview.fields) !== JSON.stringify(fields)) {
        return {
          ok: false,
          data: `确认内容与预览不一致，已拒绝写入。\n预览：\n${formatPreview(preview.fields)}\n本次：\n${formatPreview(fields)}`,
        };
      }
      previews.delete(token);
    }

    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const rules = await readRules();
    const rule: Rule = {
      id: `rule_${Date.now()}`,
      name: fields.name,
      type: fields.type,
      condition: fields.condition,
      time: fields.time,
      message: fields.message,
      template_id: fields.template_id || undefined,
      enabled: fields.enabled,
      webhookIds: [],
      created_at: stamp,
      updated_at: stamp,
      custom_content: Boolean(fields.message),
      output_mode: fields.output_mode,
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
