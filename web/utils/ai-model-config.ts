import {
  type AiModelGroup,
  type AiModelEntry,
  type AiModelEntryTestResult,
  type AiModelGroupBody,
  type AiModelPricing,
} from '@/types/ai-model-config';
import { DEFAULT_MAX_TOKENS } from '@/types/ai-chat';
import { formatDate } from '@/utils/script';
import { readCacheJson, writeCacheJson } from '@/utils/database/cache-store';

/** 模型配置缓存键（真源为 已有业务表） */
const AI_MODEL_CONFIGS_KEY = 'ai-model-configs.json';

/** 模型 ID 允许的字符集 */
const MODEL_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

/** 测试结果文本字段的最大长度，避免把整段错误响应写进配置文件 */
const TEST_RESULT_TEXT_MAX = 500;

/**
 * 归一化模型条目内嵌的测试结果
 * @param {unknown} raw - 原始值
 * @returns {AiModelEntryTestResult | undefined} 字段合法时返回白名单重建的结果
 * @description 只保留有限字段并截断文本，避免外部传入的任意对象污染配置文件
 */
const normalizeTestResult = (raw: unknown): AiModelEntryTestResult | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.ok !== 'boolean' || typeof value.testedAt !== 'string') return undefined;
  const latencyMs = Number(value.latencyMs);
  return {
    ok: value.ok,
    latencyMs: Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : 0,
    message: String(value.message ?? '').slice(0, TEST_RESULT_TEXT_MAX),
    testedAt: value.testedAt,
    ...(typeof value.reply === 'string' ? { reply: value.reply.slice(0, TEST_RESULT_TEXT_MAX) } : {}),
  };
};

/**
 * 归一化单个模型条目
 * @param {Record<string, unknown>} raw - 原始对象
 * @returns {AiModelEntry} 归一化后的模型条目
 */
const normalizeEntry = (raw: Record<string, unknown>): AiModelEntry => {
  const id = String(raw.id ?? '').trim();
  const testResult = normalizeTestResult(raw.testResult);
  return {
    id,
    label: String(raw.label ?? '').trim() || id,
    description: String(raw.description ?? ''),
    streamable: raw.streamable !== false,
    vision: raw.vision === true,
    free: raw.free === true,
    // 隐藏状态持久化；全局默认模型强制不隐藏，避免下拉补项把它重新塞回去
    ...(raw.hidden === true && raw.isDefault !== true ? { hidden: true } : {}),
    ...(raw.isDefault === true ? { isDefault: true } : {}),
    // 测试结果随模型条目落盘；非法值直接丢弃
    ...(testResult ? { testResult } : {}),
  };
};

/**
 * 保证全局最多只有一个默认模型
 * @param {AiModelGroup[]} groups - 完整配置组列表
 * @param {string} [preferredGroupId] - 本次编辑的配置组 ID（该组内的标记优先保留）
 * @returns {AiModelGroup[]} 归一化后的配置组列表
 * @description 用户在某个组里点了「设为默认」后，跨组的旧标记一律清掉；
 *   没有标记时（旧数据）不额外指定，由 getFirstGroupConfig 回退到首个配置组的首个模型
 */
export const ensureSingleDefaultModel = (
  groups: AiModelGroup[],
  preferredGroupId?: string,
): AiModelGroup[] => {
  const marked: Array<{ groupId: string; modelId: string }> = [];
  groups.forEach((group) => {
    group.models.forEach((model) => {
      if (model.isDefault) marked.push({ groupId: group.id, modelId: model.id });
    });
  });
  const chosen = marked.find((item) => item.groupId === preferredGroupId) ?? marked[0];
  return groups.map((group) => ({
    ...group,
    models: group.models.map((model) => {
      const isDefault = !!chosen && chosen.groupId === group.id && chosen.modelId === model.id;
      return isDefault ? { ...model, isDefault: true } : { ...model, isDefault: undefined };
    }),
  }));
};

/**
 * 归一化模型单价表
 * @param {unknown} raw - JSON 对象或 JSON 字符串
 * @returns {AiModelPricing} 只保留合法数值项的单价表
 * @description 供读取旧数据与构造配置组使用；不合法内容静默丢弃，校验由 validateAiModelPricing 负责
 */
