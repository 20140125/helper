import { PROJECT_DIR } from '@/utils/paths';

/** Webhook 数据文件路径 */
export const WEBHOOKS_FILE = `${PROJECT_DIR}/.cache/webhooks.json`;

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
