import { MAX_MEMORY_PER_TURN } from '@/types/ai-chat';
import { findAiModelGroupByModel } from '@/utils/ai-model-config';
import { chatCompletion } from './llm-client';
import { addMemoryItems, readMemory } from './memory-store';
import { extractJsonObject } from './planning';

/**
 * 长期记忆的抽取与沉淀
 * @description 每轮对话结束后（异步、不阻塞响应）让模型自己判断「有什么值得长期记住」，
 *   抽出来的事实写进 .cache/ai-memory/<user>.json，下一轮注入 system prompt。
 *   之所以用 LLM 而不是关键词规则：值得记的东西五花八门（偏好、环境、约定），规则写不全；
 *   之所以限制条数与开关：抽取要花一次额外的 LLM 调用，必须有成本闸门。
 */

/**
 * 当前模型对应配置组的记忆功能是否启用
 * @param {string} [model] - 当前对话使用的模型 ID
 * @returns {boolean} 该模型所属配置组的开关；未命中配置组时回退全局 .env
 * @description 开关已下沉到「每个模型配置组」，配置页保存后立即生效，无需重启
 */
export const isMemoryEnabled = (model?: string): boolean => {
  const group = findAiModelGroupByModel(model);
  if (typeof group?.memoryEnabled === 'boolean') return group.memoryEnabled;
  return (process.env.AI_MEMORY_ENABLED ?? 'true').trim() !== 'false';
};

/**
 * 从一轮对话中抽取值得长期记住的事实
 * @param {string} userText - 本轮用户消息文本
 * @param {string} assistantText - 本轮助手回答文本
 * @param {string} [model] - 指定模型（不传走默认）
 * @returns {Promise<string[]>} 记忆正文列表（可能为空数组）
 * @description 失败静默返回空数组：抽取失败不应该让用户看到报错，也不该影响对话。
 */
export const extractMemories = async (
  userText: string,
  assistantText: string,
  model?: string,
): Promise<string[]> => {
  if (!userText.trim() && !assistantText.trim()) return [];

  const prompt = [
    '你是记忆抽取器。从下面这段对话里，抽取值得长期记住的稳定事实。',
    '要求：',
    `- 每条一句话、独立可理解、简体中文；最多 ${MAX_MEMORY_PER_TURN} 条`,
    '- 只保留跨会话仍然成立的事实：用户身份、偏好、项目环境、长期约定',
    '- 不要记：一次性问答、临时数据、实时状态（服务是否运行、今天的数据等）',
    '- 没有值得记的就返回空数组',
    '- 只输出 JSON，形如 {"memories": ["..."]}',
    '',
    `用户：${userText.slice(0, 1500)}`,
    `助手：${assistantText.slice(0, 1500)}`,
  ].join('\n');

  try {
    const result = await chatCompletion(
      [{ role: 'user', content: prompt }],
      undefined,
      model,
    );
    const parsed = extractJsonObject(result.content ?? '');
    const list = parsed?.memories;
    if (!Array.isArray(list)) return [];
    return list
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, MAX_MEMORY_PER_TURN);
  } catch (err) {
    console.warn(`[ai-memory] 抽取失败：${(err as Error).message}`);
    return [];
  }
};

/**
 * 把一轮对话沉淀为长期记忆（供路由在响应结束后异步调用）
 * @param {object} input - 输入
 * @param {string} input.userEmail - 用户邮箱
 * @param {string} input.conversationId - 会话 ID（作为记忆来源标记）
 * @param {string} input.userText - 用户消息
 * @param {string} input.assistantText - 助手回答
 * @param {string} [input.model] - 模型 ID
 * @returns {Promise<number>} 本次新增/刷新的记忆条数
 */
export const rememberFromTurn = async (input: {
  userEmail: string;
  conversationId: string;
  userText: string;
  assistantText: string;
  model?: string;
}): Promise<number> => {
  if (!isMemoryEnabled(input.model)) return 0;
  const before = readMemory(input.userEmail).items.length;
  const memories = await extractMemories(input.userText, input.assistantText, input.model);
  if (memories.length === 0) return 0;
  addMemoryItems(input.userEmail, memories, input.conversationId);
  return readMemory(input.userEmail).items.length - before;
};
