import { MODEL_ID_PATTERN } from '@/constants/ai-model-config';
import type { AiModelEntry, AiModelPricing, RemoteModelOption } from '@/types/ai-model-config';

/**
 * 创建自定义 AI 模型行内表单初始值
 * @returns {Record<string, unknown>} 表单数据
 * @description 与 Webhook 一样在列表底部展开行内表单；models 为结构化模型条目数组，
 *   用工厂函数避免多次新增共用同一个数组引用
 */
export const createAiModelFormDefault = (): Record<string, unknown> => ({
  name: '',
  baseUrl: '',
  apiKey: '',
  maxTokens: 4096,
  memoryEnabled: true,
  pricingJson: '',
  models: [] as AiModelEntry[],
});

/**
 * 校验模型 ID 是否合法
 * @param {string} id - 模型 ID
 * @returns {boolean} 合法返回 true
 */
export const isAiModelIdValid = (id: string): boolean => MODEL_ID_PATTERN.test(id);

/**
 * 把接口给出的创建时间格式化为年月
 * @param {number | string | undefined} created - Unix 秒 / 毫秒或时间字符串
 * @returns {string} YYYY-MM；无法解析时返回空串
 * @description 不同服务的 created 单位不一致，小于 1e12 视为秒；统一用 UTC 避免展示随时区漂移
 */
const formatCreatedMonth = (created?: number | string): string => {
  if (created === undefined || created === '') return '';
  const numeric = typeof created === 'number'
    ? created
    : (/^\d+$/.test(created) ? Number(created) : Date.parse(created));
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  const date = new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 7);
};

/**
 * 把接口返回的模型元信息格式化成一行摘要
 * @param {RemoteModelOption} item - 候选模型
 * @returns {string} 摘要文本；接口未给出元信息时返回空串
 * @description 只用接口原始数据（归属方 / 发布时间 / 上下文 / 端点类型），不引入本地文案，
 *   既用于候选列表展示，也用于导入时预填「模型说明」
 */
export const formatRemoteModelMeta = (item: RemoteModelOption): string => {
  const parts: string[] = [];
  if (item.ownedBy) parts.push(item.ownedBy);
  const month = formatCreatedMonth(item.created);
  if (month) parts.push(month);
  if (item.contextLength && item.contextLength > 0) {
    const size = item.contextLength >= 1024
      ? `${Math.round(item.contextLength / 1024)}K`
      : String(item.contextLength);
    parts.push(`${size} ctx`);
  }
  if (item.supportedEndpointTypes?.length) parts.push(item.supportedEndpointTypes.join('/'));
  return parts.join(' · ');
};

/**
 * 由模型 ID 创建一条可编辑的模型条目
 * @param {string} id - 模型 ID
 * @param {string} [label] - 接口给出的展示名
 * @param {string} [description] - 接口元信息摘要（导入时预填，用户可改）
 * @returns {AiModelEntry} 带默认开关的模型条目
 * @description 生成类模型默认不走流式，名称含视觉关键词的模型默认支持看图；手动添加时说明留空
 */
export const createAiModelEntry = (id: string, label?: string, description = ''): AiModelEntry => ({
  id,
  label: label?.trim() || id,
  description,
  streamable: !/(cogview|cogvideo)/i.test(id),
  vision: /(vision|vl|4v|v-flash)/i.test(id),
  free: false,
  hidden: false,
});

/**
 * 解析「模型单价表」文本
 * @param {string} text - JSON 文本
 * @returns {AiModelPricing | null} 单价表；格式不合法返回 null
 * @description 形如 {"glm-4.6":{"prompt":2,"completion":6}}；留空表示免费模型
 */
export const parseAiModelPricing = (text: string): AiModelPricing | null => {
  const raw = String(text ?? '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const pricing: AiModelPricing = {};
    for (const [id, item] of Object.entries(parsed)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const value = item as Record<string, unknown>;
      const prompt = Number(value.prompt);
      const completion = Number(value.completion);
      if (!Number.isFinite(prompt) || !Number.isFinite(completion) || prompt < 0 || completion < 0) return null;
      pricing[id] = { prompt, completion };
    }
    return pricing;
  } catch {
    return null;
  }
};

/**
 * 把单价表还原成可编辑的 JSON 文本
 * @param {AiModelPricing} [pricing] - 单价表
 * @returns {string} JSON 文本；空表返回空字符串
 */
export const stringifyAiModelPricing = (pricing?: AiModelPricing): string =>
  pricing && Object.keys(pricing).length > 0 ? JSON.stringify(pricing, null, 2) : '';
