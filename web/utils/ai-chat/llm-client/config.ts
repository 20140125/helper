import {
  DEFAULT_MAX_TOKENS,
  type LlmModelOption,
  type LlmProvider,
} from '@/types/ai-chat';
import { readAiModelGroups } from '@/utils/ai-model-config';
import type { AiModelEntry, AiModelGroup } from '@/types/ai-model-config';

/** 单个 provider 的运行配置 */
export interface ProviderConfig {
  /** OpenAI 兼容端点 base URL */
  baseUrl: string;
  /** Bearer Token（直接放 Authorization: Bearer ${apiKey}） */
  apiKey: string;
  /** 默认模型 ID（取首个配置组的首个模型；无配置组时为空） */
  model: string;
  /** 单次响应最大 token 数 */
  maxTokens: number;
}

/**
 * 取首个配置组作为默认 provider
 * @returns {ProviderConfig} 默认配置
 * @description 端点、Key、模型唯一来源均为 .cache/ai-model-configs.json，每次调用现读、保存后热生效；
 *   优先使用配置页标记的「默认模型」（脚本/定时任务未指定 model 时的取值），没有标记时回退到
 *   首个配置组的首个模型；没有配置组时返回空值，由 validateLlmConfig 提示去配置页新增
 */
const getFirstGroupConfig = (): ProviderConfig => {
  const groups = readAiModelGroups();
  for (const group of groups) {
    const entry = group.models.find((m) => m.isDefault);
    if (entry) {
      return {
        baseUrl: group.baseUrl,
        apiKey: group.apiKey,
        model: entry.id,
        maxTokens: group.maxTokens || DEFAULT_MAX_TOKENS,
      };
    }
  }
  const first = groups[0];
  return {
    baseUrl: first?.baseUrl || '',
    apiKey: first?.apiKey || '',
    model: first?.models[0]?.id || '',
    maxTokens: first?.maxTokens || DEFAULT_MAX_TOKENS,
  };
};

/**
 * 按模型 ID 解析所属配置组与模型条目
 * @param {string | undefined} modelId - 模型 ID
 * @returns {{ group: AiModelGroup; entry: AiModelEntry } | undefined} 命中的配置组模型
 * @description 唯一来源是 .cache/ai-model-configs.json 里已导入配置的模型；
 *   接口 /models 拉取到的模型必须先在配置页勾选导入，才会出现在这里
 */
const resolveModel = (
  modelId: string | undefined,
): { group: AiModelGroup; entry: AiModelEntry } | undefined => {
  if (!modelId) return undefined;
  const groups = readAiModelGroups();
  for (const group of groups) {
    const entry = group.models.find((m) => m.id === modelId);
    if (entry) return { group, entry };
  }
  return undefined;
};

/**
 * 按模型 ID 解析对应 provider 的运行配置（每次调用都重读配置文件，便于热更新）
 * @param {string | undefined} modelId - 模型 ID；命中配置组时使用其端点与 Key
 * @returns {ProviderConfig & { provider: LlmProvider }} provider 配置 + provider 名
 */
export const getLlmConfigForModel = (
  modelId: string | undefined,
): ProviderConfig & { provider: LlmProvider } => {
  const custom = resolveModel(modelId);
  if (custom) {
    return {
      baseUrl: custom.group.baseUrl,
      apiKey: custom.group.apiKey,
      model: custom.entry.id,
      maxTokens: custom.group.maxTokens || DEFAULT_MAX_TOKENS,
      provider: 'custom',
    };
  }
  return { ...getFirstGroupConfig(), provider: 'zhipu' };
};

/**
 * 校验 LLM 配置是否完整
 * @param {string} [modelId] - 可选模型 ID
 * @returns {string | null} 错误描述，null 表示配置完整
 */
export const validateLlmConfig = (modelId?: string): string | null => {
  const cfg = getLlmConfigForModel(modelId);
  if (!cfg.apiKey) {
    if (cfg.provider === 'custom') {
      return `模型 ${modelId ?? ''} 未配置 API Key，请到「系统配置 → AI 模型与记忆」补全`;
    }
    return '尚未添加模型配置，请到「系统配置 → AI 模型与记忆」新增一组配置';
  }
  return null;
};

/**
 * 获取可用的模型列表
 * @returns {{ models: LlmModelOption[]; default: string }} 模型列表与当前默认模型 ID
 * @description 只返回 .cache/ai-model-configs.json 里已导入配置的模型，并带上所属配置组供下拉分组展示；
 *   接口 /models 拉取到的模型需先在配置页导入才会出现，不做运行时自动发现；
 *   默认模型取首个配置组的首个模型，若不在列表中会临时补一项保证选中态存在；
 *   没有配置组时 default 为空字符串，不补空项；
 *   配置页勾选「隐藏」的模型（测试不可用等）在此统一过滤，不出现在贾维斯窗口
 */
export const getAvailableModels = (): { models: LlmModelOption[]; default: string } => {
  const fallback = getFirstGroupConfig();
  const models: LlmModelOption[] = readAiModelGroups().flatMap((group) =>
    group.models.filter((entry) => !entry.hidden).map((entry) => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      free: entry.free,
      streamable: entry.streamable,
      vision: entry.vision,
      provider: 'custom' as const,
      groupId: group.id,
      groupName: group.name || group.id,
    })),
  );

  // 若默认模型不在列表中，补一项以保证选中态存在；无配置组时不补空项
  const defaultModel = fallback.model;
  const exists = !defaultModel || models.some((m) => m.id === defaultModel);
  return {
    models: exists
      ? models
      : [{ id: defaultModel, label: defaultModel } as LlmModelOption, ...models],
    default: defaultModel,
  };
};

/**
 * 检查指定模型是否支持 SSE 流式调用
 * @param {string} modelId - 模型 ID
 * @returns {boolean} 是否支持流式（默认 true）
 * @description CogView（文生图）和 CogVideo（文生视频）类模型不支持 stream 模式
 */
export const isModelStreamable = (modelId: string): boolean => {
  return resolveModel(modelId)?.entry.streamable ?? true;
};

/**
 * 检查指定模型是否支持图片理解（多模态输入）
 * @param {string} [modelId] - 模型 ID
 * @returns {boolean} 支持看图返回 true；未知模型按不支持处理
 */
export const isVisionModel = (modelId?: string): boolean => {
  if (!modelId) return false;
  return resolveModel(modelId)?.entry.vision ?? false;
};

/**
 * 检查指定模型是否为视频生成模型（用于决定是否走异步任务流程）
 * @param {string} modelId - 模型 ID
 * @returns {boolean} 是否为视频生成模型
 */
export const isVideoModel = (modelId: string): boolean => {
  return /cogvideox/i.test(modelId);
};
