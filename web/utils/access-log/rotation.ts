/**
 * Access Log 日志轮转
 * @description 同时支撑两条日志流，共用一套「按天归档 + 超期清理 + 单文件超限切分」策略：
 *   - access：HTTP 请求访问日志，纯文本区块，scripts/web_access.log
 *   - console：console.* 输出，JSONL（每行一条 JSON），scripts/web_console.jsonl
 *   两条流落在同一个归档目录，靠文件名前缀区分，互不干扰。
 */

import fs from 'fs';
import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';
import {
  CONSOLE_LOG_DIR,
  CONSOLE_LOG_FILE,
  CONSOLE_LOG_PREFIX,
  CONSOLE_LOG_RETENTION_DAYS,
  CONSOLE_LOG_SUFFIX,
} from '@/types/access-log';

/** 日志流标识 */
export type LogStream = 'access' | 'console';

/** access 流：当前正在写入的日志文件 */
const ACCESS_LOG_FILE = path.join(PROJECT_DIR, 'scripts/web_access.log');

/** access 流：归档目录 */
const ACCESS_LOG_DIR = path.join(PROJECT_DIR, 'scripts/logs');

/** access 流：归档文件名前缀 */
const ACCESS_LOG_PREFIX = 'web_access-';

/** access 流：归档文件名后缀 */
const ACCESS_LOG_SUFFIX = '.log';

/** access 流：归档保留天数 */
const ACCESS_LOG_RETENTION_DAYS = 5;

/** 单条日志流的落盘配置 */
interface StreamConfig {
  /** 当前正在写入的文件 */
  file: string;
  /** 归档目录 */
  dir: string;
  /** 归档文件名前缀 */
  prefix: string;
  /** 归档文件名后缀 */
  suffix: string;
  /** 归档保留天数 */
  retentionDays: number;
}

/** 两条日志流的配置表 */
const STREAM_CONFIG: Record<LogStream, StreamConfig> = {
  access: {
    file: ACCESS_LOG_FILE,
    dir: ACCESS_LOG_DIR,
    prefix: ACCESS_LOG_PREFIX,
    suffix: ACCESS_LOG_SUFFIX,
    retentionDays: ACCESS_LOG_RETENTION_DAYS,
  },
  console: {
    file: CONSOLE_LOG_FILE,
    dir: CONSOLE_LOG_DIR,
    prefix: CONSOLE_LOG_PREFIX,
    suffix: CONSOLE_LOG_SUFFIX,
    retentionDays: CONSOLE_LOG_RETENTION_DAYS,
  },
};

/** 单日单文件最大大小（5MB），超出后归档为当天的下一份 */
const MAX_LOG_SIZE = 5 * 1024 * 1024;

/** 轮转检查间隔：每 50 次写入检查一次文件大小，避免频繁 stat */
const ROTATE_CHECK_INTERVAL = 50;

/** 一天的毫秒数（用于保留期换算） */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 每条流各自的写入计数与「活动日期」（跨天与体积检查都按流独立判定） */
const streamState: Record<LogStream, { writeCount: number; activeDayKey: string }> = {
  access: { writeCount: 0, activeDayKey: '' },
  console: { writeCount: 0, activeDayKey: '' },
};

/**
 * 数字补零
 * @param {number} n - 待补零的数字
 * @returns {string} 两位字符串
 */
const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * 取某个日期对应的天 key（YYYY-MM-DD，服务器本地时区）
 * @param {Date} d - 日期对象
 * @returns {string} 形如 2026-10-12 的字符串
 */
const dayKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * 确保目录存在
 * @param {string} dir - 目录绝对路径
 * @returns {void}
 */
const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * 计算下一个可用的归档文件路径
 * @param {string} dayKey - 归档所属日期（YYYY-MM-DD）
 * @param {StreamConfig} cfg - 日志流配置
 * @returns {string} 不冲突的归档文件绝对路径
 * @description 同一天触发多次轮转（体积超限）时依次追加 -1 / -2 序号
 */
const nextArchivePath = (dayKey: string, cfg: StreamConfig): string => {
  ensureDir(cfg.dir);
  let candidate = path.join(cfg.dir, `${cfg.prefix}${dayKey}${cfg.suffix}`);
  let index = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(cfg.dir, `${cfg.prefix}${dayKey}-${index}${cfg.suffix}`);
    index += 1;
  }
  return candidate;
};

