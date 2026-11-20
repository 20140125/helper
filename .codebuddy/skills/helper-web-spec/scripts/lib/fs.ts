/**
 * 文件扫描与读写
 *
 * 背景：8 个脚本各写了一份 readdirSync 递归，忽略目录名单还不一致
 * （有的漏 .git、有的漏 coverage，check-unused 甚至拿子串去匹配整条路径，
 * 仓库路径里只要出现 dist/build 字样就会静默跳过整个项目）。统一在这里实现。
 */

import fs from 'fs';
import path from 'path';

/** 统一忽略目录（目录名精确匹配，不做全路径子串匹配） */
export const IGNORE_DIRS: string[] = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.codebuddy',
  '.cache',
];

/** 默认跳过的超大文件（2MB）：日志、打包产物之类不该进扫描 */
export const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024;

export type ScanOptions = {
  /** 后缀白名单，如 ['.ts', '.vue']；留空表示不限 */
  extensions?: string[];
  /** 文件名（basename）正则过滤 */
  pattern?: RegExp;
  /** 覆盖默认忽略目录 */
  ignoreDirs?: string[];
  /** 单文件大小上限，默认 2MB */
  maxFileSize?: number;
};

/**
 * 递归扫描文件或目录
 *
 * 与旧实现的区别：
 *   1) 用 dirent 直接判类型，省掉每个条目一次 statSync
 *   2) 忽略目录按「目录名」精确匹配，不再对全路径做子串匹配
 *   3) 传单个文件时直接返回该文件（旧 check-code-style 会 readdirSync 抛 ENOTDIR 崩溃）
 *   4) 跳过超大文件与读取失败的文件
 */
export const scanFiles = (target: string, options: ScanOptions = {}): string[] => {
  const {
    extensions = [],
    pattern,
    ignoreDirs = IGNORE_DIRS,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
  } = options;

  if (!fs.existsSync(target)) return [];

  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    return matchFile(target, extensions, pattern) ? [target] : [];
  }

  const results: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.includes(entry.name)) continue;
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!matchFile(fullPath, extensions, pattern)) continue;
      try {
        if (fs.statSync(fullPath).size > maxFileSize) continue;
      } catch {
        continue;
      }
      results.push(fullPath);
    }
  };

  walk(target);
  return results.sort();
};

/** 判断文件名是否命中后缀 / 正则条件 */
const matchFile = (file: string, extensions: string[], pattern?: RegExp): boolean => {
  const base = path.basename(file);
  if (extensions.length > 0 && !extensions.some(ext => base.endsWith(ext))) return false;
  if (pattern && !pattern.test(base)) return false;
  return true;
};

/**
 * 读取文本文件内容
 * @returns 内容字符串；读取失败返回空串（不抛异常，避免单个坏文件中断整轮扫描）
 */
export const readText = (file: string): string => {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
};

/**
 * 写文件（自动建目录；已存在则不动，返回 false）
 * @returns true=已写入，false=已存在跳过
 */
export const writeText = (file: string, content: string): boolean => {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf-8');
  return true;
};

/**
 * 覆盖写文件（自动建目录）
 * @returns true=成功，false=失败
 */
export const overwriteText = (file: string, content: string): boolean => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
};
