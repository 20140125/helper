import type { VideoGenerationResult, VideoProgressEvent } from '@/types/ai-chat';
import { getLlmConfigForModel } from './config';

/** 视频生成任务提交响应（私有：仅本文件使用） */
interface VideoTaskCreateResponse {
  id: string;
  request_id?: string;
  model?: string;
  task_status: 'PROCESSING' | 'SUCCESS' | 'FAIL';
}

/** 视频生成任务查询响应（私有：仅本文件使用） */
interface VideoTaskQueryResponse {
  task_status: 'PROCESSING' | 'SUCCESS' | 'FAIL';
  video_result?: Array<{ url?: string; cover_image_url?: string }>;
}

/** 视频任务轮询配置 */
const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * 提交视频生成任务（智谱 /videos/generations）
 * @param {string} prompt - 提示词
 * @param {string} model - 模型 ID
 * @param {AbortSignal} [signal] - 终止信号
 * @returns {Promise<string>} 任务 ID
 */
const submitVideoTask = async (
  prompt: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> => {
  const cfg = getLlmConfigForModel(model);
  const resp = await fetch(`${cfg.baseUrl}/videos/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model, prompt }),
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`视频任务提交失败：${resp.status} ${text.slice(0, 200)}`);
  }
  const json = (await resp.json()) as VideoTaskCreateResponse;
  if (!json.id) {
    throw new Error('视频任务提交返回数据缺少 id');
  }
  return json.id;
};

/**
 * 查询视频生成任务状态（智谱 /async-result/{id}）
 * @param {string} taskId - 任务 ID
 * @param {AbortSignal} [signal] - 终止信号
 * @returns {Promise<VideoTaskQueryResponse>} 任务查询响应
 */
const queryVideoTask = async (
  taskId: string,
  signal?: AbortSignal,
): Promise<VideoTaskQueryResponse> => {
  const cfg = getLlmConfigForModel(undefined);
  const resp = await fetch(`${cfg.baseUrl}/async-result/${taskId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`视频任务查询失败：${resp.status} ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as VideoTaskQueryResponse;
};

/**
 * 把视频任务查询响应转换为业务结果
 * @param {VideoTaskQueryResponse} queryJson - 查询响应
 * @returns {VideoGenerationResult} 转换后的结果
 */
const buildVideoResult = (queryJson: VideoTaskQueryResponse): VideoGenerationResult => {
  const items = queryJson.video_result ?? [];
  return {
    video_urls: items
      .map((it) => it.url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0),
    cover_urls: items
      .map((it) => it.cover_image_url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0),
  };
};

/**
 * 调用智谱视频生成 API（异步任务模式）
 * @param {string} prompt - 视频生成提示词
 * @param {string} model - 模型 ID（如 cogvideox-flash）
 * @param {(ev: VideoProgressEvent) => void} [onProgress] - 进度回调
 * @param {AbortSignal} [signal] - 终止信号
 * @returns {Promise<VideoGenerationResult>} 生成的视频 URL 列表
 * @description 接口规范：
 *   1) POST {baseUrl}/videos/generations  body:{ model, prompt } 返回 task_id
 *   2) GET  {baseUrl}/async-result/{task_id} 直到 task_status === 'SUCCESS'
 */
export const videoGeneration = async (
  prompt: string,
  model: string,
  onProgress?: (ev: VideoProgressEvent) => void,
  signal?: AbortSignal,
): Promise<VideoGenerationResult> => {
  const taskId = await submitVideoTask(prompt, model, signal);
  onProgress?.({ type: 'submitted', task_id: taskId });

  const startedAt = Date.now();
  while (true) {
    if (signal?.aborted) {
      throw new Error('视频生成已被取消');
    }
    if (Date.now() - startedAt > VIDEO_POLL_TIMEOUT_MS) {
      throw new Error('视频生成超时（超过 5 分钟），请稍后到智谱平台查看任务结果');
    }

    await new Promise<void>((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
    onProgress?.({ type: 'polling', task_id: taskId, elapsed_ms: Date.now() - startedAt });

    const queryJson = await queryVideoTask(taskId, signal);
    if (queryJson.task_status === 'FAIL') {
      throw new Error('视频生成任务失败，请稍后重试');
    }
    if (queryJson.task_status === 'SUCCESS') {
      return buildVideoResult(queryJson);
    }
    // PROCESSING：继续下一轮
  }
};
