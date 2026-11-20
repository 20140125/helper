import path from 'path';
import { PROJECT_DIR } from '@/routes/utils';

/** 守护进程脚本路径 */
export const DAEMON_SCRIPT = path.join(PROJECT_DIR, 'scripts/daemon.sh');

/** 各操作对应的成功提示文案 */
export const ACTION_MESSAGE: Record<string, string> = {
  start: '守护进程已启动',
  stop: '守护进程已停止',
  restart: '守护进程已重启',
};

/**
 * 各操作对应的超时时间（毫秒）
 * restart 需要依次停止 daemon + annual（各含 sleep 2+1）、sleep 1、再启动两者（各最多 8 秒轮询 PID 文件），
 * 最坏累计约 23 秒，给足 45 秒余量
 */
export const ACTION_TIMEOUT: Record<string, number> = {
  start: 15000,
  stop: 10000,
  restart: 45000,
};
