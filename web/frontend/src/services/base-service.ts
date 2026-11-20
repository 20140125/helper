import http from './http';
import type { AxiosRequestConfig } from 'axios';

/**
 * Service 基类
 * @description 封装所有 Service 共享的 HTTP 客户端和通用请求方法，子类通过继承复用
 *
 * 提供的通用能力：
 * - `httpClient`：统一的 axios 实例（基于 `http.ts` 封装，自带 JWT 注入和错误拦截）
 * - `get` / `post` / `put` / `del`：HTTP 快捷方法，自动解包 `response.data`
 *
 * 子类使用方式：
 * ```typescript
 * export class MyService extends BaseService {
 *   fetchList = async (): Promise<ListResponse> => {
 *     return this.get<ListResponse>('/my-resource');
 *   };
 *
 *   createItem = async (payload: ItemPayload): Promise<ItemResponse> => {
 *     return this.post<ItemResponse>('/my-resource', payload);
 *   };
 * }
 * ```
 *
 * 如需传递额外的 axios 配置（如自定义 timeout、params），可通过 config 参数：
 * ```typescript
 * fetchWithTimeout = async (): Promise<DataResponse> => {
 *   return this.get<DataResponse>('/slow-endpoint', { timeout: 60000 });
 * };
 *
 * fetchWithParams = async (lines: number): Promise<ContentResponse> => {
 *   return this.get<ContentResponse>('/logs/system', { params: { lines } });
 * };
 * ```
 */
export class BaseService {
  /**
   * HTTP 客户端实例
   * @type {typeof http}
   * @description 基于 axios 封装的统一 HTTP 客户端，自带 JWT Token 注入和 401/403 错误拦截
   */
  protected httpClient: typeof http = http;

  // ==============================
  // HTTP 快捷方法
  // ==============================

  /**
   * 发送 GET 请求
   * @param {string} url - 请求路径（基于 /api 前缀）
   * @param {AxiosRequestConfig} [config] - 可选的 axios 请求配置（如 params、timeout）
   * @returns {Promise<T>} 自动解包后的响应数据
   * @description 封装 axios get 并在拦截后返回 response.data，避免子类重复写解包逻辑
   */
  protected get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await this.httpClient.get<T>(url, config);
    return response.data;
  };

  /**
   * 发送 POST 请求
   * @param {string} url - 请求路径
   * @param {unknown} [data] - 请求体数据
   * @param {AxiosRequestConfig} [config] - 可选的 axios 请求配置
   * @returns {Promise<T>} 自动解包后的响应数据
   * @description 封装 axios post 并在拦截后返回 response.data
   */
  protected post = async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await this.httpClient.post<T>(url, data, config);
    return response.data;
  };

  /**
   * 发送 PUT 请求
   * @param {string} url - 请求路径
   * @param {unknown} [data] - 请求体数据
   * @param {AxiosRequestConfig} [config] - 可选的 axios 请求配置
   * @returns {Promise<T>} 自动解包后的响应数据
   * @description 封装 axios put 并在拦截后返回 response.data
   */
  protected put = async <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await this.httpClient.put<T>(url, data, config);
    return response.data;
  };

  /**
   * 发送 DELETE 请求
   * @param {string} url - 请求路径
   * @param {AxiosRequestConfig} [config] - 可选的 axios 请求配置
   * @returns {Promise<T>} 自动解包后的响应数据
   * @description 封装 axios delete 并在拦截后返回 response.data
   */
  protected del = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await this.httpClient.delete<T>(url, config);
    return response.data;
  };
}
