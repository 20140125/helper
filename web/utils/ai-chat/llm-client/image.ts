import { getLlmConfigForModel } from './config';

/** 文生图任务响应（私有：仅本文件使用） */
interface ImageGenerationResponse {
  /** 部分模型返回根级 data 数组（智谱 CogView-4 标准格式：[{ url }]） */
  data?: Array<{ url?: string; b64_json?: string }>;
  /** 兼容 OpenAI 同名字段，但智谱目前未返回 */
  created?: number;
}

/** 文生图结果 */
export interface ImageGenerationResult {
  /** 生成的图片 URL 列表 */
  image_urls: string[];
}

/**
 * 调用智谱文生图 API（同步 /images/generations）
 * @param {string} prompt - 图像生成提示词
 * @param {string} model - 模型 ID（如 cogview-4、cogview-3-flash）
 * @param {AbortSignal} [signal] - 终止信号
 * @returns {Promise<ImageGenerationResult>} 生成的图片 URL 列表
 * @description 智谱 CogView 系列走独立的 /images/generations 端点，不走 /chat/completions。
 *   - 请求体：{ model, prompt }
 *   - 响应体：{ data: [{ url }] }
 */
export const imageGeneration = async (
  prompt: string,
  model: string,
  signal?: AbortSignal,
): Promise<ImageGenerationResult> => {
  const cfg = getLlmConfigForModel(model);
  const resp = await fetch(`${cfg.baseUrl}/images/generations`, {
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
    throw new Error(`文生图请求失败：${resp.status} ${text.slice(0, 200)}`);
  }
  const json = (await resp.json()) as ImageGenerationResponse;
  const image_urls = (json.data ?? [])
    .map((it) => it.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  return { image_urls };
};
