import { readTemplatesFromDb } from '@/utils/database/content-library';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 单条模板内容预览长度（字符） */
const PREVIEW_LEN = 200;
/** 单条模板内容返回上限（字符），防止上下文爆炸 */
const CONTENT_LIMIT = 4000;

/**
 * 截断文本并追加省略标记
 * @param {string} text - 原文
 * @param {number} limit - 最大长度
 * @returns {string} 截断后的文本
 */
const truncate = (text: string, limit: number): string =>
  (text.length > limit ? `${text.slice(0, limit)}…（已截断）` : text);

/**
 * 从模板配置中安全地取出 templates 字典
 * @param {Record<string, unknown>} raw - readTemplatesFromDb 返回的原始对象
 * @returns {Record<string, Record<string, string>>} type → style → 模板内容
 */
const extractTemplates = (raw: Record<string, unknown>): Record<string, Record<string, string>> => {
  const templates = raw?.templates;
  if (!templates || typeof templates !== 'object') return {};
  const out: Record<string, Record<string, string>> = {};
  Object.entries(templates as Record<string, unknown>).forEach(([type, styles]) => {
    if (!styles || typeof styles !== 'object') return;
    out[type] = Object.fromEntries(
      Object.entries(styles as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string')
        .map(([style, v]) => [style, v as string]),
    );
  });
  return out;
};

/**
 * query_message_templates 工具实现
 * @description 查询「消息模板」配置（直接读数据库，库不可用时返回明确错误，不再读 .cache 文件）：
 *              有哪些消息类型（type）与风格（style）。
 *              不传 type 返回全部类型/风格清单；传 type 返回该类型各风格的预览；同时传 style 返回完整内容。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "消息模板都有哪几种？"                           → {}
 *   - "早安提醒模板长什么样"                            → { type: 'morning' }
 *   - "看下早安模板的 brief 风格"                       → { type: 'morning', style: 'brief' }
 */
export const queryMessageTemplatesTool: ToolImpl = {
  name: 'query_message_templates',
  description:
    '查询「消息模板」配置：不传 type 返回所有消息类型（type）及其风格（style）清单；'
    + '传 type 返回该类型下各风格的内容预览；同时传 style 返回该模板完整内容（超长会截断）。'
    + '模板里的 {xxx} 是占位符，会在发送时替换为真实数据。',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: '消息类型（如 morning / birthday / holiday）；不传则返回全部类型清单',
      },
      style: {
        type: 'string',
        description: '模板风格（如 default / brief）；需配合 type 使用',
      },
    },
  },
  requiredPermissions: ['templates:view'],
  invoke: async (args): Promise<ToolResult> => {
    let raw: Record<string, unknown>;
    try {
      raw = await readTemplatesFromDb();
    } catch (err) {
      return { ok: false, data: `读取消息模板失败：${(err as Error).message}` };
    }

    const templates = extractTemplates(raw);
    const types = Object.keys(templates);
    if (types.length === 0) {
      return { ok: true, data: { types: [] }, summary: '尚未配置任何消息模板' };
    }

    // 清单模式：返回 type → styles
    const typeArg = typeof args.type === 'string' ? args.type.trim() : '';
    if (!typeArg) {
      const list = types.map((t) => ({ type: t, styles: Object.keys(templates[t]) }));
      return {
        ok: true,
        data: { types: list, total: types.length },
        summary: `共 ${types.length} 种消息类型：${types.join('、')}`,
      };
    }

    if (!templates[typeArg]) {
      return { ok: false, data: `未知 type="${typeArg}"，可用：${types.join('、')}` };
    }

    const styles = templates[typeArg];
    const styleArg = typeof args.style === 'string' ? args.style.trim() : '';
    if (styleArg) {
      if (!styles[styleArg]) {
        return { ok: false, data: `type="${typeArg}" 下无 style="${styleArg}"，可用：${Object.keys(styles).join('、')}` };
      }
      return {
        ok: true,
        data: { type: typeArg, style: styleArg, content: truncate(styles[styleArg], CONTENT_LIMIT) },
        summary: `模板 ${typeArg}/${styleArg}（${styles[styleArg].length} 字符）`,
      };
    }

    const preview = Object.entries(styles).map(([style, content]) => ({
      style,
      length: content.length,
      preview: truncate(content, PREVIEW_LEN),
    }));
    return {
      ok: true,
      data: { type: typeArg, styles: preview },
      summary: `${typeArg} 共 ${preview.length} 种风格：${Object.keys(styles).join('、')}`,
    };
  },
};
