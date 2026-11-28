import { Router } from 'express';
import { readRules, writeRules, runScript, formatDate, returnResponse, ErrorCode } from './utils';
import { Rule, CreateRuleBody, VALID_TYPES, VALID_OUTPUT_MODES } from '@/types/rule';

const router = Router();

/**
 * 获取所有自定义规则列表
 * @route GET /rules
 * @returns {{ ok: boolean, rules: Rule[] }} 规则列表
 */
router.get('/', async (_req, res) => {
  return returnResponse(res, ErrorCode.SUCCESS, { rules: await readRules() }, 'success');
});

/**
 * 创建新的自定义规则
 * @route POST /rules
 * @param {CreateRuleBody} req.body - 规则创建参数
 * @returns {{ ok: boolean, rule: Rule }} 创建成功的规则对象
 */
router.post('/', async (req, res) => {
  const {
    name,
    type,
    condition,
    time,
    message,
    template_id,
    custom_content,
    enabled,
    webhookIds,
    output_mode,
  } = req.body as CreateRuleBody;
  if (!name || !type) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：name, type');
  }
  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `type 必须是以下之一: ${VALID_TYPES.join(', ')}`);
  }
  // 内容与模板二选一：自定义内容模式用 message；否则用 template_id
  const useCustom = custom_content === true;
  if (useCustom) {
    if (!message) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：message（已开启自定义内容）');
    }
  } else if (!template_id) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：template_id（未开启自定义内容时需选择模板）');
  }
  // daily / workday 类型无需 condition，其他类型必填
  const noConditionTypes = ['daily', 'workday'];
  if (!noConditionTypes.includes(type) && !condition) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：condition');
  }

  const rules = await readRules();
  const newRule: Rule = {
    id: `rule_${Date.now()}`,
    name,
    type,
    condition: condition ?? '',
    time: time ?? '09:00',
    message: useCustom ? (message ?? '') : '',
    template_id: useCustom ? '' : (template_id ?? ''),
    custom_content: useCustom,
    enabled: enabled !== false,
    webhookIds: webhookIds ?? [],
    created_at: formatDate(),
    updated_at: formatDate(),
    lastTriggeredAt: '',
    // 卡片技能默认发数据文本；非法值一律回落 text
    output_mode: VALID_OUTPUT_MODES.includes(output_mode as typeof VALID_OUTPUT_MODES[number])
      ? (output_mode as typeof VALID_OUTPUT_MODES[number])
      : 'text',
  };
  rules.push(newRule);
  writeRules(rules);
  return returnResponse(res, ErrorCode.SUCCESS, { rule: newRule }, 'success');
});

/**
 * 批量更新规则显示顺序
 * @route PUT /rules/order
 * @param {string[]} req.body.ids - 按目标顺序排列的规则 ID 列表
 * @returns {{ ok: boolean, rules: Rule[] }} 重排后的完整规则列表
 * @description 拖拽排序后整体持久化（存储为数组，顺序即展示顺序）；
 *              必须注册在 PUT /:id 之前，否则 order 会被当作规则 ID；
 *              未出现在 ids 中的规则（并发新增）追加到末尾，绝不丢弃
 */
router.put('/order', async (req, res) => {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'ids 必须是字符串数组');
  }
  const rules = await readRules();
  const remaining = new Map(rules.map((rule) => [rule.id, rule] as const));
  const ordered: Rule[] = [];
  for (const id of ids as string[]) {
    const rule = remaining.get(id);
    if (rule) {
      ordered.push(rule);
      remaining.delete(id);
    }
  }
  ordered.push(...remaining.values());
  writeRules(ordered);
  return returnResponse(res, ErrorCode.SUCCESS, { rules: ordered }, 'success');
});

/**
 * 更新指定规则
 * @route PUT /rules/:id
 * @param {string} req.params.id - 规则 ID
 * @param {Partial<Rule>} req.body - 需要更新的规则字段
 * @returns {{ ok: boolean, rule: Rule }} 更新后的规则对象
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const rules = await readRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '规则不存在');
  }
  const body = req.body as Partial<Rule>;
  // 自定义内容模式与模板互斥：开启时清空 template_id，否则清空 message
  if (body.custom_content) {
    body.template_id = '';
  } else {
    body.message = '';
  }
  const updated: Rule = {
    ...rules[idx],
    ...body,
    id,
    updated_at: formatDate(),
  };
  rules[idx] = updated;
  writeRules(rules);
  return returnResponse(res, ErrorCode.SUCCESS, { rule: updated }, 'success');
});

/**
 * 删除指定规则
 * @route DELETE /rules/:id
 * @param {string} req.params.id - 规则 ID
 * @returns {{ ok: boolean, message: string }} 删除结果
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const rules = await readRules();
  const filtered = rules.filter((r) => r.id !== id);
  if (filtered.length === rules.length) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '规则不存在');
  }
  writeRules(filtered);
  return returnResponse(res, ErrorCode.SUCCESS, {}, '规则已删除');
});

/**
 * 立即测试执行指定规则
 * @route POST /rules/:id/test
 * @param {string} req.params.id - 规则 ID
 * @returns {{ ok: boolean, stdout: string, stderr: string }} 脚本执行结果
 */
router.post('/:id/test', async (req, res) => {
  const { id } = req.params;
  const rules = await readRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '规则不存在');
  }
  try {
    const result = await runScript('scripts/custom_rules.sh', ['test', id]);
    return returnResponse(res, ErrorCode.SUCCESS, { stdout: result.stdout, stderr: result.stderr }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);
  }
});

export default router;
