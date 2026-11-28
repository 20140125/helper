import { Router } from 'express';
import { readWebhooks, writeWebhooks, formatDate, returnResponse, ErrorCode } from './utils';
import { Webhook, WebhookBody } from '@/types/webhook';

const router = Router();

/**
 * 获取 Webhook 列表
 * @route GET /webhooks
 * @returns {{ ok: boolean, webhooks: Webhook[] }} 脱敏后的 Webhook 列表（url 中的 key 只显示后 8 位）
 */
router.get('/', async (_req, res) => {
  const webhooks = await readWebhooks();
  // 脱敏：url 中的 key 只显示后8位；只输出规范字段，剔除历史残留
  const masked = webhooks.map((w) => ({
    id: w.id,
    name: w.name,
    url: w.url.replace(
      /(key=)([^&]+)/,
      (_match: string, prefix: string, key: string) =>
        `${prefix}${'*'.repeat(Math.max(0, key.length - 8))}${key.slice(-8)}`,
    ),
    style: w.style,
    created_at: w.created_at,
    updated_at: w.updated_at,
  }));
  return returnResponse(res, ErrorCode.SUCCESS, { webhooks: masked }, 'success');
});

/**
 * 创建 Webhook
 * @route POST /webhooks
 * @param {string} name - Webhook 名称
 * @param {string} url - Webhook 地址
 * @returns {{ ok: boolean, webhook: Webhook }} 新创建的 Webhook 对象
 */
router.post('/', async (req, res) => {
  const { name, url, style } = req.body as WebhookBody;
  if (!name || !url) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：name, url');
  }
  const webhooks = await readWebhooks();
  const newWebhook: Webhook = {
    id: `webhook_${Date.now()}`,
    name,
    url,
    style: style ?? '',
    created_at: formatDate(),
    updated_at: formatDate(),
  };
  webhooks.push(newWebhook);
  await writeWebhooks(webhooks);
  return returnResponse(res, ErrorCode.SUCCESS, { webhook: newWebhook }, 'success');
});

/**
 * 更新 Webhook
 * @route PUT /webhooks/:id
 * @param {string} id - Webhook ID
 * @param {string} [name] - 新的 Webhook 名称
 * @param {string} [url] - 新的 Webhook 地址（不允许传入含 * 的脱敏串）
 * @returns {{ ok: boolean, webhook: Webhook }} 更新后的 Webhook 对象
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const webhooks = await readWebhooks();
  const idx = webhooks.findIndex((w) => w.id === id);
  if (idx === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, 'Webhook 不存在');
  }
  const { name, url, style } = req.body as WebhookBody;
  // 防止脱敏值被写入：若 url 包含 * 号，说明是前端展示的脱敏串，拒绝保存
  if (url !== undefined && url.includes('*')) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'Webhook 地址无效，请重新输入完整地址');
  }
  const existing = webhooks[idx];
  const updated: Webhook = {
    id,
    name: name ?? existing.name,
    url: url ?? existing.url,
    style: style ?? existing.style,
    created_at: existing.created_at,
    updated_at: formatDate(),
  };
  webhooks[idx] = updated;
  await writeWebhooks(webhooks);
  return returnResponse(res, ErrorCode.SUCCESS, { webhook: updated }, 'success');
});

/**
 * 删除 Webhook
 * @route DELETE /webhooks/:id
 * @param {string} id - Webhook ID
 * @returns {{ ok: boolean, message: string }} 删除结果
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const webhooks = await readWebhooks();
  const filtered = webhooks.filter((w) => w.id !== id);
  if (filtered.length === webhooks.length) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, 'Webhook 不存在');
  }
  await writeWebhooks(filtered);
  return returnResponse(res, ErrorCode.SUCCESS, {}, 'Webhook 已删除');
});

export default router;
