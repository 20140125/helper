import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { useRouter } from 'vue-router';
import { StatusService } from '@/services/status-service';
import { WebServiceService } from '@/services/web-service-service';
import { useStatusStore } from '@/stores/status';
import { useRulesStore } from '@/stores/rules';
import { useBootstrapStore } from '@/stores/bootstrap';
import { MessagePlugin } from 'tdesign-vue-next';
import { getRuleTypeLabel, getWeekdays } from '@/constants/rules';
import { BaseModel, Permission } from '@/models/base-model';
import { formatUptimeSeconds, formatBytesUsage } from '@/utils/format';
import { groupRulesByType } from '@/utils/rules';

/**
 * 仪表盘页面数据模型类
 * @description 管理仪表盘页面的所有业务逻辑，包括系统状态监控、守护进程控制、Web服务管理等
 */
export class DashboardModel extends BaseModel {
  /**
   * 路由实例
   * @type {ReturnType<typeof useRouter>}
   * @description 用于页面导航和路由跳转
   */
  router: ReturnType<typeof useRouter> = useRouter();
  
  /**
   * 状态存储实例
   * @type {ReturnType<typeof useStatusStore>}
   * @description 用于访问和修改系统状态数据
   */
  statusStore: ReturnType<typeof useStatusStore> = useStatusStore();

  /**
   * 规则存储实例
   * @type {ReturnType<typeof useRulesStore>}
   * @description 用于访问和修改自定义规则数据
   */
  rulesStore: ReturnType<typeof useRulesStore> = useRulesStore();

  /**
   * 状态服务实例
   * @type {StatusService}
   * @description 用于系统状态查询和守护进程控制
   */
  statusService: StatusService = new StatusService();

  /**
   * Web服务实例
   * @type {WebServiceService}
   * @description 用于Web服务启停重启操作
   */
  webServiceService: WebServiceService = new WebServiceService();

  // ==============================
  // 状态变量
  // ==============================

  /**
   * 初始化加载状态
   * @type {Ref<boolean>}
   * @description 页面初始化时的加载状态
   */
  initLoading: Ref<boolean> = ref(false);
  
  /**
   * 刷新状态
   * @type {Ref<boolean>}
   * @description 手动刷新页面数据时的loading状态
   */
  refreshing: Ref<boolean> = ref(false);
  
  /**
   * 守护进程操作加载状态
   * @type {Ref<boolean>}
   * @description 启动/停止/重启守护进程操作时的loading状态
   */
  daemonLoading: Ref<boolean> = ref(false);
  
  /**
   * Web服务操作加载状态
   * @type {Ref<boolean>}
   * @description Web服务启动/停止/重启操作时的loading状态
   */
  webLoading: Ref<boolean> = ref(false);
  
  /**
   * 当前时间戳
   * @type {Ref<number>}
   * @description 用于计算守护进程运行时间的基准时间
   */
  now: Ref<number> = ref(Date.now());

  // ==============================
  // 定时器
  // ==============================

  /**
   * 守护进程运行时间更新定时器
   * @type {ReturnType<typeof setInterval> | null}
   * @description 用于每秒更新当前时间戳
   */
  uptimeTimer: ReturnType<typeof setInterval> | null = null;

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 获取已启用的规则数量
   * @type {ComputedRef<number>}
   */
  enabledRulesCount: ComputedRef<number> = computed(
    () => this.rulesStore.rules.filter((r) => r.enabled).length,
  );

  /**
   * 获取规则类型统计摘要
   * @type {ComputedRef<Array<{type: string, label: string, count: number}>>}
   */
  ruleTypeSummary: ComputedRef<Array<{type: string, label: string, count: number}>> = computed(
    () => groupRulesByType(this.rulesStore.rules, getRuleTypeLabel() as Record<string, string>),
  );

