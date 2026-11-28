import type {
  LogsResponse,
  LogContentResponse,
  LogResult,
  LogRowsParams,
  LogRowsResponse,
  LogDetailResponse,
} from '@/types/log';
import { BaseService } from './base-service';

/**
 * 日志服务管理类
 * @description 封装日志相关的 API 接口，提供库来源列表、日志记录分页、单条详情与清空能力
 */
export class LogService extends BaseService {
  /**
   * 获取日志来源列表
   * @returns {Promise<LogsResponse>} 日志来源列表响应
   * @description 从 hp_run_logs 按 source 聚合出实际存在的来源及条数、正文体积、最近写入时间
   */
  fetchLogs = async (): Promise<LogsResponse> => {
    return this.get<LogsResponse>('/logs');
  };

  /**
   * 分页获取运行日志记录
   * @param {LogRowsParams} params - 分页与筛选参数
   * @returns {Promise<LogRowsResponse>} 日志记录分页响应
   * @description 按来源标识、来源类型、级别、正文关键词筛选后返回当前页记录与总条数
   */
  fetchLogRows = async (params: LogRowsParams): Promise<LogRowsResponse> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.source) query.set('source', params.source);
    if (params.sourceType) query.set('sourceType', params.sourceType);
    if (params.level) query.set('level', params.level);
    if (params.keyword) query.set('keyword', params.keyword);
    return this.get<LogRowsResponse>(`/logs/rows?${query.toString()}`);
  };

  /**
   * 获取单条日志详情
   * @param {number} id - 日志记录 ID
   * @returns {Promise<LogDetailResponse>} 日志详情响应
   * @description 读取该记录的完整正文、上下文、链路 ID 与关联用户
   */
  fetchLogDetail = async (id: number): Promise<LogDetailResponse> => {
    return this.get<LogDetailResponse>(`/logs/rows/${id}`);
  };

  /**
   * 获取指定来源的日志文本
   * @param {string} source - hp_run_logs.source 原值
   * @param {number} [lines=200] - 读取的最大条数
   * @returns {Promise<LogContentResponse>} 渲染后的日志文本响应
   * @description 供仪表盘日志概览按来源读取库里末尾 N 条记录
   */
  fetchLogContent = async (source: string, lines: number = 200): Promise<LogContentResponse> => {
    return this.get<LogContentResponse>(`/logs/${source}`, { params: { lines } });
  };

  /**
   * 清空指定来源的日志记录
   * @param {string} source - hp_run_logs.source 原值
   * @returns {Promise<LogResult>} 清空操作结果
   * @description 删除该来源在 hp_run_logs 中的全部记录
   */
  removeLog = async (source: string): Promise<LogResult> => {
    return this.del<LogResult>(`/logs/${source}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建日志服务实例的工厂函数
 * @description 提供 LogService 类的实例，确保服务实例的一致性
 * @returns {LogService} 日志服务实例
 */
export const createLogService = (): LogService => new LogService();

/**
 * 默认导出的日志服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createLogService 工厂函数
 */
export default createLogService();
