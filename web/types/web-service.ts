import path from 'path';
import { WEB_DIR, SCRIPTS_DIR, RUNTIME_DIR } from '@/utils/paths';

export { WEB_DIR, RUNTIME_DIR };

/** Web 服务启动脚本路径（缺失时改用 Node 直接拉起 server.ts） */
export const WEB_SCRIPT = path.join(SCRIPTS_DIR, 'start_web.sh');

/** Web 服务 PID 文件路径 */
export const PID_FILE = path.join(RUNTIME_DIR, 'web.pid');

/** Web 启动器 PID 文件路径 */
export const LAUNCHER_PID_FILE = path.join(RUNTIME_DIR, 'launcher.pid');

/** 旧版 PID 文件路径（scripts/web.pid，读取时兼容历史部署） */
export const LEGACY_PID_FILE = path.join(SCRIPTS_DIR, 'web.pid');

/** 旧版启动器 PID 文件路径（scripts/launcher.pid，读取时兼容历史部署） */
export const LEGACY_LAUNCHER_PID_FILE = path.join(SCRIPTS_DIR, 'launcher.pid');

/** Web 服务后台日志路径（无 start_web.sh 时由 Node 兜底启动写入） */
export const WEB_LOG_FILE = path.join(RUNTIME_DIR, 'web_server.jsonl');

/** Web 启动器后台日志路径 */
export const LAUNCHER_LOG_FILE = path.join(RUNTIME_DIR, 'web_launcher.log');

/** Launcher 监听的 Web 服务端口 */
export const WEB_PORT = 9527;

/**
 * 各操作对应的超时时间（毫秒）
 * restart 需要等待旧进程退出（最多 10 秒）+ 新进程启动（最多 15 秒），给足 60 秒
 */
export const ACTION_TIMEOUT: Record<string, number> = {
  start: 30000,
  stop: 15000,
  restart: 60000,
};

/**
 * 停止指令下发后延迟执行的毫秒数
 * @description 停止会杀掉当前进程（9527 自身），先响应客户端再真正 kill，避免响应发不出去
 */
export const STOP_ACTION_DELAY = 200;

/** Launcher 执行启动/停止操作的默认超时（毫秒） */
export const LAUNCHER_ACTION_TIMEOUT = 30000;

/** Launcher 执行重启的超时（毫秒） */
export const LAUNCHER_RESTART_TIMEOUT = 120000;

/** 重启指令立即响应后，延迟执行脚本的时间（毫秒） */
export const LAUNCHER_RESTART_DELAY = 200;

/**
 * 重启延迟上限（毫秒）
 * @description AI 助手触发重启时需要留出「说完结论 + 会话落盘」的时间，
 *              但也不允许无限延期导致指令悬空，故钳在 60 秒内
 */
export const LAUNCHER_RESTART_MAX_DELAY = 60000;


/**
 * Web 服务进程运行状态信息
 */
export interface WebServiceStatus {
  running: boolean;
  pid: number | null;
  launcherPid: number | null;
}