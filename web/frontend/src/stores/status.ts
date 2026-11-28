import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { BootstrapService } from '@/services/bootstrap-service';
import { StatusService } from '@/services/status-service';
import { WebServiceService } from '@/services/web-service-service';
import type { SystemStatusData } from '@/types/status';
import type { WebServiceStatusData } from '@/types/web-service';
import { formatServerTime } from '@/utils/format';
import { SYSTEM_STATUS_POLL_MS, SERVER_TIME_TICK_MS } from '@/constants/polling';

/**
 * 系统状态全局Store类
 * @description 管理系统运行状态，供仪表盘、导航栏等多个组件共享使用
 */
export class StatusStore {
  // ==============================
  // 状态变量
  // ==============================

  /**
   * 守护进程运行状态
   * @description 标识守护进程是否正在运行
   */
  daemonRunning = ref(false);

  /**
   * 守护进程进程ID
   * @description 守护进程运行时的进程ID，未运行时为null
   */
  daemonPid = ref<number | null>(null);

  /**
   * 年度任务进程ID
   * @description 年度任务运行时的进程ID，未运行时为null
   */
  annualPid = ref<number | null>(null);

  /**
   * 守护进程启动时间戳
   * @description 守护进程启动时的Unix时间戳，未运行时为null
   */
  daemonStartTime = ref<number | null>(null);

  /**
   * 项目目录路径
   * @description 当前项目的根目录路径
   */
  projectDir = ref('');

  /**
   * 缓存文件数量
   * @description 当前缓存目录中的文件总数
   */
  cacheFiles = ref(0);

  /**
   * 服务器时间
   * @description 服务端返回的当前时间字符串（原始值）
   */
  serverTime = ref('');

  /**
   * 服务器时间（每秒推进，用于展示）
   * @description 接口返回后本地每秒 +1s 推进，避免页面时间静止
   */
  displayServerTime = ref('');

  /** 时间本地推进定时器 */
  private serverTimeTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 主机名
   * @description 服务器主机名
   */
  hostname = ref('');

  /**
   * 操作系统发行版名称
   * @description 如 Ubuntu 22.04 LTS
   */
  osRelease = ref('');

  /**
   * 内核版本
   * @description 操作系统内核版本号
   */
  kernelVersion = ref('');

  /**
   * CPU 核心数
   * @description 服务器 CPU 逻辑核心数量
   */
  cpuCores = ref(0);

  /**
   * 内存信息
   * @description 服务器内存总量、已用、可用（字节）
   */
  memory = ref<{ total: number; used: number; free: number } | null>(null);

  /**
   * 磁盘信息
   * @description 根分区磁盘总量、已用、可用（字节），获取失败时为 null
   */
  disk = ref<{ total: number; used: number; free: number } | null>(null);

  /**
   * 系统运行时长
   * @description 服务器系统运行时长（秒）
   */
  systemUptime = ref(0);

  /**
   * Node.js 版本
   * @description 当前运行的 Node.js 版本号
   */
  nodeVersion = ref('');

  /**
   * 加载状态
   * @description 标识是否正在请求状态数据
   */
  loading = ref(false);

  /**
   * Web服务重启状态
   * @description 标识Web服务是否正在重启中
   */
  webRestarting = ref(false);

  /**
   * Web服务运行状态
   * @description 标识Web服务是否正在运行
   */
  webRunning = ref(false);

  /**
   * Web服务进程ID
   * @description Web服务运行时的进程ID
   */
  webPid = ref<number | null>(null);

  /**
   * Web启动器进程ID
   * @description launcher.pid 对应的进程ID
   */
  launcherPid = ref<number | null>(null);

  // ==============================
  // 私有变量（不导出）
  // ==============================

  /**
   * 状态轮询定时器
   * @description 按 SYSTEM_STATUS_POLL_MS 间隔一次拉取系统状态与 Web 服务状态
   */
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 轮询会话是否已启动
   * @type {boolean}
   * @description startPolling 的判重标记；页面隐藏只暂停定时器，不清此标记
   */
  private pollingStarted = false;

  /**
   * 系统状态轮询间隔
   * @type {number}
   * @description 记录 startPolling 传入的间隔，页面恢复可见时按原间隔重启定时器
   */
  private pollIntervalMs = SYSTEM_STATUS_POLL_MS;

