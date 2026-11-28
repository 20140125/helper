import { readAiModelGroups } from './ai-model-config';
import type { AiModelFetchBody, RemoteModelOption } from '@/types/ai-model-config';

/** 拉取模型列表的超时时间（毫秒） */
const FETCH_TIMEOUT_MS = 10000;

/**
 * 构造候选的 /models 地址
 * @param {string} baseUrl - 用户填写的 Base URL
 * @returns {string[]} 依次尝试的地址
 * @description OpenAI 兼容服务普遍把模型列表挂在 `${baseUrl}/models`；
 *   部分服务把版本号写在 baseUrl 里（如 /api/paas/v4），再补一个去掉版本号的变体兜底
 */
const buildCandidateUrls = (baseUrl: string): string[] => {
  const base = baseUrl.replace(/\/+$/, '');
  const withoutVersion = base.replace(/\/v\d+(?:\.\d+)?$/, '');
  const urls = [`${base}/models`];
  urls.push(withoutVersion === base ? `${base}/v1/models` : `${withoutVersion}/models`);
  return [...new Set(urls)];
};

/**
 * 从接口响应中取出模型数组
 * @param {unknown} payload - 已解析的 JSON
 * @returns {unknown[] | undefined} 模型数组
 */
const pickModelList = (payload: unknown): unknown[] | undefined => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return undefined;
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data as unknown[];
  if (Array.isArray(root.models)) return root.models as unknown[];
  if (root.data && typeof root.data === 'object') {
    const inner = root.data as Record<string, unknown>;
    if (Array.isArray(inner.models)) return inner.models as unknown[];
  }
  return undefined;
};

/**
 * 按候选键从原始模型对象里取非空字符串
 * @param {Record<string, unknown>} raw - 原始模型对象
 * @param {string[]} keys - 候选字段名（兼容蛇形 / 驼峰）
 * @returns {string} 首个命中的值，未命中返回空串
 */
const pickString = (raw: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

/**
 * 按候选键取正数数值
 * @param {Record<string, unknown>} raw - 原始模型对象
 * @param {string[]} keys - 候选字段名
 * @returns {number | undefined} 合法数值，未命中返回 undefined
 */
const pickNumber = (raw: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = raw[key];
    const num = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return undefined;
};

/**
 * 按候选键取字符串数组
 * @param {Record<string, unknown>} raw - 原始模型对象
 * @param {string[]} keys - 候选字段名
 * @returns {string[] | undefined} 去重后的非空数组，未命中返回 undefined
 */
const pickStringArray = (raw: Record<string, unknown>, keys: string[]): string[] | undefined => {
  for (const key of keys) {
    const value = raw[key];
    if (!Array.isArray(value)) continue;
    const list = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
    if (list.length > 0) return [...new Set(list)];
  }
  return undefined;
};

/**
 * 把接口返回项归一化成候选模型
 * @param {unknown[]} list - 模型数组
 * @returns {RemoteModelOption[]} 去重后的模型列表
 * @description OpenAI 兼容 /models 除 id 外常带 owned_by / created / supported_endpoint_types 等字段，
 *   这里一并保留供配置页展示；object 固定为 "model"，无展示价值故丢弃
 */
const normalizeRemoteModels = (list: unknown[]): RemoteModelOption[] => {
  const seen = new Set<string>();
  const models: RemoteModelOption[] = [];
  list.forEach((item) => {
    const raw = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const id = (typeof item === 'string' ? item : String(raw.id ?? '')).trim();
    if (!id || seen.has(id)) return;
    seen.add(id);

    const option: RemoteModelOption = { id };
    const label = pickString(raw, ['name', 'label', 'display_name', 'model_name']);
    if (label && label !== id) option.label = label;
    const ownedBy = pickString(raw, ['owned_by', 'ownedBy', 'provider']);
    if (ownedBy) option.ownedBy = ownedBy;
    const created = raw.created ?? raw.created_at ?? raw.createdAt;
    if (typeof created === 'number' && Number.isFinite(created) && created > 0) option.created = created;
    else if (typeof created === 'string' && created.trim()) option.created = created.trim();
    const contextLength = pickNumber(raw, ['context_length', 'contextLength', 'context_window', 'max_model_len', 'max_context_length']);
    if (contextLength) option.contextLength = contextLength;
    const endpoints = pickStringArray(raw, ['supported_endpoint_types', 'supportedEndpointTypes', 'endpoints']);
    if (endpoints) option.supportedEndpointTypes = endpoints;
    const description = pickString(raw, ['description', 'desc']);
    if (description) option.description = description;
    models.push(option);
  });

  // 代理端点常把整批模型的 created 填成同一个占位时间戳（如 1626777600），
  // 展示出来会误导用户判断模型新旧；整批完全相同时一律丢弃该字段
  const createdList = models.map((model) => model.created).filter((value) => value !== undefined);
  if (createdList.length > 1 && new Set(createdList.map(String)).size === 1) {
    models.forEach((model) => { delete model.created; });
  }
  return models;
};

/**
 * 调用接口提供的模型列表并归一化
 * @param {AiModelFetchBody} input - 接口地址、Key 或已保存的配置组 ID
 * @returns {Promise<{ models: RemoteModelOption[]; baseUrl: string; endpoint: string }>} 可导入的模型列表
 * @description 编辑配置组时前端拿到的是脱敏 Key，此时按 groupId 从服务端取回真实 Key；
 *   任一候选地址成功即返回，全部失败时抛出可直接展示给用户的错误
 */
export const fetchRemoteModels = async (
  input: AiModelFetchBody,
): Promise<{ models: RemoteModelOption[]; baseUrl: string; endpoint: string }> => {
  const existing = input.groupId
    ? (await readAiModelGroups()).find((group) => group.id === input.groupId)
    : undefined;
  const baseUrl = String(input.baseUrl ?? existing?.baseUrl ?? '').trim().replace(/\/+$/, '');
  const inputKey = String(input.apiKey ?? '').trim();
  const apiKey = !inputKey || inputKey.includes('*') ? existing?.apiKey ?? '' : inputKey;

  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('请先填写 http(s) 开头的接口地址');
  if (!apiKey) throw new Error('请先填写 API Key');

  let lastError = '接口未响应';
  for (const endpoint of buildCandidateUrls(baseUrl)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`;
        continue;
      }
      const payload: unknown = await resp.json();
      const list = pickModelList(payload);
      if (!list || list.length === 0) {
        lastError = '接口返回的模型列表为空';
        continue;
      }
      const models = normalizeRemoteModels(list);
      if (models.length === 0) {
        lastError = '接口返回的模型缺少 id 字段';
        continue;
      }
      return { models, baseUrl, endpoint };
    } catch (err) {
      lastError = err instanceof Error && err.name === 'AbortError'
        ? '请求超时'
        : (err instanceof Error ? err.message : '请求失败');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`未能获取模型列表（${lastError}）；请检查接口地址与 API Key，或改用手动添加模型`);
};