/**
 * 把当前日志文件归档到归档目录
 * @param {string} dayKey - 归档文件应归属的日期（YYYY-MM-DD）
 * @param {StreamConfig} cfg - 日志流配置
 * @returns {void}
 * @description 空文件直接删除，不产生空归档；失败不影响业务写入
 */
const archiveCurrentLog = (dayKey: string, cfg: StreamConfig): void => {
  try {
    if (!fs.existsSync(cfg.file)) return;
    if (fs.statSync(cfg.file).size === 0) {
      fs.unlinkSync(cfg.file);
      return;
    }
    fs.renameSync(cfg.file, nextArchivePath(dayKey, cfg));
  } catch {
    // 归档失败不阻塞业务
  }
};

/**
 * 当前日志文件所属的日期 key
 * @param {StreamConfig} cfg - 日志流配置
 * @returns {string} YYYY-MM-DD；文件不存在时取今天
 * @description rename 会保留 mtime，故归档文件的修改时间即其最后写入日，保留期判定准确
 */
const currentFileDayKey = (cfg: StreamConfig): string => {
  try {
    if (fs.existsSync(cfg.file)) {
      return dayKeyOf(fs.statSync(cfg.file).mtime);
    }
  } catch {
    // 读取失败按今天处理
  }
  return dayKeyOf(new Date());
};

/**
 * 清理超过保留天数的历史归档
 * @param {LogStream} stream - 日志流标识
 * @returns {number} 本次删除的归档文件数
 * @description 按文件修改时间判定：超过该流的保留天数即删除；
 *   每次跨天时随归档一起执行，无需额外定时器
 */
export const cleanExpiredArchives = (stream: LogStream = 'access'): number => {
  const cfg = STREAM_CONFIG[stream];
  let removed = 0;
  try {
    if (!fs.existsSync(cfg.dir)) return removed;
    const maxAge = cfg.retentionDays * DAY_MS;
    const now = Date.now();
    for (const name of fs.readdirSync(cfg.dir)) {
      if (!name.startsWith(cfg.prefix) || !name.endsWith(cfg.suffix)) continue;
      const filePath = path.join(cfg.dir, name);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs <= maxAge) continue;
      fs.unlinkSync(filePath);
      removed += 1;
    }
  } catch {
    // 清理失败不影响写入
  }
  return removed;
};

/**
 * 取最新一份归档文件（供日志查看器展示「历史」）
 * @param {LogStream} stream - 日志流标识
 * @returns {string | null} 最新归档的绝对路径；无归档时返回 null
 */
export const getLatestArchivePath = (stream: LogStream = 'access'): string | null => {
  const cfg = STREAM_CONFIG[stream];
  try {
    if (!fs.existsSync(cfg.dir)) return null;
    const latest = fs
      .readdirSync(cfg.dir)
      .filter((name) => name.startsWith(cfg.prefix) && name.endsWith(cfg.suffix))
      .map((name) => ({ name, mtimeMs: fs.statSync(path.join(cfg.dir, name)).mtimeMs }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    return latest ? path.join(cfg.dir, latest.name) : null;
  } catch {
    return null;
  }
};

/**
 * 将一条日志追加写入指定日志流的文件
 * @param {string} block - 已格式化的日志内容（access 为文本区块，console 为单行 JSON）
 * @param {LogStream} stream - 日志流标识，默认 access
 * @returns {void}
 * @description 写入前先做跨天检查：若当前文件属于昨天及以前，先按天归档再重新写入今天的文件；
 *   每写入 ROTATE_CHECK_INTERVAL 次检查一次体积，超限则归档为当天多份
 */
export const appendLog = (block: string, stream: LogStream = 'access'): void => {
  const cfg = STREAM_CONFIG[stream];
  const state = streamState[stream];
  try {
    ensureDir(path.dirname(cfg.file));
    const today = dayKeyOf(new Date());

    if (state.activeDayKey !== today) {
      state.activeDayKey = today;
      const fileDay = currentFileDayKey(cfg);
      if (fileDay !== today) {
        archiveCurrentLog(fileDay, cfg);
      }
      cleanExpiredArchives(stream);
    }

    state.writeCount += 1;
    if (state.writeCount >= ROTATE_CHECK_INTERVAL) {
      state.writeCount = 0;
      if (fs.existsSync(cfg.file) && fs.statSync(cfg.file).size >= MAX_LOG_SIZE) {
        archiveCurrentLog(today, cfg);
      }
    }

    fs.appendFileSync(cfg.file, block + '\n', 'utf-8');
  } catch {
    // 写日志失败不应影响业务
  }
};
