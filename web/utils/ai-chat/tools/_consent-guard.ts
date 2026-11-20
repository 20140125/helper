/**
 * 副作用类工具的"用户显式意图"校验
 * @description 防止 LLM 在用户未明确请求时擅自触发副作用（推送、执行脚本等）。
 *              校验策略为「按语义意图，不按关键词」：不再要求原话出现特定动词（那会误伤
 *              "抖音热搜""生日提醒发一下"这类自然表达），只要求 LLM 如实摘录用户原话短语，
 *              意图判断交给 system prompt 的软约束 + 权限码的硬约束。
 * @rationale 关键词白名单会随表达方式变化而漏判/误判，维护成本高且伤害查询体验；
 *              真正的硬保障是工具层权限校验（webhook:edit / trigger:*:edit）。
 */

/** 意图短语的最大长度（字符），超出视为 LLM 编造整段话而非摘录 */
const CONSENT_PHRASE_MAX_LEN = 100;

/**
 * 校验类型
 */
export type ConsentKind = 'push' | 'exec';

/**
 * 校验 LLM 摘录的用户意图短语
 * @param {string} phrase LLM 摘录的用户原话短语（user_consent_phrase）
 * @param {ConsentKind} kind 校验类型（仅用于拦截提示文案，不再做关键词匹配）
 * @returns {{ ok: true } | { ok: false; reason: string }} 校验结果
 */
export const checkConsent = (
  phrase: string,
  // 保留签名以兼容既有调用方；当前实现不再按 kind 做关键词匹配，故前缀 _
  _kind: ConsentKind,
): { ok: true } | { ok: false; reason: string } => {
  const text = (phrase ?? '').trim();
  if (!text) {
    return {
      ok: false,
      reason: 'user_consent_phrase 缺失：必须从用户原话中摘录能体现该意图的短语，禁止编造',
    };
  }
  if (text.length > CONSENT_PHRASE_MAX_LEN) {
    return {
      ok: false,
      reason: `user_consent_phrase 应为原话短句摘录（≤${CONSENT_PHRASE_MAX_LEN} 字），当前 ${text.length} 字，疑似编造`,
    };
  }
  return { ok: true };
};
