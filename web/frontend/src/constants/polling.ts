/**
 * 轮询间隔常量（毫秒）
 * @description 统一管理各模块的轮询频率，避免魔法数字
 */

/** Web服务状态轮询间隔（60秒） */
export const WEB_SERVICE_STATUS_POLL_MS = 60_000;

/** 系统状态轮询间隔（30秒） */
export const SYSTEM_STATUS_POLL_MS = 30_000;

/** 服务器时间本地推进间隔（1秒） */
export const SERVER_TIME_TICK_MS = 1_000;
