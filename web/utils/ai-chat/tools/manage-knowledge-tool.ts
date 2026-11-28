import type { ToolContext, ToolImpl, ToolResult } from '@/types/ai-chat';
import { KNOWLEDGE_MAX_DOC_BYTES } from '@/types/knowledge';
import {
  deleteKnowledgeDoc,
  importSystemDoc,
  isUserDocPath,
  normalizeDocName,
  readKnowledgeDoc,
  writeKnowledgeDoc,
} from '@/utils/knowledge';
import { buildKnowledgeIndex, resetKnowledgeIndex } from '../knowledge';

/**
 * 校验 Markdown 正文大小
 * @param {string} content - 文档正文
 * @returns {string | null} 错误信息，合法时返回 null
 */
const validateContent = (content: string): string | null => {
  if (!content.trim()) return 'content 不能为空';
  const bytes = Buffer.byteLength(content, 'utf-8');
  if (bytes > KNOWLEDGE_MAX_DOC_BYTES) {
    return `content 超过单文档上限（${bytes} > ${KNOWLEDGE_MAX_DOC_BYTES} 字节）`;
  }
  return null;
};

/**
 * 写入用户文档后立即重建 RAG 索引，保证本轮回答里新内容可检索
 * @returns {Promise<number>} 重建后的片段数
 */
const refreshIndex = async (): Promise<number> => {
  resetKnowledgeIndex();
  return (await buildKnowledgeIndex()).length;
};

/**
 * manage_knowledge 工具实现（RAG 知识库写入）
 * @description 只负责 create/update/delete/import 四类写操作；list/read/reindex 已拆到 query_knowledge_docs。
 *   docs/ 下的系统文档只读，只能通过 import 复制成 knowledge/ 用户文档后修改。
 *   本工具在 MUTATION_TOOLS 白名单里，严格模式下由 agent-loop 自动建审批单，不当场执行。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把刚才的结论写入知识库，名字叫 Web自动主题规范" → { action: 'create', name: 'Web自动主题规范', content: '# ...' }
 *   - "把这份文档导入后编辑"                           → { action: 'import', path: 'docs/12-扩展开发.md' }
 */
export const manageKnowledgeTool: ToolImpl = {
  name: 'manage_knowledge',
  description:
    '写入 RAG 知识库：新建/编辑/删除 knowledge/ 下的用户文档，或导入系统文档副本。'
    + '所有 action 都会改变知识库内容，strict 模式下需审批。'
    + 'docs/ 系统文档只读，不能删除或覆盖；要改先 import 成 knowledge/ 用户文档。'
    + '新建文档名不含 .md，建议使用中文短标题；写完会自动重建索引，新内容本轮即可被 query_knowledge 命中。'
    + '只查看文档清单/正文或重建索引用 query_knowledge_docs。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'update', 'delete', 'import'],
        description:
          '操作类型：create 新建用户文档；update 覆盖用户文档；'
          + 'delete 删除用户文档；import 导入系统文档副本',
      },
      name: {
        type: 'string',
        description: '用户文档名（不含 .md），create/update/delete 必填',
      },
      path: {
        type: 'string',
        description: '系统文档相对路径，import 必填（如 docs/12-扩展开发.md）',
      },
      content: {
        type: 'string',
        description: 'Markdown 正文，create/update 必填；建议按标题分节以便检索切块',
      },
    },
    required: ['action'],
  },
  requiredPermissions: ['knowledge-base:edit'],
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const action = typeof args.action === 'string' ? args.action.trim() : '';
    const canEdit = (ctx.userPermissions ?? []).includes('knowledge-base:edit');
    if (!canEdit) {
      return { ok: false, data: '当前用户没有知识库编辑权限，无法执行写操作' };
    }

    if (action === 'import') {
      const docPath = typeof args.path === 'string' ? args.path.trim() : '';
      if (!docPath) return { ok: false, data: 'path 不能为空' };
      if (isUserDocPath(docPath)) {
        return { ok: false, data: 'import 只能导入系统文档；用户文档无需导入' };
      }
      const doc = await importSystemDoc(docPath);
      if (!doc) return { ok: false, data: `导入失败：${docPath} 不存在、不可访问或 knowledge/ 下已有同名文档` };
      const chunkCount = await refreshIndex();
      return {
        ok: true,
        data: { doc, chunkCount },
        summary: `已导入系统文档副本 ${doc.path}，索引已重建（${chunkCount} 个片段）`,
      };
    }

    const rawName = typeof args.name === 'string' ? args.name.trim() : '';
    const name = normalizeDocName(rawName);
    if (!name) {
      return { ok: false, data: `非法文档名：${rawName || '(空)'}；不能含路径分隔符、.. 或控制字符` };
    }

    if (action === 'delete') {
      const existed = readKnowledgeDoc(name) !== null;
      if (!existed) return { ok: false, data: `用户文档不存在：${name}.md` };
      await deleteKnowledgeDoc(name);
      const chunkCount = await refreshIndex();
      return {
        ok: true,
        data: { name, chunkCount },
        summary: `已删除用户文档 ${name}.md，索引已重建（${chunkCount} 个片段）`,
      };
    }

    if (action === 'create' || action === 'update') {
      const content = typeof args.content === 'string' ? args.content : '';
      const invalid = validateContent(content);
      if (invalid) return { ok: false, data: invalid };

      const exists = readKnowledgeDoc(name) !== null;
      if (action === 'create' && exists) {
        return { ok: false, data: `用户文档已存在：${name}.md；如需覆盖请改用 update` };
      }
      if (action === 'update' && !exists) {
        return { ok: false, data: `用户文档不存在：${name}.md；如需新建请改用 create` };
      }

      await writeKnowledgeDoc(name, content);
      const chunkCount = await refreshIndex();
      return {
        ok: true,
        data: { name, path: `knowledge/${name}.md`, bytes: Buffer.byteLength(content, 'utf-8'), chunkCount },
        summary: `${action === 'create' ? '已新建' : '已更新'}用户文档 knowledge/${name}.md，索引已重建（${chunkCount} 个片段）`,
      };
    }

    return { ok: false, data: `不支持的 action：${action}` };
  },
};