  /**
   * 获取今天的星期几显示文本
   * @type {ComputedRef<string>}
   */
  todayWeekday: ComputedRef<string> = computed(() => {
    if (!this.statusStore.serverTime) return '';
    const date = new Date(this.statusStore.serverTime.replace(/\//g, '-'));
    return isNaN(date.getTime()) ? '' : this.localeStore.t.dashboard.todayWeekday(getWeekdays()[date.getDay()]);
  });

  /**
   * 格式化内存使用信息
   * @type {ComputedRef<string>}
   */
  memoryInfo: ComputedRef<string> = computed(() => {
    const mem = this.statusStore.memory;
    return mem ? formatBytesUsage(mem.used, mem.total) : '';
  });

  /**
   * 格式化磁盘使用信息
   * @type {ComputedRef<string>}
   */
  diskInfo: ComputedRef<string> = computed(() => {
    const disk = this.statusStore.disk;
    return disk ? formatBytesUsage(disk.used, disk.total) : '';
  });

  /**
   * 格式化系统运行时长
   * @type {ComputedRef<string>}
   */
  systemUptimeText: ComputedRef<string> = computed(() => {
    const seconds = this.statusStore.systemUptime;
    if (!seconds) return '';
    return this.formatSeconds(seconds);
  });

  /**
   * 服务器信息列表
   * @type {ComputedRef<Array<{label: string, value: string}>>}
   */
  serverInfoItems: ComputedRef<Array<{ label: string; value: string }>> = computed(() => {
    const d = this.localeStore.t.dashboard;
    const items = [
      { label: d.hostname, value: this.statusStore.hostname },
      { label: d.os, value: this.statusStore.osRelease },
      { label: d.kernel, value: this.statusStore.kernelVersion },
      { label: d.cpuCores, value: this.statusStore.cpuCores ? d.cpuCoresUnit(this.statusStore.cpuCores) : '' },
      { label: d.memory, value: this.memoryInfo.value },
      { label: d.disk, value: this.diskInfo.value },
      { label: d.uptime, value: this.systemUptimeText.value },
      { label: 'Node.js', value: this.statusStore.nodeVersion },
    ];
    return items.filter((item) => !!item.value);
  });

  /**
   * 获取守护进程运行时间
   * @type {ComputedRef<string>}
   */
  daemonUptime: ComputedRef<string> = computed(() => {
    if (!this.statusStore.daemonStartTime) return '';
    const seconds = Math.floor((this.now.value - this.statusStore.daemonStartTime) / 1000);
    return seconds >= 0 ? this.formatSeconds(seconds) : '';
  });

  /**
   * 判断页面是否处于加载状态
   * @description 如果任一加载状态为true则返回true（覆盖基类 pageLoading）
   */
  override pageLoading = computed(() => this.initLoading.value || this.daemonLoading.value || this.webLoading.value);

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 格式化秒数为可读的时间字符串
   * @param {number} seconds - 要格式化的秒数
   * @returns {string} 格式化后的时间字符串
   */
  formatSeconds = (seconds: number): string => formatUptimeSeconds(seconds, this.localeStore.t.dashboard);

  /**
   * 加载Web服务状态信息（代理到 statusStore）
   * @returns {Promise<void>}
   */
  loadWebStatus = async (): Promise<void> => {
    await this.statusStore.loadWebStatus();
  };

  /**
   * 启动Web服务
   * @returns {Promise<void>}
   * @description 根据当前Web服务状态选择不同的启动方式
   */
  webStart = async (): Promise<void> => {
    this.webLoading.value = true;
    try {
      const res = this.statusStore.webRunning ? await this.webServiceService.startWebService() : await this.webServiceService.startWebServiceViaLauncher();
      
      if (res.code === 0) {
        MessagePlugin.success(this.localeStore.t.dashboard.webStarted);
      } else {
        MessagePlugin.error(res.message ?? this.localeStore.t.dashboard.webStartFailed);
      }
      
      await this.statusStore.loadWebStatus();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : this.localeStore.t.dashboard.webStartFailedHint;
      MessagePlugin.error(message);
    } finally {
      this.webLoading.value = false;
    }
  };

  /**
   * 停止Web服务
   * @returns {Promise<void>}
   */
  webStop = async (): Promise<void> => {
    this.webLoading.value = true;
    try {
      const res = await this.webServiceService.stopWebService();
      
      if (res.code === 0) {
        MessagePlugin.success(this.localeStore.t.dashboard.webStopped);
      } else {
        MessagePlugin.error(res.message ?? this.localeStore.t.dashboard.webStopFailed);
      }
      
      await this.statusStore.loadWebStatus();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : this.localeStore.t.dashboard.webStopFailed;
      MessagePlugin.error(message);
    } finally {
      this.webLoading.value = false;
    }
  };

  /**
   * 重启Web服务
   * @returns {Promise<void>}
   * @description 优先通过 launcher（3001）重启；launcher 不可达时降级到直接调用 9527 端口重启
   */
  webRestart = async (): Promise<void> => {
    this.webLoading.value = true;
    this.statusStore.webRestarting = true;

    let viaLauncher = false;
    try {
      // 优先通过 launcher 重启（launcher 立即响应，异步执行脚本）
      await this.webServiceService.restartWebServiceViaLauncher();
      viaLauncher = true;
    } catch {
      // launcher 不可达，降级：直接调用 9527 端口的重启接口
      try {
        await this.webServiceService.restartWebService();
      } catch {
        // 9527 端口也不可达（服务已停止），忽略
      }
    }

    // 等待服务重启
    MessagePlugin.info(this.localeStore.t.dashboard.webRestarting);
    this.statusStore.webRunning = false;
    this.statusStore.webPid = null;

    const success = await this.waitForServiceReady(viaLauncher);

    // 处理重启结果
    if (success) {
      MessagePlugin.success(this.localeStore.t.dashboard.webRestarted);
    } else {
      MessagePlugin.error(this.localeStore.t.dashboard.webRestartTimeout);
      await this.checkFinalWebStatus(viaLauncher);
    }

    // 完成重启流程
    this.webLoading.value = false;
    this.statusStore.webRestarting = false;
  };

  /**
   * 检查Web服务状态
   * @param {boolean} viaLauncher - 是否通过 launcher（3001）查询；false 时直接查询 9527 端口
   * @returns {Promise<boolean>} 如果服务正在运行则返回true
   */
  private checkWebServiceStatus = async (viaLauncher: boolean): Promise<boolean> => {
    try {
      const data = viaLauncher
        ? await this.webServiceService.fetchWebServiceStatusViaLauncher()
        : await this.webServiceService.fetchWebServiceStatus(3000);
      if (data.data.running) {
        this.statusStore.webRunning = true;
        this.statusStore.webPid = data.data.pid;
        return true;
      }
    } catch {
      // 服务暂时不可达，继续等待
    }
    return false;
  };

  /**
   * 等待Web服务启动完成
   * @param {boolean} viaLauncher - 是否通过 launcher 轮询状态
   * @returns {Promise<boolean>} 如果服务在59秒内启动成功则返回true
   */
  private waitForServiceReady = async (viaLauncher: boolean): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    for (let i = 0; i < 57; i++) {
      if (await this.checkWebServiceStatus(viaLauncher)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  };

  /**
   * 检查Web服务的最终状态
   * @param {boolean} viaLauncher - 是否通过 launcher 查询
   * @returns {Promise<void>}
   */
  private checkFinalWebStatus = async (viaLauncher: boolean): Promise<void> => {
    try {
      const data = viaLauncher
        ? await this.webServiceService.fetchWebServiceStatusViaLauncher()
        : await this.webServiceService.fetchWebServiceStatus(3000);
      this.statusStore.webRunning = data.data.running;
      this.statusStore.webPid = data.data.pid;
    } catch {
      this.statusStore.webRunning = false;
      this.statusStore.webPid = null;
    }
  };

  /**
   * 执行守护进程动作的通用模板（成功/失败提示 + 状态轮询）
   * @param {() => Promise<{ message?: string }>} action - 真正触发动作的 service 调用
   * @param {string} successText - 成功时的默认文案
   * @param {string} failedText - 失败时的默认文案
   * @param {boolean} expectRunning - 期望的最终运行状态
   */
  private runDaemonAction = async (
    action: () => Promise<{ message?: string }>,
    successText: string,
    failedText: string,
    expectRunning: boolean,
  ): Promise<void> => {
    this.daemonLoading.value = true;
    try {
      const res = await action();
      MessagePlugin.success(res.message || successText);
      await this.waitForDaemonStatus(expectRunning);
    } catch (e: unknown) {
      const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const message = e instanceof Error
        ? e.message
        : apiMessage ?? failedText;
      MessagePlugin.error(message);
    } finally {
      this.daemonLoading.value = false;
    }
  };

  /**
   * 启动守护进程
   * @returns {Promise<void>}
   */
  daemonStart = (): Promise<void> => {
    const d = this.localeStore.t.dashboard;
    return this.runDaemonAction(() => this.statusService.startDaemon(), d.daemonStarted, d.daemonStartFailed, true);
  };

  /**
   * 停止守护进程
   * @returns {Promise<void>}
   */
  daemonStop = (): Promise<void> => {
    const d = this.localeStore.t.dashboard;
    return this.runDaemonAction(() => this.statusService.stopDaemon(), d.daemonStopped, d.daemonStopFailed, false);
  };

  /**
   * 重启守护进程
   * @returns {Promise<void>}
   */
  daemonRestart = (): Promise<void> => {
    const d = this.localeStore.t.dashboard;
    return this.runDaemonAction(() => this.statusService.restartDaemon(), d.daemonRestarted, d.daemonRestartFailed, true);
  };

  /**
   * 等待守护进程达到期望状态
   * @param {boolean} expectRunning - 期望的运行状态（true=运行中，false=已停止）
   * @returns {Promise<void>}
   * @description 脚本返回后新进程可能尚未就绪，延迟后轮询确认状态已更新
   */
  private waitForDaemonStatus = async (expectRunning: boolean): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await this.statusStore.fetchStatus();

    // 若状态未达到期望，最多再重试 5 次（每次间隔 1 秒）
    if (this.statusStore.daemonRunning !== expectRunning) {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await this.statusStore.fetchStatus();
        if (this.statusStore.daemonRunning === expectRunning) break;
      }
    }
  };

  /**
   * 刷新页面数据
   * @returns {Promise<void>}
   * @description 刷新系统状态与 Web 服务状态
   */
  refresh = async (): Promise<void> => {
    this.refreshing.value = true;
    try {
      await Promise.all([
        this.statusStore.fetchStatus(),
        this.statusStore.loadWebStatus(),
      ]);
    } finally {
      this.refreshing.value = false;
    }
  };

  /**
   * 跳转到日志页面
   * @returns {void}
   * @description 导航到详细的日志查看页面
   */
  goToLogs = (): void => {
    this.router.push({ name: 'logs' });
  };

  /**
   * 跳转到手动触发页面
   * @returns {void}
   * @description 导航到手动触发提醒页面
   */
  goToTrigger = (): void => {
    this.router.push({ name: 'trigger' });
  };

  /**
   * 初始化页面数据
   * @returns {Promise<void>}
   * @description 首屏数据优先复用路由守卫触发的 /api/bootstrap 聚合结果；
   *   聚合接口不可用时才降级单独拉取规则
   */
  init = async (): Promise<void> => {
    const bootstrapStore = useBootstrapStore();
    await bootstrapStore.load();
    if (bootstrapStore.loaded) return;
    this.initLoading.value = true;
    try {
      await this.rulesStore.fetchRules();
    } finally {
      this.initLoading.value = false;
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 初始化数据并启动运行时长定时器
   */
  mounted = (): void => {
    this.init();
    this.uptimeTimer = setInterval(() => { this.now.value = Date.now(); }, 1000);
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 清理运行时长定时器，防止内存泄漏
   */
  beforeUnmount = (): void => {
    if (this.uptimeTimer !== null) {
      clearInterval(this.uptimeTimer);
    }
  };
}

/**
 * Composition API 包装函数
 * @description 将DashboardModel类包装为Composition API可用的函数
 */
export const useDashboardModel = () => {
  const model = new DashboardModel();
  
  // 在组件挂载时调用 mounted 方法
  onMounted(() => {
    model.mounted();
  });
  
  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => {
    model.beforeUnmount();
  });
  
  return {

    ...model,

    // 派生响应式（来自 store）
    displayServerTime: computed(() => model.statusStore.displayServerTime),
    webRunning: computed(() => model.statusStore.webRunning),
    webPid: computed(() => model.statusStore.webPid),
    launcherPid: computed(() => model.statusStore.launcherPid),

    // 权限
    Permission,
  };
};
