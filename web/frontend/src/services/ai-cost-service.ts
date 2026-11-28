import { BaseService } from './base-service';
import type {
  AiCostStatsResponse,
  AiInspectionResponse,
  AiInspectionStatusResponse,
} from '@/types/ai-cost';

/**
 * AI 成本看板接口服务
 * @description 封装 AI 运行统计（成本 / 延迟 / 工具失败率）相关的 HTTP 请求，
 *   对应后端 `web/routes/ai-chat.ts` 的 `/api/ai-chat/stats` 路由。
 */
export class AiCostService extends BaseService {
  /**
   * 获取 AI 运行统计
   * @param {number} days - 统计天数（1~90，后端会夹紧）
   * @param {string} scope - 统计范围（me=仅自己 / all=全量，非管理员传 all 会降级为 me）
   * @returns {Promise<AiCostStatsResponse>} 统计响应
   * @description Trace 数据由后端按次写入 hp_ai_run_traces，本接口返回其聚合结果。
   */
  fetchStats = async (days: number, scope: string): Promise<AiCostStatsResponse> => {
    return this.get<AiCostStatsResponse>('/ai-chat/stats', { params: { days, scope } });
  };

  /**
   * 手动触发一次系统巡检（后台执行，接口立即返回）
   * @param {string} [focus] - 定向排查重点（如「重点看今天的日志报错」），留空走默认巡检
   * @param {boolean} [push] - 是否把简报推送到企微群（需 webhook:edit 权限）
   * @returns {Promise<AiInspectionResponse>} 是否成功发起
   * @description 巡检只带只读工具，不会发消息或跑脚本；`push` 是流程末尾的固定推送步骤。
   *   一轮巡检要跑完整 Agent，耗时不可控，所以这里不等结果——调用方轮询 inspect/status 取简报。
   */
  runInspection = async (focus?: string, push: boolean = false): Promise<AiInspectionResponse> => {
    return this.post<AiInspectionResponse>('/ai-chat/inspect', { focus, push });
  };

  /**
   * 查询定时巡检的调度状态
   * @returns {Promise<AiInspectionStatusResponse>} 状态响应（是否启用、上次/下次执行时间）
   * @description 用于回答「配了到底跑没跑」：面板上直接展示启用状态与下一次触发时间。
   */
  fetchInspectionStatus = async (): Promise<AiInspectionStatusResponse> => {
    return this.get<AiInspectionStatusResponse>('/ai-chat/inspect/status');
  };
}

/**
 * 创建 AI 成本看板服务实例
 * @returns {AiCostService} 服务实例
 * @description 工厂函数，便于测试时替换实现
 */
export const createAiCostService = (): AiCostService => new AiCostService();

/** 默认导出的服务实例 */
export default createAiCostService();
