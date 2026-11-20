import type { SystemStatus, DaemonActionResult } from '@/types/status';
import { BaseService } from './base-service';

/**
 * 系统状态服务类
 * @description 封装系统状态查询和守护进程控制相关的API接口，提供统一的服务管理
 */
export class StatusService extends BaseService {
  /**
   * 获取系统状态信息
   * @returns {Promise<SystemStatus>} 系统状态信息对象
   * @description 查询当前系统的运行状态，包括守护进程状态、服务器时间、系统信息等
   * @example
   * const statusService = new StatusService();
   * const status = await statusService.fetchStatus();
   * console.log(status.daemonRunning); // 守护进程是否运行
   * console.log(status.serverTime);    // 服务器当前时间
   */
  fetchStatus = async (): Promise<SystemStatus> => {
    return this.get<SystemStatus>('/system');
  };

  /**
   * 启动守护进程
   * @returns {Promise<{code: number; message: string; stdout?: string}>} 启动结果对象
   * @description 启动系统守护进程，返回启动结果和可能的输出信息
   * @property {number} code - 状态码，0 表示成功
   * @property {string} message - 启动结果消息
   * @property {string} [stdout] - 启动过程中的标准输出（可选）
   * @example
   * const result = await statusService.startDaemon();
   * if (result.code === 0) {
   *   console.log('守护进程启动成功');
   * } else {
   *   console.error('启动失败:', result.message);
   * }
   */
  startDaemon = async (): Promise<DaemonActionResult> => {
    return this.post<DaemonActionResult>('/daemon/start');
  };

  /**
   * 停止守护进程
   * @returns {Promise<{code: number; message: string}>} 停止结果对象
   * @description 停止系统守护进程，返回停止结果信息
   * @property {number} code - 状态码，0 表示成功
   * @property {string} message - 停止结果消息
   * @example
   * const result = await statusService.stopDaemon();
   * if (result.code === 0) {
   *   console.log('守护进程已停止');
   * } else {
   *   console.error('停止失败:', result.message);
   * }
   */
  stopDaemon = async (): Promise<DaemonActionResult> => {
    return this.post<DaemonActionResult>('/daemon/stop');
  };

  /**
   * 重启守护进程
   * @returns {Promise<{code: number; message: string; stdout?: string}>} 重启结果对象
   * @description 重启系统守护进程，返回重启结果和可能的输出信息
   * @property {number} code - 状态码，0 表示成功
   * @property {string} message - 重启结果消息
   * @property {string} [stdout] - 重启过程中的标准输出（可选）
   * @example
   * const result = await statusService.restartDaemon();
   * if (result.code === 0) {
   *   console.log('守护进程重启成功');
   * } else {
   *   console.error('重启失败:', result.message);
   * }
   */
  restartDaemon = async (): Promise<DaemonActionResult> => {
    return this.post<DaemonActionResult>('/daemon/restart');
  };
}

/**
 * 创建状态服务实例的工厂函数
 * @description 提供StatusService类的单例实例，确保服务实例的一致性
 * @returns {StatusService} 状态服务实例
 */
export const createStatusService = (): StatusService => {
  return new StatusService();
};

/**
 * 默认导出的状态服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createStatusService工厂函数
 */
export default createStatusService();
