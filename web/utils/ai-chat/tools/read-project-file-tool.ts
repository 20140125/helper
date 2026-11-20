import fs from 'fs';
import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 允许读取的目录（相对项目根），白名单之外一律拒绝 */
const ALLOWED_DIRS = [
  'scripts',
  'docs',
  'sql',
  'web/utils',
  'web/routes',
  'web/types',
  'web/frontend/src',
  'web/skills',
];

/** 允许读取的根目录散文件 */
const ALLOWED_ROOT_FILES = new Set(['README.md', 'CHANGELOG', 'CONTRIBUTING.md']);

/** 禁止的路径片段（含密钥、运行时数据、依赖与构建产物） */
const FORBIDDEN_SEGMENTS = [
  '.env', '.git', '.cache', '.runtime', 'node_modules', '.codebuddy', 'dist', 'build', 'public',
];

/** 禁止的后缀 */
const FORBIDDEN_EXTS = new Set([
  '.log', '.pid', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.map', '.lock', '.zip', '.gz',
]);

/** 默认读取行数 */
const DEFAULT_LINES = 200;
/** 单次最大行数 */
const MAX_LINES = 500;
/** 返回内容字符上限，防止上下文爆炸 */
const MAX_CHARS = 8000;

/**
 * 判断相对路径是否在白名单内
 * @param {string} rel - 相对项目根的路径（/ 分隔）
 * @returns {boolean} 允许返回 true
 */
const isAllowed = (rel: string): boolean => {
  const parts = rel.split('/');
  for (const seg of parts) {
    if (FORBIDDEN_SEGMENTS.some((f) => seg === f || seg.startsWith(`${f}.`))) return false;
  }
  if (FORBIDDEN_EXTS.has(path.extname(rel).toLowerCase())) return false;
  if (parts.length === 1) return ALLOWED_ROOT_FILES.has(rel);
  return ALLOWED_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`));
};

/**
 * read_project_file 工具实现
 * @description 只读地查看项目里的某个文件内容（带行号），用于回答「这段逻辑是怎么写的」
 *   这类必须看代码才能答的问题。安全边界：白名单目录 + 路径穿越防护 + 禁敏感后缀 + 截断。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "看一下 reminder_daemon.sh 是怎么调度的"      → { path: 'scripts/reminder_daemon.sh' }
 *   - "web/utils/skill-docs.ts 前 80 行"           → { path: 'web/utils/ai-chat/skill-docs.ts', limit: 80 }
 */
export const readProjectFileTool: ToolImpl = {
  name: 'read_project_file',
  description:
    '只读查看项目里某个文件的内容（带行号）。先用 query_project_map 定位文件，再用本工具看内容；'
    + '直接猜路径容易落空。参数：path（相对项目根，如 scripts/reminder_daemon.sh）、'
    + 'offset（起始行号，从 1 开始）、limit（行数，默认 200，最大 500）。'
    + '只能读 scripts/ docs/ sql/ web/utils web/routes web/types web/frontend/src web/skills 与根目录 README；'
    + '.env、.cache、node_modules、日志与图片一律拒绝。'
    + '内容超过 8000 字符会截断，此时应缩小 offset/limit 分段看，不要整文件通读。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '相对项目根的文件路径' },
      offset: { type: 'number', description: '起始行号（从 1 开始），默认 1' },
      limit: { type: 'number', description: '读取行数，默认 200，最大 500' },
    },
    required: ['path'],
  },
  requiredPermissions: ['project:view'],
  invoke: async (args): Promise<ToolResult> => {
    const raw = typeof args.path === 'string' ? args.path.trim() : '';
    if (!raw) return { ok: false, data: 'path 不能为空' };

    // 路径穿越防护：先 resolve 成绝对路径，再换回相对路径比对白名单
    const abs = path.resolve(PROJECT_DIR, raw);
    const rel = path.relative(PROJECT_DIR, abs).split(path.sep).join('/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return { ok: false, data: `路径越界：${raw}` };
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      return { ok: false, data: `文件不存在或不可读：${rel}（先用 query_project_map 确认路径）` };
    }
    if (stat.isDirectory()) {
      return { ok: false, data: `${rel} 是目录，不是文件；查目录内容用 query_project_map` };
    }
    if (!isAllowed(rel)) {
      return {
        ok: false,
        data: `不允许读取 ${rel}。可白名单：${ALLOWED_DIRS.join('、')} 与根目录 README.md / CHANGELOG / CONTRIBUTING.md；`
          + '.env / .cache / node_modules / 日志图片一律拒绝。',
      };
    }

    let content: string;
    try {
      content = fs.readFileSync(abs, 'utf-8');
    } catch (err) {
      return { ok: false, data: `读取失败：${(err as Error).message}` };
    }

    const allLines = content.split(/\r?\n/);
    const rawOffset = Number(args.offset);
    const start = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) - 1 : 0;
    const rawLimit = Number(args.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LINES)
      : DEFAULT_LINES;

    const slice = allLines.slice(start, start + limit);
    const numbered = slice.map((line, i) => `${start + i + 1}\t${line}`).join('\n');
    const truncated = numbered.length > MAX_CHARS;
    const text = truncated
      ? `${numbered.slice(0, MAX_CHARS)}\n…（已截断：请缩小 limit 或调大 offset 分段查看）`
      : numbered;

    return {
      ok: true,
      data: {
        path: rel,
        total_lines: allLines.length,
        from_line: start + 1,
        to_line: Math.min(start + limit, allLines.length),
        truncated,
        content: text,
      },
      summary: `${rel}（共 ${allLines.length} 行，已读 ${start + 1}~${Math.min(start + limit, allLines.length)} 行）`,
    };
  },
};
