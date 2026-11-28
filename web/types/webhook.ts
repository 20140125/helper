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
export interface WebhookBody {
  name?: string;
  url?: string;
  style?: string;
}
