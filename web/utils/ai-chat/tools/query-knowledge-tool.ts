import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import { searchKnowledge } from '../knowledge';

/**
 * query_knowledge 工具实现（项目知识库检索）
 * @description 让贾维斯能回答「这个项目怎么用」类问题：查本地 docs/ 文档而不是靠模型记忆编。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "怎么新增一条自定义提醒规则"   → { query: '新增自定义规则 步骤', top_k: 3 }
 *   - "守护进程怎么重启"              → { query: 'daemon 重启 守护进程', top_k: 3 }
 */
export const queryKnowledgeTool: ToolImpl = {
  name: 'query_knowledge',
  description:
    '检索本项目知识库（docs/ + knowledge/ 文档，数据库快照），回答「怎么用 / 怎么配置 / 怎么扩展」类问题。'
    + '凡涉及本项目自身用法、脚本说明、配置项含义、开发规范的提问，优先用它取权威文档，'
    + '不要凭模型记忆作答。返回的是文档片段，需自行提炼成结论并注明出处。'
    + '若要列文档/读正文/重建索引用 query_knowledge_docs；新建/编辑/删除用 manage_knowledge。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '检索关键词（用文档里可能出现的术语，如「自定义规则 新增」「daemon 重启」）',
      },
      top_k: {
        type: 'number',
        description: '返回片段数量（1~5，默认 3）',
      },
    },
    required: ['query'],
  },
  invoke: async (args): Promise<ToolResult> => {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return { ok: false, data: 'query 不能为空' };
    }
    const rawTopK = Number(args.top_k);
    const topK = Number.isFinite(rawTopK) ? Math.min(Math.max(Math.floor(rawTopK), 1), 5) : 3;

    const hits = await searchKnowledge(query, topK);
    if (hits.length === 0) {
      return {
        ok: true,
        data: { hits: [], note: '知识库中没有相关片段' },
        summary: '未命中相关文档',
      };
    }
    return {
      ok: true,
      data: {
        hits: hits.map((h) => ({
          source: h.source,
          title: h.title,
          text: h.text.slice(0, 900),
        })),
      },
      summary: `命中 ${hits.length} 个文档片段`,
    };
  },
};
