import type { LogsResponse, LogContentResponse, LogResult } from '@/types/log';
import { BaseService } from './base-service';

/**
 * 日志服务类
 * @description 封装日志文件管理相关的API接口，提供统一的日志服务管理
 */
export class LogService extends BaseService {
  /**
   * 获取日志文件列表
   * @returns {Promise<{code: number; logs: LogItem[]}>} 日志列表结果对象
   * @description 查询系统中所有可用的日志文件信息
   * @property {number} code - 状态码，0 表示成功
   * @property {LogItem[]} logs - 日志文件列表数组
   * @example
   * const logService = new LogService();
   * const result = await logService.fetchLogs();
   * if (result.code === 0) {
   *   result.logs.forEach(log => {
   *     console.log(log.key, log.size, log.modifiedTime);
   *   });
   * }
   */
  fetchLogs = async (): Promise<LogsResponse> => {
    return this.get<LogsResponse>('/logs');
  };

  /**
   * 获取日志文件内容
   * @param {string} key - 日志文件标识符
   * @param {number} [lines=200] - 要获取的行数，默认为200行
   * @returns {Promise<{code: number; content: string; message?: string}>} 日志内容结果对象
   * @description 获取指定日志文件的内容，支持按行数限制返回内容
   * @property {number} code - 状态码，0 表示成功
   * @property {string} content - 日志文件内容
   * @property {string} [message] - 错误信息（可选）
   * @example
   * const result = await logService.fetchLogContent('system.log', 100);
   * if (result.code === 0) {
   *   console.log('日志内容:', result.content);
   * } else {
   *   console.error('获取失败:', result.message);
   * }
   */
  fetchLogContent = async (key: string, lines: number = 200): Promise<LogContentResponse> => {
    return this.get<LogContentResponse>(`/logs/${key}`, { params: { lines } });
  };

  /**
   * 清空指定日志文件
   * @param {string} key - 日志文件标识符
   * @returns {Promise<{code: number; message: string}>} 清空结果对象
   * @description 删除指定日志文件的内容，将文件清空
   * @property {number} code - 状态码，0 表示成功
   * @property {string} message - 操作结果消息
   * @example
   * const result = await logService.removeLog('system.log');
   * if (result.code === 0) {
   *   console.log('日志已清空');
   * } else {
   *   console.error('清空失败:', result.message);
   * }
   */
  removeLog = async (key: string): Promise<LogResult> => {
    return this.del<LogResult>(`/logs/${key}`);
  };
}

/**
 * 创建日志服务实例的工厂函数
 * @description 提供LogService类的单例实例，确保服务实例的一致性
 * @returns {LogService} 日志服务实例
 */
export const createLogService = (): LogService => {
  return new LogService();
};

/**
 * 默认导出的日志服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createLogService工厂函数
 */
export default createLogService();