export const normalizeAiModelPricing = (raw: unknown): AiModelPricing => {
  let source = raw;
  if (typeof source === 'string') {
    if (!source.trim()) return {};
    try {
      source = JSON.parse(source);
    } catch {
      return {};
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const pricing: AiModelPricing = {};
  Object.entries(source as Record<string, unknown>).forEach(([id, item]) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const value = item as Record<string, unknown>;
    const prompt = Number(value.prompt);
    const completion = Number(value.completion);
    if (!Number.isFinite(prompt) || !Number.isFinite(completion) || prompt < 0 || completion < 0) return;
    pricing[id] = { prompt, completion };
  });
  return pricing;
};

/**
 * 校验模型单价表
 * @param {unknown} raw - JSON 对象或 JSON 字符串
 * @returns {string | null} 错误描述，null 表示校验通过
 */
export const validateAiModelPricing = (raw: unknown): string | null => {
  if (raw === undefined || raw === null || raw === '') return null;
  let source = raw;
  if (typeof source === 'string') {
    if (!source.trim()) return null;
    try {
      source = JSON.parse(source);
    } catch {
      return '模型单价表不是合法的 JSON';
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return '模型单价表需为 JSON 对象';
  for (const [id, item] of Object.entries(source as Record<string, unknown>)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `模型「${id}」的单价格式不正确`;
    }
    const value = item as Record<string, unknown>;
    if (
      !Number.isFinite(Number(value.prompt)) ||
      !Number.isFinite(Number(value.completion)) ||
      Number(value.prompt) < 0 ||
      Number(value.completion) < 0
    ) {
      return `模型「${id}」的单价需为非负数字`;
    }
  }
  return null;
};

/**
 * 解析 JSON 内容为配置组列表
 * @param {unknown} raw - JSON 解析结果
 * @returns {AiModelGroup[]} 配置组列表
 * @description 兼容旧版「一条配置一个模型」的扁平数据，按 baseUrl + apiKey 自动归并成组
 */
const parseGroupsFromRaw = (raw: unknown): AiModelGroup[] => {
  if (!Array.isArray(raw)) return [];
  const groups: AiModelGroup[] = [];
  const legacy = new Map<string, AiModelGroup>();

  (raw as Record<string, unknown>[]).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item.models)) {
      const models = (item.models as Record<string, unknown>[])
        .filter((m) => m && typeof m === 'object')
        .map(normalizeEntry)
        .filter((m) => m.id.length > 0);
      if (models.length === 0) return;
      groups.push({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        baseUrl: String(item.baseUrl ?? ''),
        apiKey: String(item.apiKey ?? ''),
        maxTokens: Number(item.maxTokens) || DEFAULT_MAX_TOKENS,
        models,
        memoryEnabled: typeof item.memoryEnabled === 'boolean' ? item.memoryEnabled : undefined,
        pricing: normalizeAiModelPricing(item.pricing),
        created_at: String(item.created_at ?? ''),
        updated_at: String(item.updated_at ?? ''),
      });
      return;
    }

    // 旧格式：一条配置对应一个模型，按端点 + Key 归并到同一组
    const entry = normalizeEntry(item);
    if (!entry.id) return;
    const baseUrl = String(item.baseUrl ?? '').trim();
    const apiKey = String(item.apiKey ?? '').trim();
    const key = `${baseUrl}\u0000${apiKey}`;
    let group = legacy.get(key);
    if (!group) {
      group = {
        id: `group_legacy_${legacy.size + 1}`,
        name: '从旧配置迁移',
        baseUrl,
        apiKey,
        maxTokens: Number(item.maxTokens) || DEFAULT_MAX_TOKENS,
        models: [],
        memoryEnabled: undefined,
        pricing: {},
        created_at: String(item.created_at ?? ''),
        updated_at: String(item.updated_at ?? ''),
      };
      legacy.set(key, group);
    }
    group.models.push(entry);
  });

  return [...groups.filter((g) => g.id.length > 0), ...legacy.values()];
};

/**
 * 读取模型配置组
 * @returns {Promise<AiModelGroup[]>} 配置组列表；缓存缺失或内容损坏时返回空数组
 * @description 纯读取、无副作用；真源为缓存 KV，所有组一律平等，由配置页增删改
 */
export const readAiModelGroups = async (): Promise<AiModelGroup[]> => {
  const raw = await readCacheJson<unknown>(AI_MODEL_CONFIGS_KEY);
  return parseGroupsFromRaw(raw);
};

/**
 * 按模型 ID 查找所属配置组
 * @param {string | undefined} modelId - 模型 ID
 * @returns {Promise<AiModelGroup | undefined>} 命中的配置组
 * @description 长期记忆开关与自定义单价按组归属，运行时据当前模型反查所属组
 */
