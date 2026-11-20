import fs from 'fs';
import { execFile } from 'child_process';
import type { ScriptResult } from '@/types/script';
import { PROJECT_DIR, SCRIPTS_DIR } from './paths';
import path from 'path';

export type { ScriptResult } from '@/types/script';

/**
 * 香港时区下的日期时间格式化器，输出 `YYYY-MM-DD HH:mm:ss` 格式
 * @description 使用 `en-CA` 是为了让 `Intl.DateTimeFormat` 输出稳定的 `YYYY-MM-DD` 日期分隔；
 *   `zh-CN` 在 Node 不同版本下会输出 `2026/5/29` 这种带 `/` 且不补零的格式，故不可用。
 */
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Hong_Kong',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * 格式化日期为本地时间字符串（香港时区，`YYYY-MM-DD HH:mm:ss`）
 * @param {Date} date - 要格式化的日期，默认为当前时间
 * @returns {string} 格式化后的时间字符串
 */
export const formatDate = (date: Date = new Date()): string => {
  const parts = DATE_FORMATTER.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
};

/**
 * 去除字符串中的 ANSI 转义码（颜色、样式、光标控制等）
 * 覆盖：SGR 颜色/样式、光标移动、清屏清行、字符集切换等所有常见序列
 * @param {string} str - 可能包含 ANSI 转义码的字符串
 * @returns {string} 去除 ANSI 转义码后的纯文本
 */
const stripAnsi = (str: string): string =>
  str.replace(
    // eslint-disable-next-line no-control-regex -- ANSI 转义码本身就是控制字符，只能按码点匹配
    /[\x1b\x9b][[\]()#;?]*(?:(?:(?:;[-\w/#&.:=?%@~])*|[a-zA-Z\d]*(?:;[-\w/#&.:=?%@~]*)*)?\x07|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g,
    '',
  );

/**
 * 安全执行 shell 脚本（限制在项目目录内）
 * @param {string} scriptName - 脚本相对路径（相对于项目根目录）
 * @param {string[]} args - 脚本参数列表
 * @param {Record<string, string>} extraEnv - 额外注入的环境变量（例如 PUSH_CARD_IMAGE=1）
 * @param {number} timeoutMs - 超时毫秒数，默认 30s；慢技能取数（如 HN AI 新闻要逐条拉接口）
 *   可能超过 30s，调用方可按需放宽
 * @returns {Promise<ScriptResult>} 脚本执行结果
 */
export const runScript = (
  scriptName: string,
  args: string[] = [],
  extraEnv: Record<string, string> = {},
  timeoutMs = 30000,
): Promise<ScriptResult> => {
  return new Promise((resolve, reject) => {
    // 脚本目录整体缺失时给出明确结论，避免各脚本逐个报「脚本不存在」
    if (!fs.existsSync(SCRIPTS_DIR)) {
      return reject(new Error(`脚本目录不存在: scripts/（Web 服务本身不依赖它，但提醒与工具脚本不可用）`));
    }
    const scriptPath = path.join(PROJECT_DIR, scriptName);
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`脚本不存在: ${scriptName}`));
    }
    execFile(
      'bash',
      [scriptPath, ...args],
      {
        cwd: PROJECT_DIR,
        timeout: timeoutMs,
        env: { ...process.env, PROJECT_DIR, ...extraEnv },
      },
      (err, stdout, stderr) => {
        if (err && !stderr && !stdout) {
          // 脚本文件不存在或无法执行（非脚本内部错误）
          const code = (err as { code?: number | string }).code;
          const firstLine = err.message.split('\n')[0] ?? err.message;
          return reject(
            new Error(`脚本执行失败（exit=${code ?? '未知'}，无任何输出）：${firstLine}`),
          );
        }
        // 脚本执行完成（包括非零退出码），去除 ANSI 转义码后返回给调用方
        resolve({
          stdout: stripAnsi(stdout ?? ''),
          stderr: stripAnsi(stderr ?? ''),
        });
      },
    );
  });
};
