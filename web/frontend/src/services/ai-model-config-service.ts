import { BaseService } from './base-service';
import type {
  AiModelGroupPayload,
  AiModelGroupsResponse,
  AiModelGroupResponse,
  AiModelGroupDeleteResult,
  AiModelFetchPayload,
  AiModelFetchResponse,
  AiModelTestPayload,
  AiModelTestResponse,
} from '@/types/ai-model-config';

// ==============================
// Service 类
// ==============================

/**
 * 自定义 AI 模型配置服务
 * @description 封装「一组接口与 Key + 多个模型」配置的增删改查接口
 */
export class AiModelConfigService extends BaseService {
  /**
   * 获取自定义模型配置组列表
   * @returns {Promise<AiModelGroupsResponse>} 配置组列表响应
   * @description API Key 由服务端脱敏后返回
   */
  fetchAiModelConfigs = async (): Promise<AiModelGroupsResponse> => {
    return this.get<AiModelGroupsResponse>('/ai-model-configs');
  };

  /**
   * 新增自定义模型配置组
   * @param {AiModelGroupPayload} payload - 配置组数据
   * @returns {Promise<AiModelGroupResponse>} 新建配置组响应
   * @description 组内模型 ID 不可重复，也不可与其它配置组重复
   */
  createAiModelConfig = async (payload: AiModelGroupPayload): Promise<AiModelGroupResponse> => {
    return this.post<AiModelGroupResponse>('/ai-model-configs', payload);
  };

  /**
   * 更新自定义模型配置组
   * @param {string} id - 配置组 ID
   * @param {AiModelGroupPayload} payload - 配置组数据
   * @returns {Promise<AiModelGroupResponse>} 更新后的配置组响应
   * @description apiKey 传脱敏串时服务端保持原 Key 不变
   */
  updateAiModelConfig = async (id: string, payload: AiModelGroupPayload): Promise<AiModelGroupResponse> => {
    return this.put<AiModelGroupResponse>(`/ai-model-configs/${encodeURIComponent(id)}`, payload);
  };

  /**
   * 拉取接口提供的可用模型列表
   * @param {AiModelFetchPayload} payload - 接口地址与 API Key
   * @returns {Promise<AiModelFetchResponse>} 可勾选导入的模型列表
   * @description 编辑配置组时传 groupId，由后端复用已保存的真实 Key（前端只有脱敏值）
   */
  fetchRemoteModels = async (payload: AiModelFetchPayload): Promise<AiModelFetchResponse> => {
    return this.post<AiModelFetchResponse>('/ai-model-configs/fetch-models', payload);
  };

  /**
   * 测试单个模型能否完成一次真实对话请求
   * @param {AiModelTestPayload} payload - 模型 ID 与表单里的接口地址 / Key
   * @returns {Promise<AiModelTestResponse>} 可用性、耗时与失败原因
   * @description 只探测不写配置；编辑时传 groupId 让后端复用已保存的真实 Key
   */
  testModel = async (payload: AiModelTestPayload): Promise<AiModelTestResponse> => {
    return this.post<AiModelTestResponse>('/ai-model-configs/test-model', payload);
  };

  /**
   * 删除自定义模型配置组
   * @param {string} id - 配置组 ID
   * @returns {Promise<AiModelGroupDeleteResult>} 删除结果
   */
  deleteAiModelConfig = async (id: string): Promise<AiModelGroupDeleteResult> => {
    return this.del<AiModelGroupDeleteResult>(`/ai-model-configs/${encodeURIComponent(id)}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建自定义模型配置服务实例的工厂函数
 * @description 保证服务实例的一致性
 * @returns {AiModelConfigService} 服务实例
 */
export const createAiModelConfigService = (): AiModelConfigService => {
  return new AiModelConfigService();
};

/**
 * 默认导出的服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createAiModelConfigService 工厂函数
 */
export default createAiModelConfigService();
