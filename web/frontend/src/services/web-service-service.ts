import type { WebServiceResult, WebServiceStatus } from '@/types/web-service';
import axios from 'axios';
import { BaseService } from './base-service';

/**
 * Web服务管理类
 * @description 封装Web服务状态查询和控制相关的API接口，支持通过主服务和独立launcher两种方式操作
 */
export class WebServiceService extends BaseService {
  /**
   * 获取Web服务状态
   * @param {number} [timeout] - 请求超时时间（毫秒）
   * @returns {Promise<WebServiceStatus>} Web服务状态信息
   * @description 通过主服务API查询Web服务的运行状态和进程ID
   * @example
   * const webService = new WebServiceService();
   * const status = await webService.fetchWebServiceStatus(5000);
   * console.log('服务运行状态:', status.running);
   * console.log('进程ID:', status.pid);
   */
  fetchWebServiceStatus = async (timeout?: number): Promise<WebServiceStatus> => {
    return this.get<WebServiceStatus>('/web-service/status', { timeout });
  };

  /**
   * 启动Web服务（通过主服务API）
   * @returns {Promise<WebServiceResult>} 启动结果对象
   * @description 通过主服务API启动Web服务，适用于Web服务已停止但主服务仍在运行的情况
   * @example
   * const result = await webService.startWebService();
   * if (result.code === 0) {
   *   console.log('Web服务启动成功');
   * } else {
   *   console.error('启动失败:', result.message);
   * }
   */
  startWebService = async (): Promise<WebServiceResult> => {
    return this.post<WebServiceResult>('/web-service/start');
  };

  /**
   * 停止Web服务
   * @returns {Promise<WebServiceResult>} 停止结果对象
   * @description 通过主服务API停止Web服务
   * @example
   * const result = await webService.stopWebService();
   * if (result.code === 0) {
   *   console.log('Web服务已停止');
   * } else {
   *   console.error('停止失败:', result.message);
   * }
   */
  stopWebService = async (): Promise<WebServiceResult> => {
    return this.post<WebServiceResult>('/web-service/stop');
  };

  /**
   * 重启Web服务
   * @returns {Promise<WebServiceResult>} 重启结果对象
   * @description 通过主服务API重启Web服务，设置60秒超时以等待重启完成
   * @example
   * const result = await webService.restartWebService();
   * if (result.code === 0) {
   *   console.log('Web服务重启成功');
   * } else {
   *   console.error('重启失败:', result.message);
   * }
   */
  restartWebService = async (): Promise<WebServiceResult> => {
    return this.post<WebServiceResult>('/web-service/restart', null, { timeout: 60000 });
  };

  /**
   * 通过独立launcher进程启动Web服务
   * @returns {Promise<WebServiceResult>} 启动结果对象
   * @description 当主服务（9527端口）已停止时，通过独立的launcher进程（3001端口）的 /api/launcher/start 接口启动Web服务
   * @example
   * const result = await webService.startWebServiceViaLauncher();
   * if (result.code === 0) {
   *   console.log('通过launcher启动成功');
   * } else {
   *   console.error('启动失败:', result.message);
   * }
   */
  startWebServiceViaLauncher = async (): Promise<WebServiceResult> => {
    const launcherBase = `${window.location.protocol}//${window.location.hostname}:3001`;
    const response = await axios.post<WebServiceResult>(`${launcherBase}/api/launcher/start`, null, { timeout: 30000 });
    return response.data;
  };

  /**
   * 通过launcher进程重启Web服务
   * @returns {Promise<WebServiceResult>} 重启结果对象
   * @description launcher通过 /api/launcher/restart 接口立即响应后异步执行重启，避免通过9527端口自身重启导致请求断开
   * @example
   * const result = await webService.restartWebServiceViaLauncher();
   * if (result.code === 0) {
   *   console.log('通过launcher重启成功');
   * } else {
   *   console.error('重启失败:', result.message);
   * }
   */
  restartWebServiceViaLauncher = async (): Promise<WebServiceResult> => {
    const launcherBase = `${window.location.protocol}//${window.location.hostname}:3001`;
    const response = await axios.post<WebServiceResult>(`${launcherBase}/api/launcher/restart`, null, { timeout: 5000 });
    return response.data;
  };

  /**
   * 通过launcher进程查询Web服务状态
   * @returns {Promise<WebServiceStatus>} Web服务状态信息
   * @description 重启期间9527端口不可用时，通过3001端口的 /api/launcher/status 接口轮询，避免连接断开问题
   * @example
   * const status = await webService.fetchWebServiceStatusViaLauncher();
   * console.log('通过launcher查询状态:', status.running);
   */
  fetchWebServiceStatusViaLauncher = async (): Promise<WebServiceStatus> => {
    const launcherBase = `${window.location.protocol}//${window.location.hostname}:3001`;
    const response = await axios.get<WebServiceStatus>(`${launcherBase}/api/launcher/status`, { timeout: 3000 });
    return response.data;
  };
}

/**
 * 创建Web服务实例的工厂函数
 * @description 提供WebServiceService类的单例实例，确保服务实例的一致性
 * @returns {WebServiceService} Web服务实例
 */
export const createWebServiceService = (): WebServiceService => {
  return new WebServiceService();
};

/**
 * 默认导出的Web服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createWebServiceService工厂函数
 */
export default createWebServiceService();