  /**
   * 页面可见性变化回调
   * @type {(() => void) | null}
   * @description 页面隐藏时暂停网络轮询，恢复可见时补拉一次状态；stopPolling 时移除监听
   */
  private visibilityHandler: (() => void) | null = null;

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 启动服务器时间本地推进定时器
   * @param {string} serverTime - 服务器时间字符串
   */
  private startServerTimeTimer = (serverTime: string): void => {
    if (this.serverTimeTimer) {
      clearInterval(this.serverTimeTimer);
    }
    // 手动解析 "2026/3/12 18:58:40" 或 "2026-3-12 18:58:40" 格式，彻底兼容所有浏览器
    const match = serverTime.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (!match) return;
    const [, y, mo, d, h, mi, s] = match.map(Number);
    // 服务器时区固定为 Asia/Hong_Kong（UTC+8），手动换算为 UTC 时间戳
    // 避免受电脑本地时区影响导致时间显示错误
    const UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
    const ts = Date.UTC(y, mo - 1, d, h, mi, s) - UTC_OFFSET_MS;
    if (Number.isNaN(ts)) return;

    let current = ts;
    this.displayServerTime.value = formatServerTime(current);
    this.serverTimeTimer = setInterval(() => {
      current += SERVER_TIME_TICK_MS;
      this.displayServerTime.value = formatServerTime(current);
    }, SERVER_TIME_TICK_MS);
  };

  /**
   * 用聚合接口刷新两块状态
   * @returns {Promise<void>}
   * @description 一次请求替代 /api/system 与 /api/web-service/status 两条轮询；
   *   仅写入状态 Store，不触碰规则与日志；失败时按原接口并发兜底
   */
  private refreshStatusSnapshot = async (): Promise<void> => {
    try {
      const { data } = await this.bootstrapService.fetchStatusSnapshot();
      if (data.system) this.hydrateSystem(data.system);
      if (data.webService) this.hydrateWebService(data.webService);
    } catch {
      await Promise.all([this.fetchStatus(true), this.loadWebStatus()]);
    }
  };

  /**
   * 启动网络状态轮询定时器
   * @returns {void}
   * @description 页面不可见时不启动，避免后台标签页持续请求 /api/bootstrap
   */
  private startPollingTimers = (): void => {
    if (this.pollingTimer !== null) return;
    if (document.visibilityState === 'hidden') return;
    this.pollingTimer = setInterval(() => void this.refreshStatusSnapshot(), this.pollIntervalMs);
  };

  /**
   * 暂停网络状态轮询定时器
   * @returns {void}
   * @description 只清网络轮询定时器，1s 的服务器时间本地推进由 stopPolling 统一清理
   */
  private stopPollingTimers = (): void => {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  };

  /**
   * 页面可见性变化时暂停或恢复状态轮询
   * @returns {void}
   * @description 隐藏时停定时器；恢复可见时用聚合接口补一次最新状态并重启定时器
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.stopPollingTimers();
      return;
    }
    void this.refreshStatusSnapshot();
    this.startPollingTimers();
  };

  // ==============================
  // 依赖注入
  // ==============================

  /**
   * 首屏聚合服务实例
   * @description 用于轮询时一次拉取系统状态与 Web 服务状态
   */
  private bootstrapService: BootstrapService = new BootstrapService();

  /**
   * 状态服务实例
   * @description 用于查询系统运行状态
   */
  private statusService: StatusService = new StatusService();

  /**
   * Web服务实例
   * @description 用于查询Web服务运行状态
   */
  private webServiceService: WebServiceService = new WebServiceService();

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 守护进程是否已停止
   * @returns {boolean} 守护进程未运行时返回 true
   */
  get isDaemonStopped(): boolean {
    return !this.daemonRunning.value;
  }

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 用系统状态数据填充 Store
   * @param {SystemStatusData} data - 系统状态数据
   * @returns {void}
   * @description 统一 /api/system 与 /api/bootstrap 的写入路径，并重启服务器时间本地推进
   */
  hydrateSystem = (data: SystemStatusData): void => {
    this.daemonRunning.value = data.daemonRunning;
    this.daemonPid.value = data.daemonPid;
    this.annualPid.value = data.annualPid ?? null;
    this.daemonStartTime.value = data.daemonStartTime ?? null;
    this.projectDir.value = data.projectDir;
    this.cacheFiles.value = data.cacheFiles;
    this.serverTime.value = data.serverTime;
    this.startServerTimeTimer(data.serverTime);
    this.hostname.value = data.hostname ?? '';
    this.osRelease.value = data.osRelease ?? '';
    this.kernelVersion.value = data.kernelVersion ?? '';
    this.cpuCores.value = data.cpuCores ?? 0;
    this.memory.value = data.memory ?? null;
    this.disk.value = data.disk ?? null;
    this.systemUptime.value = data.systemUptime ?? 0;
    this.nodeVersion.value = data.nodeVersion ?? '';
  }

