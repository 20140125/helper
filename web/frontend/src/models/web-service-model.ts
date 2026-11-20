import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { WebServiceService } from '@/services/web-service-service';
import { BaseModel } from '@/models/base-model';
import { WEB_SERVICE_STATUS_POLL_MS } from '@/constants/polling';

/**
 * Web服务页面数据模型类
 * @description 管理Web服务页面的所有业务逻辑，包括服务状态查询、启动/停止/重启操作、输出日志管理及状态轮询
 */
export class WebServiceModel extends BaseModel {
  // ==============================
  // 依赖注入（service）
  // ==============================

  /**
   * Web服务服务实例
   * @type {WebServiceService}
   * @description 用于查询和控制Web服务状态
   */
  webServiceService: WebServiceService = new WebServiceService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * Web服务运行状态
   * @type {Ref<boolean>}
   * @description 标识Web服务是否正在运行
   */
  running: Ref<boolean> = ref(false);

  /**
   * Web服务进程ID
   * @type {Ref<number | null>}
   * @description Web服务运行时的进程ID，未运行时为null
   */
  pid: Ref<number | null> = ref<number | null>(null);

  /**
   * 操作输出日志
   * @type {Ref<string>}
   * @description 记录服务操作的输出信息
   */
  output: Ref<string> = ref('');

  // ==============================
  // 定时器
  // ==============================

  /**
   * 状态轮询定时器
   * @type {ReturnType<typeof setInterval> | null}
   * @description 定时轮询Web服务运行状态，间隔由 WEB_SERVICE_STATUS_POLL_MS 控制
   */
  pollTimer: ReturnType<typeof setInterval> | null = null;

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载Web服务状态
   * @returns {Promise<void>}
   * @description 查询当前Web服务的运行状态和进程ID
   */
  loadStatus = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { data: { running, pid } } = await this.webServiceService.fetchWebServiceStatus();
      this.running.value = running;
      this.pid.value = pid;
    } catch {
      // 静默失败，不影响页面
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 启动Web服务
   * @returns {Promise<void>}
   * @description 调用API启动Web服务，并更新运行状态
   */
  handleStart = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { code, data: { stdout }, message } = await this.webServiceService.startWebService();
      this.appendOutput(stdout ?? message ?? '');
      if (code === 0) {
        MessagePlugin.success(this.localeStore.t.dashboard.webStarted);
      } else {
        MessagePlugin.error(message ?? this.localeStore.t.dashboard.webStartFailed);
      }
      await this.loadStatus();
    } catch (e: unknown) {
      MessagePlugin.error(e instanceof Error ? e.message : this.localeStore.t.dashboard.webStartFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 停止Web服务
   * @returns {Promise<void>}
   * @description 调用API停止Web服务，并更新运行状态
   */
  handleStop = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { code, data: { stdout }, message } = await this.webServiceService.stopWebService();
      this.appendOutput(stdout ?? message ?? '');
      if (code === 0) {
        MessagePlugin.success(this.localeStore.t.dashboard.webStopped);
      }
      await this.loadStatus();
    } catch (e: unknown) {
      MessagePlugin.error(e instanceof Error ? e.message : this.localeStore.t.dashboard.webStopFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 重启Web服务
   * @returns {Promise<void>}
   * @description 调用API重启Web服务，等待服务重新上线（最多约20秒），并更新运行状态
   */
  handleRestart = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { data: { stdout }, message } = await this.webServiceService.restartWebService();
      this.appendOutput(stdout ?? message ?? '');
      MessagePlugin.info(this.localeStore.t.dashboard.webRestarting);
      // 重启会杀掉当前进程，等待服务重新上线（最多 20 秒）
      this.running.value = false;
      this.pid.value = null;
      await this.waitForRestart();
    } catch {
      // 请求可能因连接断开而失败，这是正常的
      MessagePlugin.info(this.localeStore.t.dashboard.webRestarting);
      this.running.value = false;
      this.pid.value = null;
      await this.waitForRestart();
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 清空输出日志
   * @returns {void}
   * @description 清除操作输出日志内容
   */
  clearOutput = (): void => {
    this.output.value = '';
  };

  /**
   * 开始状态轮询
   * @returns {void}
   * @description 按 WEB_SERVICE_STATUS_POLL_MS 间隔轮询Web服务运行状态
   */
  startPolling = (): void => {
    this.pollTimer = setInterval(this.loadStatus, WEB_SERVICE_STATUS_POLL_MS);
  };

  /**
   * 停止状态轮询
   * @returns {void}
   * @description 清除状态轮询定时器，防止内存泄漏
   */
  stopPolling = (): void => {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  };

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 追加输出日志
   * @param {string} text - 要追加的文本内容
   * @returns {void}
   * @description 将新的输出内容追加到日志顶部
   */
  private appendOutput = (text: string): void => {
    const lines = text.trim();
    if (!lines) return;
    this.output.value = lines + (this.output.value ? `\n\n${this.output.value}` : '');
  };

  /**
   * 等待服务重启完成
   * @returns {Promise<void>}
   * @description 等待初始延迟后，轮询检查服务是否重新上线，最多重试17次
   */
  private waitForRestart = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 9527));
    let success = false;
    for (let i = 0; i < 17; i++) {
      try {
        const { data: { running, pid } } = await this.webServiceService.fetchWebServiceStatus();
        if (running) {
          this.running.value = running;
          this.pid.value = pid;
          success = true;
          break;
        }
      } catch {
        // 服务还没起来，继续等待
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (success) {
      MessagePlugin.success(this.localeStore.t.dashboard.webRestarted);
    } else {
      MessagePlugin.error(this.localeStore.t.dashboard.webRestartTimeout);
      await this.loadStatus();
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载服务状态并启动轮询
   */
  mounted = (): void => {
    this.loadStatus();
    this.startPolling();
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 停止状态轮询，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.stopPolling();
  };
}

/**
 * Composition API 包装函数
 * @description 将WebServiceModel类包装为Composition API可用的函数
 */
export const useWebServiceModel = () => {
  const model = new WebServiceModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => { model.mounted(); });

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {
    ...model,
  };
};
