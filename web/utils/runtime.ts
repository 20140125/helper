import fs from 'fs';
import { RUNTIME_DIR } from '@/utils/paths';

/**
 * 确保 Web 运行时目录存在（web/.runtime）
 * @returns {string} 运行时目录绝对路径
 * @description PID 文件与后台日志都落在这里；目录缺失时自动创建，
 *   保证在没有 scripts/ 目录的环境下也能正常启停
 */
export const ensureRuntimeDir = (): string => {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
  return RUNTIME_DIR;
};

/**
 * 解析实际可用的 PID 文件路径
 * @param {string} pidFile - 当前 PID 文件路径（web/.runtime/）
 * @param {string} [legacyPidFile] - 旧路径（scripts/），用于兼容历史部署
 * @returns {string} 优先返回已存在的路径，都不存在时返回当前路径
 */
export const resolvePidFile = (pidFile: string, legacyPidFile?: string): string => {
  if (fs.existsSync(pidFile)) return pidFile;
  if (legacyPidFile && fs.existsSync(legacyPidFile)) return legacyPidFile;
  return pidFile;
};

/**
 * 安全读取 PID 文件内容
 * @param {string} pidFile - 当前 PID 文件路径
 * @param {string} [legacyPidFile] - 旧 PID 文件路径（当前路径不存在时回退）
 * @returns {number | null} PID 数字，读取失败或文件不存在返回 null
 */
export const readPidFile = (pidFile: string, legacyPidFile?: string): number | null => {
  const target = resolvePidFile(pidFile, legacyPidFile);
  try {
    const parsed = parseInt(fs.readFileSync(target, 'utf-8').trim(), 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
};
