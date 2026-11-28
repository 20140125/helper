import fs from 'fs';
import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';
import type { ProjectMapEntry, ProjectMapQuery } from '@/types/project-map';

/**
 * 项目结构地图
 * @description 扫描 `scripts/` `web/` `docs/` `sql/` 生成结构索引，
 *   补上「文档检索」覆盖不到的那一层——代码与目录本身。
 *
 * 只索引元数据（路径 / 体积 / 首行注释），不读全文：
 *   全文按需由 read_project_file 读，避免一次性把仓库塞进上下文。
 */

/** 缓存有效期（毫秒）：项目结构变化不频繁，5 分钟内复用，避免每次 stat 几百个文件 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 递归深度上限 */
const MAX_DEPTH = 4;

/** 参与索引的顶层目录 */
const ROOT_DIRS = ['scripts', 'web', 'sql'];

/** 参与索引的根目录散文件 */
const ROOT_FILES = ['README.md', 'CHANGELOG', 'CONTRIBUTING.md'];

/** 忽略的目录名（构建产物、依赖、运行时数据、大量小文件目录） */
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.cache', '.runtime', '.codebuddy', '.vscode',
  'logs', 'dist', 'build', 'public', 'frontend', 'results', 'assets', 'evals',
]);

/** 忽略的文件后缀（二进制 / 锁文件 / 日志 / source map） */
const IGNORE_EXT = new Set([
  '.log', '.pid', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.map', '.lock', '.zip', '.gz', '.tar', '.pdf',
]);

/** 单次返回条数上限 */
const MAX_ENTRIES = 120;

/** 描述文本最大长度 */
const MAX_DESC_CHARS = 100;

/** 读取文件头部用于提取描述的字节数 */
const HEAD_BYTES = 2048;

/** 内存缓存 */
let cache: { at: number; entries: ProjectMapEntry[] } | null = null;

/**
 * 从文件头部提取一句话描述
 * @param {string} abs - 文件绝对路径
 * @returns {string} 描述文本，取不到时返回空串
 * @description 依次尝试：注释行（# / // / *）→ 首个非空行；只取头部 2KB，不读全文。
 */
const describeFile = (abs: string): string => {
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const fd = fs.openSync(abs, 'r');
    const read = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    fs.closeSync(fd);
    const head = buf.slice(0, read).toString('utf-8');
    const lines = head.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // 噪声行：shebang 与纯分隔线（==== / ----），它们没有语义
    const isNoise = (s: string): boolean => !s || /^[=\-*_\s]+$/.test(s);
    const strip = (s: string): string =>
      s.replace(/^(#+|<!--|\/\*+|\*|\/\/)\s*/, '').replace(/-->$/, '').trim();
    // 第一轮：优先取注释行（跳过 shebang，否则 .sh 全是「!/bin/bash」）
    for (const line of lines) {
      if (line.startsWith('#!')) continue;
      if (/^(#|<!--|\/\*+|\*|\/\/)/.test(line)) {
        const cleaned = strip(line);
        if (!isNoise(cleaned)) return cleaned.slice(0, MAX_DESC_CHARS);
      }
    }
    // 第二轮：没有注释就取首个有意义的行
    for (const line of lines) {
      if (line.startsWith('#!')) continue;
      const cleaned = strip(line);
      if (!isNoise(cleaned)) return cleaned.slice(0, MAX_DESC_CHARS);
    }
  } catch {
    // 读不了（权限 / 二进制）就留空，不影响地图构建
  }
  return '';
};

/**
 * 递归收集目录条目
 * @param {string} absDir - 目录绝对路径
 * @param {string} relDir - 相对项目根的目录路径
 * @param {number} depth - 当前深度
 * @param {ProjectMapEntry[]} out - 结果收集数组
 * @returns {void}
 */
const walk = (absDir: string, relDir: string, depth: number, out: ProjectMapEntry[]): void => {
  if (depth > MAX_DEPTH) return;
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  items.sort((a, b) => a.name.localeCompare(b.name));

  const dirs: fs.Dirent[] = [];
  const files: fs.Dirent[] = [];
  for (const item of items) {
    if (item.isDirectory()) {
      if (IGNORE_DIRS.has(item.name)) continue;
      dirs.push(item);
    } else if (item.isFile()) {
      if (IGNORE_EXT.has(path.extname(item.name).toLowerCase())) continue;
      files.push(item);
    }
  }

  if (relDir) {
    out.push({ path: relDir, type: 'dir', file_count: files.length, dir_count: dirs.length });
  }
  for (const file of files) {
    const rel = relDir ? `${relDir}/${file.name}` : file.name;
    let size = 0;
    try {
      size = fs.statSync(path.join(absDir, file.name)).size;
    } catch {
      // 拿不到体积就记 0
    }
    out.push({
      path: rel,
      type: 'file',
      ext: path.extname(file.name).toLowerCase(),
      size,
      desc: describeFile(path.join(absDir, file.name)),
    });
  }
  for (const dir of dirs) {
    walk(path.join(absDir, dir.name), relDir ? `${relDir}/${dir.name}` : dir.name, depth + 1, out);
  }
};

/**
 * 构建（或复用）项目结构地图
 * @returns {ProjectMapEntry[]} 全部条目
 */
export const listProjectMap = (): ProjectMapEntry[] => {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.entries;

  const entries: ProjectMapEntry[] = [];
  for (const dir of ROOT_DIRS) {
    walk(path.join(PROJECT_DIR, dir), dir, 1, entries);
  }
  for (const file of ROOT_FILES) {
    const abs = path.join(PROJECT_DIR, file);
    if (!fs.existsSync(abs)) continue;
    entries.push({ path: file, type: 'file', ext: path.extname(file), size: fs.statSync(abs).size, desc: describeFile(abs) });
  }
  cache = { at: now, entries };
  return entries;
};

/**
 * 清空地图缓存
 * @returns {void}
 */
export const resetProjectMapCache = (): void => {
  cache = null;
};

/**
 * 查询项目结构
 * @param {{ path?: string; keyword?: string; type?: 'dir' | 'file' }} options - 查询条件
 * @returns {ProjectMapQuery} 命中条目（含总数与截断标记）
 * @description 三种模式：
 *   - 都不传：顶层概览（各顶层目录的文件数 / 子目录数 + 根目录散文件）
 *   - 传 path：列出该前缀下的条目
 *   - 传 keyword：按路径或描述模糊搜索
 */
export const queryProjectMap = (options: {
  path?: string;
  keyword?: string;
  type?: 'dir' | 'file';
} = {}): ProjectMapQuery => {
  const all = listProjectMap();
  const rawPath = (options.path ?? '').trim().replace(/^\/+|\/+$/g, '');
  const keyword = (options.keyword ?? '').trim().toLowerCase();
  const type = options.type;

  // 顶层概览：只看第一层
  if (!rawPath && !keyword) {
    const top = all.filter((e) => {
      const depth = e.path.split('/').length;
      return depth === 1;
    });
    return { entries: top, total: top.length, truncated: false };
  }

  let hits = all;
  if (rawPath) {
    const prefix = `${rawPath}/`;
    hits = hits.filter((e) => e.path === rawPath || e.path.startsWith(prefix));
  }
  if (keyword) {
    hits = hits.filter(
      (e) => e.path.toLowerCase().includes(keyword) || (e.desc ?? '').toLowerCase().includes(keyword),
    );
  }
  if (type) {
    hits = hits.filter((e) => e.type === type);
  }

  return {
    entries: hits.slice(0, MAX_ENTRIES),
    total: hits.length,
    truncated: hits.length > MAX_ENTRIES,
  };
};
