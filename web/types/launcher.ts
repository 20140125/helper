/**
 * Launcher 视角下的 Web 服务运行状态
 */
export interface LauncherStatus {
  running: boolean;
  pid: number | null;
}
