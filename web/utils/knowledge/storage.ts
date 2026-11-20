import fs from 'fs';
import path from 'path';
import {
  KNOWLEDGE_CONFIG_FILE,
  KNOWLEDGE_MAX_DOC_BYTES,
  KNOWLEDGE_USER_DIR,
  KNOWLEDGE_USER_DIR_ABS,
  DEFAULT_KNOWLEDGE_DIRS,
  type KnowledgeConfig,
  type KnowledgeDoc,
} from '@/types/knowledge';
import { CACHE_DIR, PROJECT_DIR } from '../paths';

/** 文档名合法格式：中文、字母、数字、下划线、横线，可带 .md 后缀 */
const DOC_NAME_PATTERN = /^[\w\u4e00-\u9fa5-]+(\.md)?$/i;

/** 文档名最大长度 */
const MAX_DOC_NAME_LENGTH = 80;

/** 扫描索引目录时忽略的子目录（与 ai-chat/knowledge.ts 保持一致） */
const IGNORE_SCAN_DIRS = new Set([
  'node_modules', '.git', '.cache', '.runtime', '.codebuddy', 'dist', 'build', 'public',
]);

/** 最大扫描深度 */
const MAX_SCAN_DEPTH = 4;

/**
 * 格式化时间为 YYYY-MM-DD HH:mm:ss
 * @param {Date} date - 时间对象
 * @returns {string} 格式化后的时间字符串
 */
const formatTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * 校验并规范化文档名
 * @param {string} raw - 原始文档名
 * @returns {string | null} 不含 .md 后缀的安全文件名；非法时返回 null
 * @description 拒绝路径分隔符、上级目录引用与控制字符，避免写文件越出知识目录
 */
export const normalizeDocName = (raw: string): string | null => {
  const name = (raw ?? '').trim();
  if (!name || name.length > MAX_DOC_NAME_LENGTH) return null;
  if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) return null;
  if (!DOC_NAME_PATTERN.test(name)) return null;
  return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name;
};

/**
 * 获取文档绝对路径
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string} 绝对路径
 */
const getDocPath = (name: string): string => path.join(KNOWLEDGE_USER_DIR_ABS, `${name}.md`);

/**
 * 判断文档相对路径是否属于用户维护目录
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {boolean} 位于 knowledge/ 目录时返回 true
 */
export const isUserDocPath = (relativePath: string): boolean => {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith(`${KNOWLEDGE_USER_DIR}/`);
};

/**
 * 列出所有参与索引的 Markdown 文档
 * @returns {KnowledgeDoc[]} 文档元信息列表，用户文档在前、系统文档在后，各自按路径排序
 * @description 覆盖全部已配置索引目录；系统文档（非 knowledge/ 目录）标记为只读
 */
export const listKnowledgeDocs = (): KnowledgeDoc[] => {
  const docs: KnowledgeDoc[] = [];
  const seen = new Set<string>();

  for (const sourceDir of readKnowledgeDirs().dirs) {
    const root = path.join(PROJECT_DIR, sourceDir);
    if (!fs.existsSync(root)) continue;

    const walk = (current: string, depth: number): void => {
      if (depth > MAX_SCAN_DEPTH) return;
      let items: fs.Dirent[];
      try {
        items = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const item of items) {
        const abs = path.join(current, item.name);
        if (item.isDirectory()) {
          if (!IGNORE_SCAN_DIRS.has(item.name)) walk(abs, depth + 1);
          continue;
        }
        if (!item.isFile() || !item.name.toLowerCase().endsWith('.md')) continue;

        const relativePath = path.relative(PROJECT_DIR, abs).split(path.sep).join('/');
        if (seen.has(relativePath)) continue;
        seen.add(relativePath);
        const stat = fs.statSync(abs);
        docs.push({
          name: item.name,
          path: relativePath,
          source_dir: sourceDir,
          readonly: !isUserDocPath(relativePath),
          size: stat.size,
          updated_at: formatTimestamp(stat.mtime),
        } satisfies KnowledgeDoc);
      }
    };
    walk(root, 1);
  }

  return docs.sort((a, b) => {
    if (a.readonly !== b.readonly) return a.readonly ? 1 : -1;
    return a.path.localeCompare(b.path);
  });
};

/**
 * 解析文档相对路径为绝对路径（仅限已配置索引目录内的 .md 文件）
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {string | null} 绝对路径；越界、非 Markdown 或不存在时返回 null
 * @description 防止路径穿越，确保只能访问知识库索引范围内的文件
 */
export const resolveDocPath = (relativePath: string): string | null => {
  const normalized = (relativePath ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!normalized || path.isAbsolute(normalized) || normalized.includes('..') || normalized.includes('\0')) return null;
  if (!normalized.toLowerCase().endsWith('.md')) return null;

  const abs = path.resolve(PROJECT_DIR, normalized);
  const allowed = resolveKnowledgeDirPaths().some((dir) => abs === dir || abs.startsWith(`${dir}${path.sep}`));
  if (!allowed) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
};

