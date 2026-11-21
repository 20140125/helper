import type { ToolImpl, ToolResult } from '@/types/ai-chat';
import { listKnowledgeDocs, readDocByPath } from '@/utils/knowledge/storage';
import { buildKnowledgeIndex, resetKnowledgeIndex } from '../knowledge';

/**
 * query_knowledge_docs 工具实现（知识库文档只读管理）
 * @description 补齐 query_knowledge 只能检索片段、看不到文档清单/正文的问题。
 *   本工具只做 list/read/reindex，不写文档、不进入严格模式审批队列；写入请用 manage_knowledge。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "列出知识库文档"                       → { action: 'list' }
 *   - "读一下 贾维斯开发规范说明.md"          → { action: 'read', path: 'knowledge/贾维斯开发规范说明.md' }
 *   - "重建知识索引"                         → { action: 'reindex' }
 */
export const queryKnowledgeDocsTool: ToolImpl = {
  name: 'query_knowledge_docs',
  description:
    '查看 RAG 知识库文档清单、读取文档正文、重建索引。只读管理，不改变文档内容。'
    + 'list 返回 knowledge/ 与 docs/ 下已索引文档；read 传相对路径；reindex 重建 BM25 索引。'
    + '要新建/编辑/删除/导入文档请用 manage_knowledge（严格模式需审批）。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'read', 'reindex'],
        description: '操作类型：list 列出文档；read 读取文档正文；reindex 重建索引',
      },
      path: {
        type: 'string',
        description: '文档相对路径，read 必填（如 knowledge/贾维斯开发规范说明.md）',
      },
    },
    required: ['action'],
  },
  requiredPermissions: ['knowledge-base:view'],
  invoke: async (args): Promise<ToolResult> => {
    const action = typeof args.action === 'string' ? args.action.trim() : '';

    if (action === 'list') {
      const docs = listKnowledgeDocs();
      return {
        ok: true,
        data: { count: docs.length, docs },
        summary: `知识库共 ${docs.length} 篇文档`,
      };
    }

    if (action === 'read') {
      const docPath = typeof args.path === 'string' ? args.path.trim() : '';
      if (!docPath) return { ok: false, data: 'path 不能为空' };
      const content = readDocByPath(docPath);
      if (content === null) return { ok: false, data: `文档不存在或路径非法：${docPath}` };
      return { ok: true, data: { path: docPath, content }, summary: `已读取文档 ${docPath}` };
    }

    if (action === 'reindex') {
      resetKnowledgeIndex();
      const chunks = buildKnowledgeIndex();
      const sources = new Set(chunks.map((chunk) => chunk.source)).size;
      return {
        ok: true,
        data: { chunkCount: chunks.length, sources },
        summary: `知识索引已重建（${sources} 篇文档，${chunks.length} 个片段）`,
      };
    }

    return { ok: false, data: `不支持的 action：${action}` };
  },
};
