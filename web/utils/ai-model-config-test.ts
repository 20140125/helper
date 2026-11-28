import { readAiModelGroups } from './ai-model-config';
import type { AiModelTestBody, AiModelTestResult } from '@/types/ai-model-config';

/** 单模型连通性测试的超时时间（毫秒） */
const TEST_TIMEOUT_MS = 15000;

/**
 * 解析测试请求应使用的端点与 API Key
 * @param {AiModelTestBody} input - 测试请求体
 * @returns {Promise<{ baseUrl: string; apiKey: string }>} 端点与真实 Key
 * @description 新增配置时表单里是明文 Key，优先使用；编辑时拿到的是脱敏串，
 *   先按 groupId 取当前配置组的真实 Key（能覆盖组内新增的未保存模型），
 *   没有 groupId 时再按模型 ID 反查已保存配置组
 */
const resolveTestTarget = async (input: AiModelTestBody): Promise<{ baseUrl: string; apiKey: string }> => {
  const modelId = String(input.modelId ?? '').trim();
  const groups = await readAiModelGroups();
  const saved = (input.groupId ? groups.find((group) => group.id === input.groupId) : undefined)
    ?? groups.find((group) => group.models.some((model) => model.id === modelId));
  const rawBaseUrl = String(input.baseUrl ?? '').trim() || String(saved?.baseUrl ?? '').trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const inputKey = String(input.apiKey ?? '').trim();
  const apiKey = inputKey && !inputKey.includes('*') ? inputKey : saved?.apiKey ?? '';
  return { baseUrl, apiKey };
};

/**
 * 整理 fetch 异常的可读原因
 * @param {unknown} err - 捕获到的异常
 * @returns {string} 可直接展示给用户的错误说明
 * @description Node fetch 把真实网络原因放在 err.cause 里，只取 err.message 会得到无信息量的 "fetch failed"；
 *   模型测试与主对话链路共用，避免贾维斯只报 "fetch failed"
 */
export const describeFetchError = (err: unknown): string => {
  if (!(err instanceof Error)) return '请求失败';
  if (err.name === 'AbortError' || /aborted/i.test(err.message)) return '请求超时';
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  if (cause?.code === 'UND_ERR_CONNECT_TIMEOUT') return '连接超时：无法直连模型服务，请检查网络或代理配置';
  if (cause?.message === 'Request was cancelled.') return '代理连接失败或握手超时，请检查代理服务是否可用';
  return cause?.message ? `${err.message}：${cause.message.slice(0, 160)}` : err.message;
};

/**
 * 测试单个模型能否完成一次真实对话请求
 * @param {AiModelTestBody} input - 模型 ID 与可选的端点 / Key
 * @returns {Promise<AiModelTestResult>} 可用性、耗时与失败原因
 * @description 发一次非流式、max_tokens=16 的最小 chat/completions；
 *   不写入任何配置，仅返回探测结果，失败信息统一截断避免把远端长响应带回前端
 */
export const testModelAvailability = async (input: AiModelTestBody): Promise<AiModelTestResult> => {
  const modelId = String(input.modelId ?? '').trim();
  if (!modelId) throw new Error('请先填写模型 ID');
  const { baseUrl, apiKey } = await resolveTestTarget(input);
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('请先填写 http(s) 开头的接口地址');
  if (!apiKey) throw new Error('请先填写 API Key 或先保存配置组');

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 16,
        stream: false,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const text = await resp.text();
    if (!resp.ok) {
      return { ok: false, latencyMs, message: `HTTP ${resp.status}：${text.slice(0, 200)}` };
    }
    let reply = '';
    try {
      const payload = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
      reply = String(payload.choices?.[0]?.message?.content ?? '').trim().slice(0, 120);
    } catch {
      // 非 JSON 响应不影响可用性判定
    }
    return { ok: true, latencyMs, message: '', reply };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: describeFetchError(err),
    };
  } finally {
    clearTimeout(timer);
  }
};
