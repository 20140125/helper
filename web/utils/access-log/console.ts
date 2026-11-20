/**
 * console 日志落盘
 * @description 劫持 console.log/info/warn/error/debug：保留终端输出的同时，
 *   把每条日志以 JSONL 追加到 scripts/web_console.jsonl，复用 rotation 的按天归档与清理策略。
 *   之所以劫持而不是逐个改调用点：全站 console 调用点几十处且分散在各模块，逐个改既容易漏，
 *   也会让后续新增代码再次漏掉；劫持一次即可覆盖现有与未来的全部调用。
 */

import fs from 'fs';
import path from 'path';
import {
  CONSOLE_LOG_DIR,
  CONSOLE_LOG_FILE,
  CONSOLE_LOG_PREFIX,
  CONSOLE_LOG_SUFFIX,
  type ConsoleLogEntry,
  type ConsoleLogLevel,
  type ConsoleLogQuery,
} from '@/types/access-log';
import { appendLog } from './rotation';
import { formatConsoleArgs, getTimestamp } from './formatter';

/** 需要捕获的 console 级别 */
const CAPTURED_LEVELS: ConsoleLogLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

/** 一天的毫秒数（查询默认窗口） */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 是否已劫持（重复 setup 会层层包装，必须防住） */
let captured = false;

/**
 * 写出一条日志条目
 * @param {ConsoleLogLevel} level - 日志级别
 * @param {unknown[]} args - console 原始参数
 * @returns {void}
 * @description 落盘链路内一律不再调用 console（否则递归），异常直接吞掉：
 *   写日志失败绝不能反过来影响业务。
 */
const writeEntry = (level: ConsoleLogLevel, args: unknown[]): void => {
  try {
    const { message, rest } = formatConsoleArgs(args);
    const now = Date.now();
    const entry: ConsoleLogEntry = {
      ts: now,
      time: getTimestamp(),
      level,
      message,
      args: rest,
    };
    appendLog(JSON.stringify(entry), 'console');
  } catch {
    // 落盘失败静默，不影响业务
  }
};

/**
 * 注册崩溃兜底
 * @returns {void}
 * @description 只接管 uncaughtException：Node 的默认行为本就是打印后退出，这里补一条 JSONL 记录
 *   再退出，行为保持一致而堆栈不会丢。未处理的 Promise 拒绝在 Node 18+ 同样会转成
 *   uncaughtException，因此不单独监听，避免同一个错误落两条。
 */
const setupCrashCapture = (): void => {
  process.on('uncaughtException', (err: Error) => {
    writeEntry('error', ['[uncaught] 未捕获异常，进程即将退出', err]);
    process.exit(1);
  });
};

/**
 * 接管 console 输出并落盘
 * @returns {void}
 * @description 必须在 setupTimestampLogger 之后调用：此时保存的「原始方法」已带时间戳前缀，
 *   终端输出保持原样，而落盘的 message 仍是未经装饰的原始参数。
 */
export const setupConsoleLogCapture = (): void => {
  if (captured) return;
  captured = true;

  setupCrashCapture();

  CAPTURED_LEVELS.forEach((level) => {
    const original = console[level].bind(console) as (...args: unknown[]) => void;
    console[level] = (...args: unknown[]): void => {
      writeEntry(level, args);
      original(...args);
    };
  });
};

/**
 * 解析需要读取的 console 日志文件（当前文件在前，归档按修改时间倒序）
 * @returns {string[]} 日志文件绝对路径列表
 */
const resolveConsoleFiles = (): string[] => {
  const files: string[] = [];
  if (fs.existsSync(CONSOLE_LOG_FILE)) files.push(CONSOLE_LOG_FILE);
  try {
    if (!fs.existsSync(CONSOLE_LOG_DIR)) return files;
    fs.readdirSync(CONSOLE_LOG_DIR)
      .filter((name) => name.startsWith(CONSOLE_LOG_PREFIX) && name.endsWith(CONSOLE_LOG_SUFFIX))
      .map((name) => ({ name, mtimeMs: fs.statSync(path.join(CONSOLE_LOG_DIR, name)).mtimeMs }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .forEach(({ name }) => files.push(path.join(CONSOLE_LOG_DIR, name)));
  } catch {
    // 目录不可读时只返回当前文件
  }
  return files;
};

/**
 * 查询 console 日志
 * @param {ConsoleLogQuery} query - 查询条件
 * @returns {ConsoleLogEntry[]} 命中的日志条目（时间倒序）
 * @description 读取当前文件与全部归档，按条件过滤；损坏行直接忽略，不因一行坏数据丢掉整个文件。
 */
export const listConsoleLogs = (query: ConsoleLogQuery = {}): ConsoleLogEntry[] => {
  const now = Date.now();
  const from = query.from ?? now - DAY_MS;
  const to = query.to ?? now;
  const limit = query.limit ?? 500;
  const keyword = query.keyword?.trim().toLowerCase() ?? '';
  const entries: ConsoleLogEntry[] = [];

  for (const file of resolveConsoleFiles()) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as ConsoleLogEntry;
        if (entry.ts < from || entry.ts > to) continue;
        if (query.level && entry.level !== query.level) continue;
        if (keyword && !entry.message.toLowerCase().includes(keyword)) continue;
        entries.push(entry);
      } catch {
        // 损坏行忽略
      }
    }
  }

  entries.sort((a, b) => b.ts - a.ts);
  return entries.slice(0, limit);
};
