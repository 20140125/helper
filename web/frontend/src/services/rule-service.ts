import type { RulePayload, RulesResponse, RuleResponse, RuleResult, RuleTestResult } from '@/types/rule';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 规则服务管理类
 * @description 封装规则相关的API接口，提供规则的增删改查及测试功能
 */
export class RuleService extends BaseService {
  /**
   * 获取规则列表
   * @returns {Promise<RulesResponse>} 规则列表响应
   * @description 从服务端获取所有规则的列表信息
   * @example
   * const service = new RuleService();
   * const result = await service.fetchRules();
   * console.log('规则列表:', result.rules);
   */
  fetchRules = async (): Promise<RulesResponse> => {
    return this.get<RulesResponse>('/rules');
  };

  /**
   * 创建规则
   * @param {RulePayload} payload - 规则创建参数
   * @returns {Promise<RuleResponse>} 创建的规则响应
   * @description 向服务端提交新规则数据并创建
   * @example
   * const service = new RuleService();
   * const result = await service.createRule({ name: '新规则', ... });
   * console.log('创建的规则:', result.rule);
   */
  createRule = async (payload: RulePayload): Promise<RuleResponse> => {
    return this.post<RuleResponse>('/rules', payload);
  };

  /**
   * 更新规则
   * @param {string} id - 规则ID
   * @param {Partial<RulePayload>} payload - 规则更新参数
   * @returns {Promise<RuleResponse>} 更新后的规则响应
   * @description 根据规则ID更新指定规则的数据
   * @example
   * const service = new RuleService();
   * const result = await service.updateRule('rule-id', { name: '更新后的规则' });
   * console.log('更新后的规则:', result.rule);
   */
  updateRule = async (id: string, payload: Partial<RulePayload>): Promise<RuleResponse> => {
    return this.put<RuleResponse>(`/rules/${id}`, payload);
  };

  /**
   * 批量更新规则显示顺序
   * @param {string[]} ids - 按目标顺序排列的规则 ID 列表
   * @returns {Promise<RulesResponse>} 重排后的完整规则列表响应
   * @description 拖拽排序后整体持久化，服务端按 ids 顺序重排并返回完整列表
   * @example
   * const service = new RuleService();
   * const result = await service.updateRuleOrder(['rule_b', 'rule_a']);
   * console.log('重排后列表:', result.data.rules);
   */
  updateRuleOrder = async (ids: string[]): Promise<RulesResponse> => {
    return this.put<RulesResponse>('/rules/order', { ids });
  };

  /**
   * 删除规则
   * @param {string} id - 规则ID
   * @returns {Promise<RuleResult>} 删除操作结果
   * @description 根据规则ID删除指定规则
   * @example
   * const service = new RuleService();
   * const result = await service.deleteRule('rule-id');
   * if (result.code === 0) {
   *   console.log('删除成功:', result.message);
   * }
   */
  deleteRule = async (id: string): Promise<RuleResult> => {
    return this.del<RuleResult>(`/rules/${id}`);
  };

  /**
   * 测试规则
   * @param {string} id - 规则ID
   * @returns {Promise<RuleTestResult>} 规则测试结果
   * @description 触发指定规则的测试执行，返回执行输出
   * @example
   * const service = new RuleService();
   * const result = await service.testRule('rule-id');
   * console.log('标准输出:', result.stdout);
   * console.log('错误输出:', result.stderr);
   */
  testRule = async (id: string): Promise<RuleTestResult> => {
    return this.post<RuleTestResult>(`/rules/${id}/test`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建规则服务实例的工厂函数
 * @description 提供RuleService类的实例，确保服务实例的一致性
 * @returns {RuleService} 规则服务实例
 */
export const createRuleService = (): RuleService => {
  return new RuleService();
};

/**
 * 默认导出的规则服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createRuleService工厂函数
 */
export default createRuleService();