export const findAiModelGroupByModel = async (modelId?: string): Promise<AiModelGroup | undefined> => {
  if (!modelId) return undefined;
  return (await readAiModelGroups()).find((group) => group.models.some((m) => m.id === modelId));
};

/**
 * 写入模型配置组（UPSERT 原子替换）
 * @param {AiModelGroup[]} groups - 完整配置组列表
 * @returns {Promise<void>}
 * @description 序列化格式与旧版一致（2 空格缩进），不再写磁盘临时文件
 */
export const writeAiModelGroups = async (groups: AiModelGroup[]): Promise<void> => {
  await writeCacheJson(AI_MODEL_CONFIGS_KEY, ensureSingleDefaultModel(groups));
};

/**
 * 对配置组的 API Key 脱敏
 * @param {AiModelGroup} group - 原始配置组
 * @returns {AiModelGroup} 仅保留 Key 后 4 位的副本
 */
export const maskAiModelGroup = (group: AiModelGroup): AiModelGroup => ({
  ...group,
  apiKey: group.apiKey ? `****${group.apiKey.slice(-4)}` : '',
});

/**
 * 校验新增/编辑配置组的字段
 * @param {AiModelGroupBody} body - 请求体
 * @param {boolean} isCreate - 是否为新增（新增时 API Key 必填且不允许脱敏串）
 * @param {AiModelGroup[]} groups - 当前全部配置组
 * @param {string} [currentId] - 编辑中的配置组 ID（校验重复时排除自身）
 * @returns {string | null} 错误描述，null 表示校验通过
 */
export const validateAiModelGroupBody = (
  body: AiModelGroupBody,
  isCreate: boolean,
  groups: AiModelGroup[],
  currentId?: string,
): string | null => {
  if (!body.name?.trim()) return '配置名称不能为空';
  if (!body.baseUrl?.trim()) return '接口地址不能为空';
  if (isCreate && !body.apiKey?.trim()) return 'API Key 不能为空';
  if (isCreate && String(body.apiKey).includes('*')) return 'API Key 无效';
  const tokens = Number(body.maxTokens ?? DEFAULT_MAX_TOKENS);
  if (!Number.isFinite(tokens) || tokens < 100 || tokens > 999999) {
    return '单次最大 token 需为 100-999999 的整数';
  }
  const pricingError = validateAiModelPricing(body.pricing);
  if (pricingError) return pricingError;
  if (!Array.isArray(body.models) || body.models.length === 0) {
    return '至少填写一个模型名称';
  }
  const seen = new Set<string>();
  for (const model of body.models) {
    const id = String(model?.id ?? '').trim();
    if (!MODEL_ID_PATTERN.test(id)) {
      return `模型 ID「${id}」只能包含字母、数字、点、下划线、冒号、连字符`;
    }
    if (seen.has(id)) return `模型 ID「${id}」重复`;
    seen.add(id);
    if (groups.some((g) => g.id !== currentId && g.models.some((m) => m.id === id))) {
      return `模型 ID「${id}」已存在于其它配置组`;
    }
  }
  return null;
};

/**
 * 由请求体构造完整的配置组
 * @param {AiModelGroupBody} body - 请求体
 * @param {AiModelGroup} [existing] - 编辑时的原配置组（用于保留创建时间与脱敏 Key）
 * @returns {AiModelGroup} 可持久化的配置组
 */
export const buildAiModelGroup = (
  body: AiModelGroupBody,
  existing?: AiModelGroup,
): AiModelGroup => {
  const now = formatDate();
  const masked = typeof body.apiKey === 'string' && body.apiKey.includes('*');
  const keepOldKey = existing && (masked || !String(body.apiKey ?? '').trim());
  return {
    id: existing?.id ?? `group_${Date.now()}`,
    name: body.name?.trim() ?? '',
    baseUrl: body.baseUrl?.trim() ?? '',
    apiKey: keepOldKey ? existing!.apiKey : String(body.apiKey ?? '').trim(),
    maxTokens: Number(body.maxTokens) || DEFAULT_MAX_TOKENS,
    models: (body.models ?? [])
      .map((m) => normalizeEntry(m as unknown as Record<string, unknown>))
      .filter((m) => m.id.length > 0),
    memoryEnabled: typeof body.memoryEnabled === 'boolean' ? body.memoryEnabled : existing?.memoryEnabled,
    pricing: normalizeAiModelPricing(body.pricing ?? existing?.pricing),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
};
