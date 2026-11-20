import path from 'path';

/** 项目根目录（web/ 的上级目录） */
export const PROJECT_DIR = path.resolve(__dirname, '../..');

/** Web 服务目录路径 */
export const WEB_DIR = path.join(PROJECT_DIR, 'web');

/** Shell 脚本目录路径（提醒业务主逻辑；缺失时 Web 侧功能降级，不影响启动） */
export const SCRIPTS_DIR = path.join(PROJECT_DIR, 'scripts');

/**
 * Web 运行时目录路径（web/.runtime）
 * @description 存放 Web 服务与启动器的 PID 文件、后台日志，
 *   放在 web/ 内是为了让 Web 在缺少 scripts/ 目录时也能独立启停
 */
export const RUNTIME_DIR = path.join(WEB_DIR, '.runtime');

/** 缓存目录路径 */
export const CACHE_DIR = path.join(PROJECT_DIR, '.cache');
