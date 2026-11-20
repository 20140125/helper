/**
 * Access Log 格式化工具
 * @description 日志内容的格式化、截断、深度裁剪等纯函数
 */

/** 响应体美化输出后的最大总长度（超出则对字段值做裁剪） */
const MAX_BODY_PRETTY_LENGTH = 2000;

/** 单个字符串字段值的最大长度（超长的字段值截断，保持 JSON 结构） */
const MAX_FIELD_VALUE_LENGTH = 200;

/**
 * 获取格式化的时间戳
 * @returns 格式：YYYY-MM-DD HH:MM:SS
 */
export const getTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

/**
 * 截断字符串，超出长度用 ... 替代
 */
const truncate = (str: string, maxLen: number): string =>
  str.length > maxLen ? str.slice(0, maxLen) + '...' : str;

/**
 * 深度裁剪对象中过长的字符串字段值和过长的数组
 * 保持 JSON 结构完整，只截断具体的值
 */
const trimDeep = (obj: unknown, depth = 0): unknown => {
  if (depth > 6) return '[...]';

  if (typeof obj === 'string') {
    return obj.length > MAX_FIELD_VALUE_LENGTH
      ? obj.slice(0, MAX_FIELD_VALUE_LENGTH) + '...'
      : obj;
  }

  if (Array.isArray(obj)) {
    const sliced = obj.slice(0, 5).map(item => trimDeep(item, depth + 1));
    if (obj.length > 5) sliced.push(`... 共 ${obj.length} 项`);
    return sliced;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = trimDeep(value, depth + 1);
    }
    return result;
  }

  return obj;
};

/**
 * 把 console 的可变参数拆成「文本消息 + 结构化附加参数」
 * @param {unknown[]} args - console.xxx 收到的原始参数列表
 * @returns {{ message: string, rest: unknown[] }} message 为可直接阅读的文本，rest 为裁剪后的结构化参数
 * @description 字符串 / 数字 / 布尔进 message（人读），对象与 Error 进 args（机读），
 *   Error 额外在 message 里留一句摘要——否则排查时只看消息会漏掉错误类型。
 *   对象统一走 trimDeep 裁剪，避免一个巨大的工具返回值撑爆单条日志。
 */
export const formatConsoleArgs = (args: unknown[]): { message: string; rest: unknown[] } => {
  const parts: string[] = [];
  const rest: unknown[] = [];

  args.forEach((arg) => {
    if (typeof arg === 'string') {
      parts.push(arg);
      return;
    }
    if (arg instanceof Error) {
      parts.push(`${arg.name}: ${arg.message}`);
      rest.push({ name: arg.name, message: arg.message, stack: truncate(arg.stack ?? '', 500) });
      return;
    }
    if (arg === null || arg === undefined || typeof arg !== 'object') {
      parts.push(String(arg));
      return;
    }
    rest.push(trimDeep(arg));
  });

  return { message: parts.join(' '), rest };
};

/**
 * 格式化响应体为易读的字符串
 * - 短小的 JSON 直接美化缩进输出
 * - 超长的 JSON 先对字段值做裁剪，再美化输出，保持结构完整
 */
export const formatBody = (body: unknown): string => {
  try {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    let target: unknown;

    if (raw.length > MAX_BODY_PRETTY_LENGTH) {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      target = trimDeep(parsed);
    } else {
      target = typeof body === 'string' ? JSON.parse(body) : body;
    }

    const pretty = JSON.stringify(target, null, 2);
    return pretty.split('\n').map(line => '  ' + line).join('\n');
  } catch {
    const raw = typeof body === 'string' ? body : String(body);
    return '  ' + truncate(raw, MAX_FIELD_VALUE_LENGTH);
  }
};
