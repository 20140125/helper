import type { ApiResponse } from './api';

/** 企业微信机器人 Webhook */
export interface Webhook {
  id: string;
  name: string;
  url: string;
  created_at: string;
  updated_at: string;
  style: string;
}

/** 创建/更新 Webhook 请求体 */
export type WebhookPayload = Pick<Webhook, 'name' | 'url' | 'style'>;

/** 获取 Webhook 列表响应 */
export type WebhooksResponse = ApiResponse<{ webhooks: Webhook[] }>;

/** 单个 Webhook 操作响应（创建/更新） */
export type WebhookResponse = ApiResponse<{ webhook: Webhook }>;

/** 删除 Webhook 操作响应（无数据返回） */
export type WebhookDeleteResult = ApiResponse;
