/**
 * 路径常量与解析
 *
 * 背景：各脚本原先各自用 `path.join(__dirname, '../../web/frontend/src')` 定位源码，
 * 但 __dirname 是 `.codebuddy/skills/helper-web-spec/scripts`，两级上溯只到
 * `.codebuddy/skills/` —— 解析出的 `.codebuddy/skills/web/frontend/src` 根本不存在，
 * 结果是要么 statSync 抛 ENOENT 崩溃，要么被 existsSync 保护后"静默通过"（假阴性）。
 * 统一在这里算，避免再次写错层级。
 */

import fs from 'fs';
import path from 'path';

/** 项目根（helper）：lib → scripts → helper-web-spec → skills → .codebuddy → helper */
export const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');

/** web 目录（前后端同仓） */
export const WEB_DIR = path.join(PROJECT_ROOT, 'web');

/** 前端源码根 */
export const FRONTEND_SRC = path.join(WEB_DIR, 'frontend', 'src');

/** 前端源码下的子路径：frontendPath('models') → .../src/models */
export const frontendPath = (...segments: string[]): string => path.join(FRONTEND_SRC, ...segments);

/**
 * 解析扫描目标目录
 *
 * npm 别名在 web/ 下执行并传 `frontend/src`，手动跑又可能传 `web/frontend/src` 或绝对路径，
 * 这里依次按三种基准尝试，取第一个真实存在的目录。
 * @param target - 目标路径（相对或绝对）
 * @returns 解析后的绝对路径；都不存在时返回 null
 */
export const resolveTargetDir = (target: string): string | null => {
  if (!target) return null;
  const candidates = [
    path.resolve(target),
    path.resolve(process.cwd(), target),
    path.resolve(PROJECT_ROOT, target),
    path.resolve(WEB_DIR, target),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
};

/**
 * 解析扫描目标（文件或目录）
 * @returns 解析后的绝对路径；不存在时返回 null
 */
export const resolveTargetPath = (target: string): string | null => {
  if (!target) return null;
  const candidates = [
    path.resolve(target),
    path.resolve(process.cwd(), target),
    path.resolve(PROJECT_ROOT, target),
    path.resolve(WEB_DIR, target),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

/** 打印用相对路径（相对项目根，避免输出一长串绝对路径） */
export const displayPath = (filePath: string): string => path.relative(PROJECT_ROOT, filePath) || filePath;
