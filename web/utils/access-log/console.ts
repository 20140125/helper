/**
 * console 日志捕获
 * @description 劫持 console.log/info/warn/error/debug：保留终端输出的同时，
 *   把每条日志交给 rotation.appendLog 写入 hp_run_logs。
 *   之所以劫持而不是逐个改调用点：全站 console 调用点几十处且分散在各模块，
 *   逐个改既容易漏，也会让后续新增代码再次漏掉；劫持一次即可覆盖现有与未来的全部调用。
 */

import { appendLog } from './rotation';
import { flushRunLogs } from '@/utils/run-log';
import { formatConsoleArgs, getTimestamp } from './formatter';
import type { ConsoleLogLevel } from '@/types/access-log';

/** 需要捕获的 console 级别 */
const CAPTURED_LEVELS: ConsoleLogLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

/** 是否已劫持（重复 setup 会层层包装，必须防住） */
let captured = false;

/**
 * 写出一条日志条目
 * @param {ConsoleLogLevel} level - 日志级别
 * @param {unknown[]} args - console 原始参数
 * @returns {void}
 * @description 入库链路内一律不再调用 console（否则递归），异常直接吞掉：
 *   写日志失败绝不能反过来影响业务。
 */
const writeEntry = (level: ConsoleLogLevel, args: unknown[]): void => {
  try {
    const { message, rest } = formatConsoleArgs(args);
    const now = Date.now();
    appendLog(JSON.stringify({
      ts: now,
      time: getTimestamp(),
      level,
      message,
      args: rest,
    }), 'console');
  } catch {
    // 入库失败静默，不影响业务
  }
};

/**
 * 注册崩溃兜底
 * @returns {void}
 * @description 只接管 uncaughtException：Node 的默认行为本就是打印后退出，这里补一条记录
 *   再退出，行为保持一致而堆栈不会丢。写入是异步的，退出前先排空在途任务；
 *   另加 1.5 秒兜底定时器，避免数据库不可达时进程卡死不退出。
 */
const setupCrashCapture = (): void => {
  process.on('uncaughtException', (err: Error) => {
    writeEntry('error', ['[uncaught] 未捕获异常，进程即将退出', err]);
    const timer = setTimeout(() => process.exit(1), 1500);
    timer.unref();
    void flushRunLogs().finally(() => process.exit(1));
  });
};

/**
 * 接管 console 输出并入库
 * @returns {void}
 * @description 必须在 setupTimestampLogger 之后调用：此时保存的「原始方法」已带时间戳前缀，
 *   终端输出保持原样，而入库的 message 仍是未经装饰的原始参数。
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
