import { queryProjectMap } from '@/utils/ai-chat/project-map';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * query_project_map 工具实现
 * @description 查项目**结构**（有哪些目录 / 文件、各是什么、在哪），
 *   回答「这个功能在哪个文件 / scripts 下有哪些脚本 / web/utils 里都有什么模块」这类问题。
 *   与 query_knowledge 分工：那个检索 docs/ 文档内容，这个查代码与目录本身。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "这个项目都由哪几块组成"                          → {}（顶层概览）
 *   - "scripts 下都有哪些脚本"                          → { path: 'scripts' }
 *   - "卡片相关的脚本在哪"                              → { keyword: 'card' }
 *   - "web/utils 里有哪些模块"                          → { path: 'web/utils', type: 'dir' }
 */
export const queryProjectMapTool: ToolImpl = {
  name: 'query_project_map',
  description:
    '查项目结构：有哪些目录与文件、各自是什么（取自首行注释的一句话描述）。'
    + '不传参数返回顶层概览（各目录的文件数 / 子目录数）；传 path 列出该目录下条目；传 keyword 按路径或描述模糊搜。'
    + '回答「这个功能在哪个文件 / scripts 下有什么脚本 / web/utils 有哪些模块」时用本工具；'
    + '要文档内容用 query_knowledge，要看某个文件的具体内容用 read_project_file。'
    + '只读，不返回文件内容；看不到 frontend/、node_modules/ 等已排除目录属正常。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '目录前缀（相对项目根，如 scripts / web/utils）；不传则为顶层概览',
      },
      keyword: {
        type: 'string',
        description: '按路径或描述模糊搜索，如 card、daemon、weather',
      },
      type: {
        type: 'string',
        enum: ['dir', 'file'],
        description: '只看目录或只看文件，默认都看',
      },
    },
  },
  requiredPermissions: ['project:view'],
  invoke: async (args): Promise<ToolResult> => {
    const rawPath = typeof args.path === 'string' ? args.path.trim() : '';
    const keyword = typeof args.keyword === 'string' ? args.keyword.trim() : '';
    const type = args.type === 'dir' || args.type === 'file' ? args.type : undefined;

    const result = queryProjectMap({ path: rawPath, keyword, type });
    if (result.total === 0) {
      return {
        ok: false,
        data: `没有匹配的条目${rawPath ? `（path=${rawPath}）` : ''}${keyword ? `（keyword=${keyword}）` : ''}。`
          + '可先不传参数看顶层概览，或先加载 project-overview 技能了解目录职责。',
      };
    }

    return {
      ok: true,
      data: {
        entries: result.entries,
        total: result.total,
        truncated: result.truncated,
      },
      summary: `命中 ${result.total} 条${result.truncated ? `（仅返回前 ${result.entries.length} 条，建议缩小 path 或加 keyword）` : ''}。`
        + '要看某个文件的具体内容用 read_project_file。',
    };
  },
};