  /**
   * 用 Web 服务状态数据填充 Store
   * @param {WebServiceStatusData} data - Web 服务状态数据
   * @returns {void}
   * @description 统一 /api/web-service/status 与 /api/bootstrap 的写入路径
   */
  hydrateWebService = (data: WebServiceStatusData): void => {
    this.webRunning.value = data.running;
    this.webPid.value = data.pid;
    this.launcherPid.value = data.launcherPid ?? null;
  }

  /**
   * 获取系统状态
   * @param {boolean} silent - 是否静默刷新（不触发 loading 状态），默认 false
   * @param {boolean} force - 是否强制刷新，默认 true（status 数据实时性高，默认强制刷新）
   * @returns {Promise<void>}
   * @description 从服务端获取最新的系统状态信息并更新状态变量
   */
  fetchStatus = async (silent: boolean = false, force: boolean = true): Promise<void> => {
    if (!force && this.projectDir.value) return;
    if (!silent) {
      this.loading.value = true;
    }
    try {
      const { data } = await this.statusService.fetchStatus();
      this.hydrateSystem(data);
    } catch {
      // 请求失败时保持原有状态，不阻塞页面
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * 加载Web服务状态信息
   * @param {number} retries - 重试次数，默认为0
   * @returns {Promise<void>}
   */
  loadWebStatus = async (retries: number = 0): Promise<void> => {
    try {
      const { data } = await this.webServiceService.fetchWebServiceStatus();
      this.hydrateWebService(data);
    } catch (e: unknown) {
      // 401 未授权或网络错误：直接走兜底，不重试
      const axiosError = e as { response?: { status?: number } };
      const isAuthError = axiosError?.response?.status === 401;
      const isNetworkError = !axiosError?.response;
      if (isNetworkError || isAuthError) {
        this.webRunning.value = false;
        this.webPid.value = null;
        this.launcherPid.value = null;
        return;
      }

      // 其他错误（如 500）：重试最多 5 次
      if (retries < 5) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.loadWebStatus(retries + 1);
      }

      this.webRunning.value = false;
      this.webPid.value = null;
      this.launcherPid.value = null;
    }
  }

  /**
   * 开始轮询系统状态
   * @param {number} interval - 轮询间隔（毫秒），默认 SYSTEM_STATUS_POLL_MS
   * @param {boolean} immediate - 是否立即拉取一次状态，默认 false
   * @returns {void}
   * @description 首屏数据由 /api/bootstrap 一次性提供，默认只启动定时器；
   *   轮询统一走 /api/bootstrap?only=system,webService，失败时降级到原两个状态接口；
   *   immediate 仅用于首屏聚合接口不可用时直接走原接口；判重在立即请求之前，避免双入口重复发请求；
   *   页面隐藏时由 visibilitychange 暂停轮询，恢复可见时补拉一次
   */
  startPolling = (interval: number = SYSTEM_STATUS_POLL_MS, immediate: boolean = false): void => {
    if (this.pollingStarted) return;
    this.pollingStarted = true;
    this.pollIntervalMs = interval;
    if (immediate) {
      this.fetchStatus();
      this.loadWebStatus();
    }
    this.startPollingTimers();
    if (this.visibilityHandler === null) {
      this.visibilityHandler = this.handleVisibilityChange;
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /**
   * 停止轮询系统状态
   * @returns {void}
   * @description 清除定时器、移除可见性监听，允许后续 startPolling 重新启动
   */
  stopPolling = (): void => {
    this.pollingStarted = false;
    this.stopPollingTimers();
    if (this.serverTimeTimer !== null) {
      clearInterval(this.serverTimeTimer);
      this.serverTimeTimer = null;
    }
    if (this.visibilityHandler !== null) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

/**
 * 创建Status Store实例的工厂函数
 * @description 将StatusStore类包装为Pinia可用的Store
 */
export const useStatusStore = defineStore('status', () => {
  const store = new StatusStore();

  return {
    // 状态变量和方法（箭头函数自动绑定 this，可直接展开）
    ...store,
    // 计算属性
    isDaemonStopped: computed(() => store.isDaemonStopped),
  };
});
