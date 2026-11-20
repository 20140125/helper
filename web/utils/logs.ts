import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { PROJECT_DIR } from './paths';
import { formatDate } from './script';
import type { LogFileInfo } from '@/types/log';
import type { ConsoleLogEntry } from '@/types/access-log';
import { LOG_FILES, ACCESS_LOG_BACKUP_KEY } from '@/types/log';
import { WEB_LOG_FILE, LAUNCHER_LOG_FILE } from '@/types/web-service';
import { getLatestArchivePath } from './access-log';

/**
 * 已迁到 web/.runtime 的日志 key → 新路径
 * @description Web 服务/启动器日志改由 web/.runtime 承载（不依赖 scripts/）；
 *   新路径存在时优先展示，否则回退 scripts/ 下的旧路径
 */
const RUNTIME_LOG_FILES: Record<string, string> = {
  web_server: WEB_LOG_FILE,
  web_launcher: LAUNCHER_LOG_FILE,
};

/**
 * 解析日志文件的绝对路径
 * @param filename - 日志文件名或绝对路径
 * @returns 绝对路径
 */
const resolveLogPath = (filename: string): string =>
  path.isAbsolute(filename) ? filename : path.join(PROJECT_DIR, filename);

/**
 * 解析日志 key 对应的实际文件路径
 * @param key - 日志标识符
 * @returns 日志文件绝对路径
 * @description 历史访问日志（access_log_backup）指向 scripts/logs 目录下最新一份归档，
 *   找不到归档时才回退到 LOG_FILES 里声明的旧 .log.1 路径
 */
const resolveLogFile = (key: string): string => {
  if (key === ACCESS_LOG_BACKUP_KEY) {
    return getLatestArchivePath() ?? resolveLogPath(LOG_FILES[key]);
  }
  const runtimeFile = RUNTIME_LOG_FILES[key];
  if (runtimeFile && fs.existsSync(runtimeFile)) {
    return runtimeFile;
  }
  return resolveLogPath(LOG_FILES[key]);
};

/**
 * 获取单个日志文件的状态信息
 * @param key - 日志文件标识符
 * @returns 包含 key、filename（相对项目根目录）、exists、size、mtime、mtimeMs 的信息对象
 */
const getLogFileInfo = (key: string) => {
  const filePath = resolveLogFile(key);
  const filename = path.relative(PROJECT_DIR, filePath).replace(/\\/g, '/');
  const exists = fs.existsSync(filePath);
  if (!exists) {
    return { key, filename, exists, size: 0, mtime: null, mtimeMs: 0 };
  }
  const stat = fs.statSync(filePath);
  return {
    key,
    filename,
    exists,
    size: stat.size,
    mtime: formatDate(stat.mtime),
    mtimeMs: stat.mtimeMs,
  };
};

/**
 * 列出所有已声明的日志文件（按修改时间倒序）
 * @returns 日志文件信息列表（剔除内部排序字段 mtimeMs）
 */
export const listLogFiles = (): LogFileInfo[] => {
  const list = Object.keys(LOG_FILES)
    .map((key) => getLogFileInfo(key))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return list.map(({ mtimeMs: _mtimeMs, ...rest }) => rest as LogFileInfo);
};

/**
 * 判断日志 key 是否已在 LOG_FILES 中注册
 * @param key - 日志标识符
 * @returns 已注册返回 true
 */
export const isLogKeyValid = (key: string): boolean => Boolean(LOG_FILES[key]);

/**
 * 把 JSONL 日志渲染成人可读的文本
 * @param raw - tail 取回的原始内容（每行一条 JSON）
 * @returns 形如 [2026-10-21 10:02:52] [WARN] xxx 的文本
 * @description 解析失败的行（历史遗留的纯文本）原样保留，避免老日志显示成一片空白
 */
const renderJsonlTail = (raw: string): string =>
  raw
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '';
      try {
        const entry = JSON.parse(line) as ConsoleLogEntry;
        const extra = entry.args?.length
          ? ` ${entry.args.map((a) => JSON.stringify(a)).join(' ')}`
          : '';
        return `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.message}${extra}`;
      } catch {
        return line;
      }
    })
    .join('\n');

/**
 * 读取指定日志文件末尾 N 行内容
 * @param key - 日志标识符（必须在 LOG_FILES 中注册）
 * @param lines - 读取的尾部行数
 * @returns 包含 content（文件存在）/ missing（文件尚未生成）/ error（读取失败）之一的结果
 * @description .jsonl 文件先渲染成文本再返回，页面展示层无需感知底层格式差异
 */
export const readLogTail = (
  key: string,
  lines: number,
): Promise<{ content: string } | { missing: true } | { error: string }> =>
  new Promise((resolve) => {
    const filePath = resolveLogFile(key);
    if (!fs.existsSync(filePath)) {
      resolve({ missing: true });
      return;
    }
    exec(`tail -n ${lines} "${filePath}"`, (err, stdout) => {
      if (err) {
        resolve({ error: err.message });
        return;
      }
      resolve({ content: filePath.endsWith('.jsonl') ? renderJsonlTail(stdout) : stdout });
    });
  });

/**
 * 清空指定日志文件内容
 * @param key - 日志标识符（必须在 LOG_FILES 中注册）
 */
export const clearLogFile = (key: string): void => {
  const filePath = resolveLogFile(key);
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf-8');
  }
};
