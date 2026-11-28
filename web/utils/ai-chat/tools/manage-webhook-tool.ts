import { readWebhooks, writeWebhooks, formatDate } from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 生成新 Webhook 的 id
 * @returns {string} 形如 webhook_1712345678901 的 id
 */
const newId = (): string => `webhook_${Date.now()}`;

/**
 * 对 Webhook URL 做脱敏（与 query_webhooks 保持一致）
 * @param {string} url - 原始 URL
 * @returns {string} 脱敏后的 URL
 */
const maskUrl = (url: string): string => {
  const qIndex = url.indexOf('?');
  return qIndex === -1 ? url : `${url.slice(0, qIndex)}?***`;
};

/**
 * manage_webhook 工具实现（企微机器人写能力）
 * @description query_webhooks 只能看（且 URL 脱敏），增删改此前只能去 Web「系统配置」页。
 *   本工具补齐 create / update / delete，并纳入增删改白名单——严格模式下会先建审批单。
 *   写回时沿用 routes/webhooks.ts 的口径：url 含 `*` 视为脱敏串，拒绝保存。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "加一个叫运维群的机器人，地址是 https://..."  → { action: 'create', name: '运维群', url: '...' }
 *   - "把运维群机器人改名为值班群"                  → { action: 'update', id: 'webhook_xxx', name: '值班群' }
 *   - "删掉那个测试机器人"                          → { action: 'delete', id: 'webhook_xxx' }
 */
export const manageWebhookTool: ToolImpl = {
  name: 'manage_webhook',
  description:
    '新增 / 修改 / 删除企业微信机器人（Webhook）。action：create（必传 name + url）、'
    + 'update（必传 id，再传要改的 name / url / style）、delete（必传 id，不可恢复）。'
    + 'id 形如 webhook_xxx，不确定时先调 query_webhooks 查清单，不要用名称猜 id。'
    + 'url 必须是完整地址：带 `*` 的脱敏串会被拒绝。删除前先跟用户确认删的是哪一个。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'update', 'delete'],
        description: '操作类型：create / update / delete',
      },
      id: { type: 'string', description: 'Webhook ID（update / delete 必填），先用 query_webhooks 查' },
      name: { type: 'string', description: '机器人名称（create 必填；update 可选）' },
      url: { type: 'string', description: '完整 Webhook 地址（create 必填；update 可选，不能是脱敏串）' },
      style: { type: 'string', description: '消息风格（update 时可选）' },
    },
    required: ['action'],
  },
  requiredPermissions: ['webhook:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const action = typeof args.action === 'string' ? args.action.trim() : '';
    const webhooks = await readWebhooks();

    if (action === 'create') {
      const name = typeof args.name === 'string' ? args.name.trim() : '';
      const url = typeof args.url === 'string' ? args.url.trim() : '';
      if (!name || !url) {
        return { ok: false, data: '缺少必填字段：name 与 url' };
      }
      if (url.includes('*')) {
        return { ok: false, data: 'url 不能是脱敏串（含 *），请提供完整地址' };
      }
      const created = {
        id: newId(),
        name,
        url,
        style: typeof args.style === 'string' ? args.style : '',
        created_at: formatDate(),
        updated_at: formatDate(),
      };
      webhooks.push(created);
      await writeWebhooks(webhooks);
      return {
        ok: true,
        data: { ...created, url: maskUrl(created.url) },
        summary: `已新增机器人「${name}」（${created.id}）`,
      };
    }

    if (action === 'update') {
      const id = typeof args.id === 'string' ? args.id.trim() : '';
      const idx = webhooks.findIndex((w) => w.id === id);
      if (idx === -1) {
        return { ok: false, data: `Webhook 不存在：${id || '(空)'}；先调 query_webhooks 查 id` };
      }
      const existing = webhooks[idx];
      if (typeof args.url === 'string' && args.url.includes('*')) {
        return { ok: false, data: 'url 不能是脱敏串（含 *），请提供完整地址' };
      }
      const updated = {
        id,
        name: typeof args.name === 'string' ? args.name.trim() : existing.name,
        url: typeof args.url === 'string' ? args.url.trim() : existing.url,
        style: typeof args.style === 'string' ? args.style : existing.style,
        created_at: existing.created_at,
        updated_at: formatDate(),
      };
      webhooks[idx] = updated;
      await writeWebhooks(webhooks);
      return {
        ok: true,
        data: { ...updated, url: maskUrl(updated.url) },
        summary: `已更新机器人「${updated.name}」（${id}）`,
      };
    }

    if (action === 'delete') {
      const id = typeof args.id === 'string' ? args.id.trim() : '';
      const target = webhooks.find((w) => w.id === id);
      const filtered = webhooks.filter((w) => w.id !== id);
      if (!target) {
        return { ok: false, data: `Webhook 不存在：${id || '(空)'}；先调 query_webhooks 查 id` };
      }
      await writeWebhooks(filtered);
      return { ok: true, data: { id }, summary: `已删除机器人「${target.name}」（${id}）` };
    }

    return { ok: false, data: `不支持的 action：${action}（只支持 create / update / delete）` };
  },
};
