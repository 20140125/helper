import { defineStore } from 'pinia';
import { ref } from 'vue';
import { BootstrapService } from '@/services/bootstrap-service';
import { useStatusStore } from '@/stores/status';
import { useRulesStore } from '@/stores/rules';
import { SYSTEM_STATUS_POLL_MS } from '@/constants/polling';
import type { LogSourceInfo } from '@/types/log';

/**
 * 首页首屏聚合数据 Store 类
 * @description 一次请求拉取 dashboard 首屏所需的 4 类数据，并分发到各业务 Store
 */
export class BootstrapStore {
  /**
   * 日志来源列表
   * @type {Ref<LogSourceInfo[]>}
   * @description 聚合响应到达后写入，保留供兼容入口使用
   */
  logs = ref<LogSourceInfo[]>([]);

  /**
   * 聚合数据是否已就绪
   * @type {Ref<boolean>}
   * @description 为 true 时仪表盘不再重复请求规则
   */
  loaded = ref(false);

  /**
   * 聚合请求加载状态
   * @type {Ref<boolean>}
   * @description 供调用方展示加载态
   */
  loading = ref(false);

  /**
   * 在途聚合请求
   * @type {Promise<void> | null}
   * @description 多个入口并发调用时复用同一份结果
   */
  private loadPromise: Promise<void> | null = null;

  /**
   * 首屏聚合服务实例
   * @type {BootstrapService}
   * @description 用于请求 /api/bootstrap
   */
  private bootstrapService: BootstrapService = new BootstrapService();

  /**
   * 加载并分发首屏聚合数据
   * @returns {Promise<void>}
   * @description 路由守卫与登录成功后共用；成功后只启动状态轮询（统一 30s 周期），
   *   失败时降级为原有的两个状态请求，让仪表盘按旧路径兜底拉取规则
   */
  load = async (): Promise<void> => {
    if (this.loaded.value) {
      useStatusStore().startPolling();
      return;
    }
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async (): Promise<void> => {
      this.loading.value = true;
      const statusStore = useStatusStore();
      const rulesStore = useRulesStore();
      try {
        const { data } = await this.bootstrapService.fetchBootstrap();
        if (data.system) statusStore.hydrateSystem(data.system);
        if (data.webService) statusStore.hydrateWebService(data.webService);
        if (data.rules) rulesStore.hydrateRules(data.rules);
        this.setLogs(data.logs ?? []);
        this.loaded.value = true;
        statusStore.startPolling();
      } catch {
        // 聚合接口不可用时降级：立即拉一次状态，仪表盘 init 会兜底拉规则
        this.loaded.value = false;
        statusStore.startPolling(SYSTEM_STATUS_POLL_MS, true);
      } finally {
        this.loading.value = false;
        this.loadPromise = null;
      }
    })();
    return this.loadPromise;
  };

  /**
   * 写入日志来源列表
   * @param {LogSourceInfo[]} logs - 按 hp_run_logs.source 聚合出的来源列表
   * @returns {void}
   * @description 写入聚合响应中的日志来源，避免切回首页时被旧快照覆盖
   */
  setLogs = (logs: LogSourceInfo[]): void => {
    this.logs.value = logs;
  };

  /**
   * 重置聚合数据
   * @returns {void}
   * @description 重新登录时清空缓存，强制按新身份重新拉取
   */
  reset = (): void => {
    this.loadPromise = null;
    this.loaded.value = false;
    this.logs.value = [];
  };
}

/**
 * 创建首屏聚合 Store 实例的工厂函数
 * @description 将 BootstrapStore 类包装为 Pinia 可用的 Store
 */
export const useBootstrapStore = defineStore('bootstrap', () => {
  const store = new BootstrapStore();

  return {
    ...store,
  };
});