/**
 * 按相对路径读取文档正文（支持系统文档与用户文档）
 * @param {string} relativePath - 相对项目根的文档路径
 * @returns {string | null} 文档内容；路径非法或不存在时返回 null
 */
export const readDocByPath = (relativePath: string): string | null => {
  const abs = resolveDocPath(relativePath);
  return abs ? fs.readFileSync(abs, 'utf-8') : null;
};

/**
 * 导入系统文档为用户文档副本
 * @param {string} relativePath - 系统文档的相对路径
 * @returns {KnowledgeDoc | null} 导入后的用户文档元信息；失败时返回 null
 * @description 仅复制内容到 knowledge/ 目录，原系统文档保持不变；目标同名时拒绝覆盖
 */
export const importSystemDoc = (relativePath: string): KnowledgeDoc | null => {
  const abs = resolveDocPath(relativePath);
  if (!abs || isUserDocPath(relativePath)) return null;

  const rawName = path.basename(abs, path.extname(abs));
  const safeName = normalizeDocName(rawName.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, ''));
  if (!safeName) return null;
  if (readKnowledgeDoc(safeName) !== null) return null;

  writeKnowledgeDoc(safeName, fs.readFileSync(abs, 'utf-8'));
  return listKnowledgeDocs().find((doc) => doc.path === `${KNOWLEDGE_USER_DIR}/${safeName}.md`) ?? null;
};

/**
 * 读取知识文档正文
 * @param {string} name - 不含后缀的安全文档名
 * @returns {string | null} 文档内容；不存在时返回 null
 */
export const readKnowledgeDoc = (name: string): string | null => {
  const filePath = getDocPath(name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
};

/**
 * 写入知识文档（新建或覆盖）
 * @param {string} name - 不含后缀的安全文档名
 * @param {string} content - Markdown 正文
 * @returns {void}
 * @description 目录不存在时自动创建
 */
export const writeKnowledgeDoc = (name: string, content: string): void => {
  if (!fs.existsSync(KNOWLEDGE_USER_DIR_ABS)) {
    fs.mkdirSync(KNOWLEDGE_USER_DIR_ABS, { recursive: true });
  }
  fs.writeFileSync(getDocPath(name), content, 'utf-8');
};

/**
 * 删除知识文档
 * @param {string} name - 不含后缀的安全文档名
 * @returns {boolean} 是否成功删除（不存在时返回 false）
 */
export const deleteKnowledgeDoc = (name: string): boolean => {
  const filePath = getDocPath(name);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
};

/**
 * 读取索引目录配置
 * @returns {KnowledgeConfig} 当前配置；文件缺失或损坏时返回默认配置
 */
export const readKnowledgeDirs = (): KnowledgeConfig => {
  const fallback: KnowledgeConfig = { dirs: [...DEFAULT_KNOWLEDGE_DIRS], updated_at: '' };
  if (!fs.existsSync(KNOWLEDGE_CONFIG_FILE)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(KNOWLEDGE_CONFIG_FILE, 'utf-8')) as Partial<KnowledgeConfig>;
    if (!Array.isArray(parsed.dirs) || parsed.dirs.length === 0) return fallback;
    const dirs = parsed.dirs.filter((d): d is string => typeof d === 'string' && Boolean(d.trim()));
    return dirs.length ? { dirs, updated_at: parsed.updated_at ?? '' } : fallback;
  } catch {
    return fallback;
  }
};

/**
 * 校验并规范化索引目录列表
 * @param {string[]} raw - 原始目录列表（相对项目根）
 * @returns {string[] | null} 规范化后的目录列表；非法时返回 null
 * @description 仅允许项目根内的相对路径，拒绝绝对路径与上级目录引用
 */
export const normalizeKnowledgeDirs = (raw: string[]): string[] | null => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const dir = item.trim().replace(/^\.\//, '').replace(/\/$/, '');
    if (!dir || dir.startsWith('/') || dir.includes('\\') || dir.includes('..') || dir.includes('\0')) return null;
    if (!out.includes(dir)) out.push(dir);
  }
  return out.length ? out : null;
};

/**
 * 写入索引目录配置
 * @param {string[]} dirs - 已规范化的目录列表
 * @returns {KnowledgeConfig} 写入后的配置
 */
export const writeKnowledgeDirs = (dirs: string[]): KnowledgeConfig => {
  const config: KnowledgeConfig = { dirs, updated_at: formatTimestamp(new Date()) };
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(KNOWLEDGE_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  return config;
};

/**
 * 获取文档内容字节数
 * @param {string} content - 文档正文
 * @returns {number} UTF-8 字节数
 */
export const getDocContentBytes = (content: string): number => Buffer.byteLength(content, 'utf-8');

/**
 * 获取配置的索引目录绝对路径列表
 * @returns {string[]} 绝对路径列表
 * @description 供 searchKnowledge 的索引构建使用；配置缺失时回退到默认目录
 */
export const resolveKnowledgeDirPaths = (): string[] => readKnowledgeDirs().dirs.map((d) => path.join(PROJECT_DIR, d));
