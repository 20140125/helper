import { findSkillDoc, listSkillMetas } from '@/utils/ai-chat/skill-docs';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';

/** 技能正文返回上限（字符），防止长文档把上下文撑爆 */
const MAX_BODY_CHARS = 8000;

/**
 * load_skill 工具实现
 * @description 加载「md 技能」——一份写清「这件事该怎么查 / 怎么排」的 Markdown 说明书。
 *   平时提示词里只挂技能名与一句话说明，命中了才用它把全文取回来照着执行，
 *   避免把全部工具的用法一次塞进上下文（渐进式披露）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "都有哪几个技能可以用？"                         → {}
 *   - "系统里配了哪些规则"                              → { name: 'business-query' }
 *   - "9527 服务起不来了，帮我排查"                     → { name: 'ops-troubleshoot' }
 */
export const loadSkillTool: ToolImpl = {
  name: 'load_skill',
  description:
    '列出或加载「md 技能」说明书（SKILL.md）：问「有哪些技能 / 都有哪几个技能可以用」时用本工具；'
    + '不传 name 返回可用技能清单（名称 + 一句话说明）；'
    + '传 name 返回该技能的完整操作步骤，按文档里写的工具与顺序执行。'
    + '适用多步套路（业务查询汇总 / 排障 / 建规则 / 出卡片 / 推企微），单条查询不必加载。'
    + '与 card_skill 区分：card_skill 跑脚本取外部数据/出图，本工具只取回本地 Markdown，无副作用。',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '技能名（清单里的 name，如 business-query）；不传则返回技能清单',
      },
    },
  },
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const permissions = ctx.userPermissions ?? [];
    const allowedEffects = ctx.allowedSkillEffects ?? [];
    const isEffectAllowed = (effect: string): boolean =>
      allowedEffects.length === 0 || allowedEffects.includes(effect as never);

    // 清单模式：只列该用户有权、且本轮场景允许加载的技能
    const rawName = typeof args.name === 'string' ? args.name.trim() : '';
    if (!rawName) {
      const metas = listSkillMetas(permissions).filter((m) => isEffectAllowed(m.effect));
      if (metas.length === 0) {
        return { ok: true, data: { skills: [], total: 0 }, summary: '当前没有可用的 md 技能' };
      }
      return {
        ok: true,
        data: {
          skills: metas.map((m) => ({ name: m.name, description: m.description, effect: m.effect })),
          total: metas.length,
        },
        summary: `可用技能 ${metas.length} 个：${metas.map((m) => m.name).join('、')}。用 name 加载完整说明。`,
      };
    }

    const doc = findSkillDoc(rawName);
    const available = listSkillMetas(permissions)
      .filter((m) => isEffectAllowed(m.effect))
      .map((m) => m.name)
      .join('、');
    if (!doc || !isEffectAllowed(doc.effect)) {
      return {
        ok: false,
        data: `未找到可加载的技能 "${rawName}"${available ? `。当前可用：${available}` : '（当前没有可用技能）'}`,
      };
    }
    if (doc.permissions.length > 0 && !doc.permissions.some((p) => permissions.includes(p))) {
      return { ok: false, data: `当前用户无权限加载技能 ${doc.name}` };
    }

    const truncated = doc.body.length > MAX_BODY_CHARS;
    const content = truncated
      ? `${doc.body.slice(0, MAX_BODY_CHARS)}\n…（技能正文已截断，共 ${doc.body.length} 字符）`
      : doc.body;
    return {
      ok: true,
      data: { name: doc.name, effect: doc.effect, content },
      summary: `已加载技能 ${doc.name}（${doc.effect}）。严格按文档列出的步骤与工具执行，不要凭记忆自行发挥；文档要求的参数没拿到就先查，不要编。`,
    };
  },
};
