import { PAGE_REGISTRY, searchPages, type PageEntry } from '@/types/pages';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 把页面条目精简成 LLM 好读的形状（省 token）
 * @param {PageEntry} p - 页面条目
 * @returns 精简后的对象
 */
const shape = (p: PageEntry): Record<string, unknown> => ({
  path: p.path,
  name: p.name,
  label: p.label,
  in_menu: p.inMenu,
  desc: p.desc,
  permissions: p.permissions,
  covered_by_tools: p.coveredByTools,
});

/**
 * query_pages 工具实现（Web 入口导航）
 * @description Web 正在收敛成 agent 应用：很多页面从菜单收起但代码与路由仍在。
 *   用户问「XX 功能在哪 / 怎么打开某个页面」时，用它给出**直连路径**，
 *   别让用户去菜单里找一个已经收起的入口。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "手动触发页在哪"           → { keyword: '手动触发' }
 *   - "所有页面的入口都列出来"     → {}
 *   - "权限管理相关的页面"         → { keyword: 'rbac' }
 */
export const queryPagesTool: ToolImpl = {
  name: 'query_pages',
  description:
    '查 Web 页面的入口路径。用户问「XX 功能在哪 / 某个页面怎么进」时用；不传 keyword 返回全部页面。'
    + '返回每个页面的 path（浏览器直连用）、中文名、是否在侧边栏菜单可见、所需权限、以及是否已有贾维斯工具能直接代劳。'
    + 'in_menu=false 表示入口已收起，必须告诉用户「菜单里没有，直接访问 /xxx」。'
    + 'covered_by_tools 非空时优先说「这事我可以直接帮你做」，把页面入口作为兜底。'
    + '给出入口时把 path 写成 Markdown 链接 [页面中文名](/path)，用户点一下就能跳转到该页面；'
    + '不要把路径写进行内代码或拼成 http://IP:端口 的完整地址，一律用相对路径链接。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '关键字（中文名 / 路径 / 用途），不传返回全部',
      },
    },
  },
  invoke: async (args): Promise<ToolResult> => {
    const keyword = typeof args.keyword === 'string' ? args.keyword : '';
    const matched = searchPages(keyword);

    if (matched.length === 0) {
      return {
        ok: false,
        data: `没有匹配「${keyword}」的页面；不传 keyword 可看全部 ${PAGE_REGISTRY.length} 个页面`,
      };
    }

    return {
      ok: true,
      data: {
        pages: matched.map(shape),
        total: matched.length,
        menu_visible: PAGE_REGISTRY.filter((p) => p.inMenu).map((p) => p.path),
      },
      summary: keyword
        ? `匹配「${keyword}」的页面 ${matched.length} 个`
        : `共 ${matched.length} 个页面（菜单可见 ${PAGE_REGISTRY.filter((p) => p.inMenu).length} 个，其余需直连 URL）`,
    };
  },
};
