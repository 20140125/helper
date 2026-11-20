import type { ApiResponse } from './api';

/**
 * 同一组接口下的单个模型
 * @description 与后端 `web/types/ai-model-config.ts` 保持一致
 */
export interface AiModelEntry {
  /** 模型 ID（聊天请求 model 字段取值） */
  id: string;
  /** 前端展示名称 */
  label: string;
  /** 下拉项辅助说明 */
  description: string;
  /** 是否支持 SSE 流式输出 */
  streamable: boolean;
  /** 是否支持图片理解 */
  vision: boolean;
  /** 是否免费（前端下拉展示「免费」标记） */
  free?: boolean;
  /** 是否为全局默认模型（脚本/定时任务未指定 model 时使用，全局最多一个） */
  isDefault?: boolean;
  /** 是否在贾维斯窗口隐藏（测试失败会自动勾选；默认模型不允许隐藏） */
  hidden?: boolean;
  /** 最近一次可用性测试结果（随模型条目一起持久化，编辑时可回看） */
  testResult?: AiModelEntryTestResult;
}

/** 单个模型的自定义单价（元 / 百万 token） */
export interface AiModelPrice {
  /** 输入单价 */
  prompt: number;
  /** 输出单价 */
  completion: number;
}

/** 模型单价表，按模型 ID 索引 */
export type AiModelPricing = Record<string, AiModelPrice>;

/**
 * 自定义 AI 模型配置组
 * @description 同一个 Base URL + API Key 下挂多个模型名称；apiKey 为服务端脱敏后的值
 */
export interface AiModelGroup {
  /** 配置组 ID */
  id: string;
  /** 配置组名称 */
  name: string;
  /** OpenAI 兼容端点 Base URL */
  baseUrl: string;
  /** 脱敏后的 API Key（编辑时原样回传即可保留原值） */
  apiKey: string;
  /** 单次响应最大 token 数 */
  maxTokens: number;
  /** 该组下的模型列表 */
  models: AiModelEntry[];
  /** 该组是否启用长期记忆（旧数据缺省时后端回退全局配置） */
  memoryEnabled?: boolean;
  /** 该组自定义单价表（元 / 百万 token） */
  pricing?: AiModelPricing;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 新增 / 编辑模型配置组的提交数据 */
export type AiModelGroupPayload = Omit<AiModelGroup, 'id' | 'created_at' | 'updated_at'>;

/** 获取模型配置组列表响应 */
export type AiModelGroupsResponse = ApiResponse<{ groups: AiModelGroup[] }>;

/** 单个模型配置组响应 */
export type AiModelGroupResponse = ApiResponse<{ group: AiModelGroup }>;

/** 删除模型配置组响应 */
export type AiModelGroupDeleteResult = ApiResponse;

/** 拉取接口可用模型列表的请求体 */
export interface AiModelFetchPayload {
  /** OpenAI 兼容端点 Base URL */
  baseUrl: string;
  /** API Key（编辑时为脱敏值，后端按 groupId 取回真实 Key） */
  apiKey: string;
  /** 编辑中的配置组 ID */
  groupId?: string;
}

/** 接口返回的候选模型 */
export interface RemoteModelOption {
  /** 模型 ID */
  id: string;
  /** 接口给出的展示名（可选） */
  label?: string;
  /** 归属方 / 厂商（owned_by / provider） */
  ownedBy?: string;
  /** 模型创建时间（Unix 秒或时间字符串） */
  created?: number | string;
  /** 上下文长度（部分服务返回） */
  contextLength?: number;
  /** 支持的端点类型（如 openai / anthropic） */
  supportedEndpointTypes?: string[];
  /** 接口给出的简介 */
  description?: string;
}

/** 拉取模型列表响应 */
export type AiModelFetchResponse = ApiResponse<{
  /** 可导入的模型列表 */
  models: RemoteModelOption[];
  /** 实际使用的 Base URL */
  baseUrl: string;
  /** 实际命中的模型列表地址 */
  endpoint: string;
}>;

/** 测试单个模型可用性的请求体 */
export interface AiModelTestPayload {
  /** 待测试的模型 ID */
  modelId: string;
  /** 新增配置时表单里的接口地址 */
  baseUrl?: string;
  /** 新增配置时表单里的 API Key（脱敏串表示复用已保存 Key） */
  apiKey?: string;
  /** 编辑中的配置组 ID */
  groupId?: string;
}

/** 单个模型可用性测试结果 */
export interface AiModelTestResult {
  /** 是否可用 */
  ok: boolean;
  /** 请求耗时（毫秒） */
  latencyMs: number;
  /** 结果说明（成功为空串，失败为错误原因） */
  message: string;
  /** 模型返回的首段文本 */
  reply?: string;
}

/**
 * 保存在模型条目内的最近一次测试结果
 * @description 由配置页「测试」按钮写入，随配置组一起落盘
 */
export interface AiModelEntryTestResult extends AiModelTestResult {
  /** 测试时间（ISO 8601） */
  testedAt: string;
}

/** 测试模型响应 */
export type AiModelTestResponse = ApiResponse<AiModelTestResult>;

/** 模型配置行内表单数据 */
export type AiModelInlineFormData = Record<string, unknown>;
