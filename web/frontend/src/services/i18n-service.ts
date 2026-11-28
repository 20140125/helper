import { BaseService } from './base-service';
import type {
  I18nMessageQuery,
  I18nMessagesResponse,
  I18nTranslationsResponse,
  UpdateI18nMessageResponse,
} from '@/types/i18n';

/**
 * 为语言包请求加超时保护
 * @param {Promise<T>} request - 原始请求
 * @param {number} ms - 超时毫秒数
 * @returns {Promise<T>} 超时后 reject 的请求
 * @description http 拦截器对 401 会返回永不 resolve 的 Promise，axios timeout 对此无效；
 *   用 Promise.race 保证启动加载与管理页保存后的 reload 一定会结束并降级
 */
const withTimeout = <T>(request: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`语言包请求超时（${ms}ms）`)), ms);
  });
  return Promise.race([request, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

// ==============================
// Service 类
// ==============================

/**
 * i18n 语言包服务类
 * @description 封装运行时语言包读取、管理页列表查询与文案更新接口
 */
export class I18nService extends BaseService {
  /**
   * 一次读取全部语言的完整文案
   * @returns {Promise<I18nTranslationsResponse>} 按 zh / en 分组的扁平语言包记录
   * @description 公开接口，登录页与首屏启动时只发一次请求；设置超时避免鉴权异常时请求永久挂起，失败由调用方降级
   */
  fetchTranslations = (): Promise<I18nTranslationsResponse> =>
    withTimeout(this.get<I18nTranslationsResponse>('/i18n/translations', { timeout: 8000 }), 8000);

  /**
   * 分页查询语言包条目
   * @param {I18nMessageQuery} query - 语言、命名空间、关键字与分页参数
   * @returns {Promise<I18nMessagesResponse>} 当前页记录与总数
   * @description 管理页调用，所有登录用户均可查看
   */
  fetchMessages = async (query: I18nMessageQuery): Promise<I18nMessagesResponse> => {
    return this.get<I18nMessagesResponse>('/i18n/messages', { params: query });
  };

  /**
   * 更新一条静态文案
   * @param {number} id - 自增主键
   * @param {string} value - 新文案
   * @returns {Promise<UpdateI18nMessageResponse>} 保存结果
   * @description 仅 text 类型可改；函数型条目请在语言包源码中维护
   */
  updateMessage = async (id: number, value: string): Promise<UpdateI18nMessageResponse> => {
    return this.put<UpdateI18nMessageResponse>(`/i18n/messages/${id}`, { value });
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建 i18n 语言包服务实例的工厂函数
 * @description 提供 I18nService 类的实例，确保服务实例的一致性
 * @returns {I18nService} i18n 语言包服务实例
 */
export const createI18nService = (): I18nService => new I18nService();

/**
 * 默认导出的 i18n 语言包服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createI18nService 工厂函数
 */
export default createI18nService();
