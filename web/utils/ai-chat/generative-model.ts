import type { Response } from 'express';
import type { ChatConversation } from '@/types/ai-chat';
import { getAvailableModels, imageGeneration, isVideoModel, videoGeneration } from './llm-client';
import { createConversation, readConversation, replaceMessages } from './conversation-store';

/**
 * 写入一条 SSE 事件
 * @param {Response} res - Express Response 对象
 * @param {string} event - 事件名
 * @param {unknown} data - 数据负载（会被 JSON 序列化）
 * @returns {void}
 */
const writeSse = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * 检查是否为文生图/文生视频模型（不需要走 Agent Loop）
 * @param {string | undefined} modelId - 模型 ID
 * @returns {Promise<boolean>} 是否为生成类模型
 * @description 生成类模型由缓存配置里 `streamable=false` 的条目标记，不再硬编码模型 ID
 */
export const isGenerativeModel = async (modelId: string | undefined): Promise<boolean> => {
  if (!modelId) return false;
  const { models } = await getAvailableModels();
  return models.some((m) => m.id === modelId && m.streamable === false);
};

/**
 * 调用同步文生图模型并构建保存内容（如 CogView-4、CogView-3-Flash）
 * @param {string} message - 用户提示词
 * @param {string} model - 模型 ID
 * @returns {Promise<string>} 待保存的 Markdown 内容
 * @description 智谱 CogView 系列走 `/images/generations` 端点（不走 chat/completions），
 *   响应里 `data: [{ url }]` 就是图片地址；这里把图片渲染成 Markdown 落库。
 */
const runImageGeneration = async (message: string, model: string): Promise<string> => {
  const result = await imageGeneration(message, model);
  if (result.image_urls.length === 0) {
    // 智谱在 prompt 不构成可生成画面时通常会报 4xx（已在 imageGeneration 内抛错），
    // 这里是兜底：极端情况下返回 200 但 data 为空，避免落库空字符串导致前端"无回复"。
    return '⚠️ 未能生成图片，请尝试更具体的画面描述（如"一只在草原奔跑的橘猫，写实风格"）。';
  }
  return result.image_urls.map((url) => `![generated](${url})`).join('\n');
};

/**
 * 把视频生成结果转为 Markdown 文本
 * @param {string[]} videoUrls - 视频 URL 列表
 * @param {string[]} coverUrls - 封面图 URL 列表
 * @returns {string} Markdown 文本
 * @description 使用自定义语法 `@[video](url){poster=cover}`，前端会渲染为 `<video>` 播放器。
 *   该语法刻意区别于图片语法 `![alt](url)`，避免在不识别该语法的渲染器中被错误解析。
 */
const formatVideoMarkdown = (videoUrls: string[], coverUrls: string[]): string => {
  const lines: string[] = ['', '✅ 视频生成完成：', ''];
  videoUrls.forEach((url, idx) => {
    const cover = coverUrls[idx];
    const posterPart = cover ? `{poster=${cover}}` : '';
    lines.push(`@[video](${url})${posterPart}`);
    // 兜底：附一个文字链接，便于在不支持自定义语法的环境中点击查看
    lines.push(`[点击查看视频 ${idx + 1}](${url})`);
    lines.push('');
  });
  return lines.join('\n');
};

/**
 * 调用异步视频生成模型并构建保存内容（如 CogVideoX-Flash）
 * @param {Response} res - SSE 响应对象（用于推送进度）
 * @param {string} message - 用户提示词
 * @param {string} model - 模型 ID
 * @returns {Promise<string>} 待保存的 Markdown 内容（包含视频链接和封面图）
 * @description 视频生成耗时较长（30s+），通过 SSE delta 推送进度提示，避免前端等待时无反馈
 *   - 进度文本会通过 delta 实时推送让用户看到反馈
 *   - 但落库的 content 只保留最终的视频结果 Markdown，不包含进度文本
 */
const runVideoGeneration = async (
  res: Response,
  message: string,
  model: string,
): Promise<string> => {
  // 立即推送一条 "任务排队中" 的提示
  writeSse(res, 'delta', { delta: '🎬 视频生成任务已提交，预计需要 30-60 秒，请耐心等待' });

  const result = await videoGeneration(message, model, (ev) => {
    if (ev.type === 'submitted') {
      writeSse(res, 'delta', { delta: `（任务 ID:${ev.task_id}）\n` });
    } else if (ev.type === 'polling') {
      // 每次轮询输出一个 "." 作为心跳，避免连接被中间层关闭
      writeSse(res, 'delta', { delta: '.' });
    }
  });

  if (result.video_urls.length === 0) {
    const fallback = '\n\n⚠️ 视频生成成功但未返回视频地址，请稍后到智谱平台查看任务结果。';
    writeSse(res, 'delta', { delta: fallback });
    return fallback.trim();
  }

  const finalText = formatVideoMarkdown(result.video_urls, result.cover_urls);
  writeSse(res, 'delta', { delta: `\n${finalText}` });
  return finalText.trim();
};

/**
 * 处理文生图/文生视频模型的请求（非流式，直接返回生成结果）
 * @param {Response} res - Express 响应对象
 * @param {string} email - 用户邮箱
 * @param {string | undefined} convId - 会话 ID（可选）
 * @param {string} message - 用户输入
 * @param {string} [model] - 模型 ID
 * @returns {Promise<void>}
 * @description SSE 已由调用方配置；本函数仅负责事件推送、最终结果落库
 */
export const handleGenerativeModel = async (
  res: Response,
  email: string,
  convId: string | undefined,
  message: string,
  model?: string,
): Promise<void> => {
  // 1) 获取或创建会话
  let conv: ChatConversation | null = convId ? await readConversation(email, convId) : null;
  if (!conv) {
    conv = await createConversation(email);
  }
  conv.messages.push({ role: 'user', content: message, created_at: Date.now() });

  // 2) 立即发送 meta 事件
  writeSse(res, 'meta', {
    conversation_id: conv.id,
    title: conv.title,
    available_tools: [],
    model_type: 'generative',
  });

  try {
    // 3) 视频模型走异步任务（内部已通过 SSE 增量推送进度），其他生成模型走同步 /images/generations
    const isVideo = isVideoModel(model ?? '');
    const contentToSave = isVideo
      ? await runVideoGeneration(res, message, model ?? '')
      : await runImageGeneration(message, model ?? '');

    // 4) 非视频模型：将完整结果一次性 delta 推送给前端
    //    视频模型：进度与最终结果已在 runVideoGeneration 内部按需推送，此处不重复发送
    if (!isVideo && contentToSave) {
      writeSse(res, 'delta', { delta: contentToSave });
    }

    // 5) 保存助手消息到会话
    conv.messages.push({
      role: 'assistant',
      content: contentToSave,
      created_at: Date.now(),
    });
    await replaceMessages(email, conv.id, conv.messages);

    writeSse(res, 'done', { conversation_id: conv.id });
  } catch (err) {
    writeSse(res, 'error', { message: (err as Error).message });
  } finally {
    res.end();
  }
};
