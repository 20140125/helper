import { setupConsoleLogCapture } from './access-log';

/**
 * 为所有 console 输出加上时间戳前缀，与脚本日志格式保持一致
 * 格式：[YYYY-MM-DD HH:MM:SS]
 */
const getTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}] [INFO]`;
};

/**
 * 设置 console 输出时间戳
 * @description 为 console 输出加上时间戳前缀，与脚本日志格式保持一致
 */
export const setupTimestampLogger = (): void => {
  const _log = console.log.bind(console);
  const _error = console.error.bind(console);
  const _warn = console.warn.bind(console);

  console.log = (...args: unknown[]) => _log(getTimestamp(), ...args);
  console.error = (...args: unknown[]) => _error(getTimestamp(), ...args);
  console.warn = (...args: unknown[]) => _warn(getTimestamp(), ...args);

  // 必须放在上面的替换之后：此时被接管的「原始方法」已带时间戳前缀，
  // 终端输出保持原样，而落盘拿到的是未经装饰的原始参数
  setupConsoleLogCapture();
};
