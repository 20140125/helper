import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { PROJECT_DIR } from '@/routes/utils';
import { UpdateToolScript } from '@/types/update-tools';

/**
 * 校验必填参数是否完整
 * @param params - 参数定义列表
 * @param strArgs - 字符串化后的实际参数列表
 * @returns 缺失的必填参数标签，无缺失时返回 null
 */
export const validateRequiredArgs = (
  params: UpdateToolScript['params'],
  strArgs: string[],
): string | null => {
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    if (param.required && (!strArgs[i] || strArgs[i].trim() === '')) {
      return param.label;
    }
  }
  return null;
};

/**
 * 构建脚本最终参数列表
 * @param toolInfo - 脚本配置信息
 * @param strArgs - 字符串化后的用户传入参数
 * @returns 最终传给脚本的参数数组
 */
export const buildFinalArgs = (toolInfo: UpdateToolScript, strArgs: string[]): string[] => {
  if (typeof toolInfo.autoArgs === 'function') {
    const year = String(new Date().getFullYear());
    return toolInfo.autoArgs(strArgs, year);
  }
  // 过滤末尾空参数
  const filtered = [...strArgs];
  while (filtered.length > 0 && (!filtered[filtered.length - 1] || filtered[filtered.length - 1].trim() === '')) {
    filtered.pop();
  }
  return filtered;
};

/**
 * 解析 update-tools 脚本的绝对路径
 * @param toolInfo - 脚本配置信息
 * @returns 脚本绝对路径
 */
export const resolveUpdateScriptPath = (toolInfo: UpdateToolScript): string =>
  path.join(PROJECT_DIR, toolInfo.filename);

/**
 * 判断脚本文件是否存在
 * @param scriptPath - 脚本绝对路径
 * @returns 存在返回 true
 */
export const updateScriptExists = (scriptPath: string): boolean => fs.existsSync(scriptPath);

/**
 * 执行指定路径的 bash 脚本
 * @param scriptPath - 脚本绝对路径
 * @param finalArgs - 传给脚本的参数列表
 * @returns 脚本执行结果 { stdout, stderr }
 */
export const execUpdateScript = (scriptPath: string, finalArgs: string[]): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(
      'bash',
      [scriptPath, ...finalArgs],
      {
        cwd: PROJECT_DIR,
        timeout: 120000,
        env: { ...process.env, PROJECT_DIR },
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
