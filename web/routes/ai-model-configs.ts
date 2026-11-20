import { Router } from 'express';
import {
  readAiModelGroups,
  writeAiModelGroups,
  maskAiModelGroup,
  validateAiModelGroupBody,
  buildAiModelGroup,
  fetchRemoteModels,
  testModelAvailability,
  ensureSingleDefaultModel,
  returnResponse,
  ErrorCode,
} from './utils';
import type { AiModelGroupBody, AiModelFetchBody, AiModelTestBody } from '@/types/ai-model-config';

const router = Router();

/**
 * 获取自定义模型配置组列表
 * @route GET /api/ai-model-configs
 * @returns {{ groups: AiModelGroup[] }} API Key 已脱敏的配置组列表
 */
router.get('/', (_req, res) => {
  const groups = readAiModelGroups().map(maskAiModelGroup);
  return returnResponse(res, ErrorCode.SUCCESS, { groups }, 'success');
});

/**
 * 新增自定义模型配置组
 * @route POST /api/ai-model-configs
 * @body {AiModelGroupBody} 配置组（同一接口与 Key 下可带多个模型）
 * @returns {{ group: AiModelGroup }} 新建的配置组（API Key 已脱敏）
 */
router.post('/', (req, res) => {
  const body = (req.body ?? {}) as AiModelGroupBody;
  const groups = readAiModelGroups();
  const error = validateAiModelGroupBody(body, true, groups);
  if (error) return returnResponse(res, ErrorCode.BAD_REQUEST, {}, error);

  const group = buildAiModelGroup(body);
  writeAiModelGroups(ensureSingleDefaultModel([...groups, group], group.id));
  return returnResponse(res, ErrorCode.SUCCESS, { group: maskAiModelGroup(group) }, 'success');
});

/**
 * 拉取接口提供的可用模型列表
 * @route POST /api/ai-model-configs/fetch-models
 * @body {AiModelFetchBody} 接口地址与 API Key（编辑时可用 groupId 复用已保存的 Key）
 * @returns {{ models: RemoteModelOption[]; baseUrl: string; endpoint: string }} 可勾选导入的模型列表
 * @description 调用 OpenAI 兼容的 /models 接口；仅返回候选列表，导入后才会出现在贾维斯聊天里
 */
router.post('/fetch-models', async (req, res) => {
  try {
    const result = await fetchRemoteModels((req.body ?? {}) as AiModelFetchBody);
    return returnResponse(res, ErrorCode.SUCCESS, result, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, (err as Error).message);
  }
});

/**
 * 测试单个模型能否完成一次真实对话请求
 * @route POST /api/ai-model-configs/test-model
 * @body {AiModelTestBody} 模型 ID 与可选的端点 / API Key / 配置组 ID
 * @returns {AiModelTestResult} 可用性、耗时与失败原因
 * @description 只发一次最小 chat/completions 探测，不写入任何配置；
 *   编辑时前端只有脱敏 Key，由后端按模型 ID 反查已保存配置取回真实 Key
 */
router.post('/test-model', async (req, res) => {
  try {
    const result = await testModelAvailability((req.body ?? {}) as AiModelTestBody);
    // 展开成普通对象字面量，满足 returnResponse 的 Record<string, unknown> 约束
    return returnResponse(res, ErrorCode.SUCCESS, { ...result }, 'success');
  } catch (err) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, (err as Error).message);
  }
});

/**
 * 更新自定义模型配置组
 * @route PUT /api/ai-model-configs/:id
 * @body {AiModelGroupBody} 配置组（API Key 传脱敏串时保持原值）
 * @returns {{ group: AiModelGroup }} 更新后的配置组（API Key 已脱敏）
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const groups = readAiModelGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '模型配置组不存在');
  }

  const body = (req.body ?? {}) as AiModelGroupBody;
  const error = validateAiModelGroupBody(body, false, groups, id);
  if (error) return returnResponse(res, ErrorCode.BAD_REQUEST, {}, error);

  const group = buildAiModelGroup(body, groups[idx]);
  groups[idx] = group;
  writeAiModelGroups(ensureSingleDefaultModel(groups, id));
  return returnResponse(res, ErrorCode.SUCCESS, { group: maskAiModelGroup(group) }, 'success');
});

/**
 * 删除自定义模型配置组
 * @route DELETE /api/ai-model-configs/:id
 * @returns {{}} 删除结果
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const groups = readAiModelGroups();
  const filtered = groups.filter((g) => g.id !== id);
  if (filtered.length === groups.length) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '模型配置组不存在');
  }
  writeAiModelGroups(filtered);
  return returnResponse(res, ErrorCode.SUCCESS, {}, '模型配置组已删除');
});

export default router;
