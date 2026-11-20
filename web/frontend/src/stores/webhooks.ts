import { defineStore } from 'pinia';
import { ref } from 'vue';
import { WebhookService } from '@/services/webhook-service';
import type { Webhook, WebhookPayload } from '@/types/webhook';
import { MessagePlugin } from 'tdesign-vue-next';
import { useLocaleStore } from '@/stores/locale';

/**
 * Webhook管理全局Store类
 * @description 管理Webhook（机器人）相关的全局状态，供多个页面/组件共享使用
 */
export class WebhooksStore {
  // ==============================
  // 状态变量
  // ==============================
  public webhooks = ref<Webhook[]>([]);
  public loading = ref(false);

  // ==============================
  // 依赖注入
  // ==============================
  private webhookService: WebhookService = new WebhookService();
  private messagePlugin = MessagePlugin;

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 获取Webhook列表
   * @param {boolean} force - 是否强制刷新，默认 false（有缓存时跳过请求）
   * @returns {Promise<void>}
   * @description 从服务端获取Webhook数据并更新状态；有缓存时默认复用，避免重复请求
   */
  fetchWebhooks = async (force: boolean = false): Promise<void> => {
    if (!force && this.webhooks.value.length > 0) return;
    this.loading.value = true;
    try {
      const { data: { webhooks } } = await this.webhookService.fetchWebhooks();
      this.webhooks.value = webhooks;
    } catch {
      // 请求失败时保持原有数据，不阻塞页面
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * 添加Webhook
   * @param {WebhookPayload} payload - Webhook创建参数
   * @returns {Promise<Webhook>}
   * @description 创建新Webhook并添加到列表
   */
  addWebhook = async (payload: WebhookPayload): Promise<Webhook> => {
    const { data: { webhook } } = await this.webhookService.createWebhook(payload);
    this.webhooks.value.push(webhook);
    this.messagePlugin.success(useLocaleStore().t.config.webhookAdded);
    return webhook;
  }

  /**
   * 编辑Webhook
   * @param {string} id - Webhook ID
   * @param {Partial<WebhookPayload>} payload - Webhook更新参数
   * @returns {Promise<Webhook>}
   * @description 更新指定Webhook的信息
   */
  editWebhook = async (id: string, payload: Partial<WebhookPayload>): Promise<Webhook> => {
    const { data: { webhook } } = await this.webhookService.updateWebhook(id, payload);
    const idx = this.webhooks.value.findIndex((w) => w.id === id);
    if (idx !== -1) {
      this.webhooks.value[idx] = webhook;
    }
    this.messagePlugin.success(useLocaleStore().t.config.webhookUpdated);
    return webhook;
  }

  /**
   * 删除Webhook
   * @param {string} id - Webhook ID
   * @returns {Promise<void>}
   * @description 删除指定Webhook
   */
  removeWebhook = async (id: string): Promise<void> => {
    await this.webhookService.deleteWebhook(id);
    this.webhooks.value = this.webhooks.value.filter((w) => w.id !== id);
    this.messagePlugin.success(useLocaleStore().t.config.webhookDeleted);
  }
}

/**
 * 创建Webhooks Store实例的工厂函数
 * @description 将WebhooksStore类包装为Pinia可用的Store
 */
export const useWebhooksStore = defineStore('webhooks', () => {
  const store = new WebhooksStore();

  return {
    ...store,
  };
});
