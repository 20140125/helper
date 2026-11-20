import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { StatusService } from '@/services/status-service';
import { WebServiceService } from '@/services/web-service-service';
import { formatServerTime } from '@/utils/format';
import { WEB_SERVICE_STATUS_POLL_MS, SYSTEM_STATUS_POLL_MS, SERVER_TIME_TICK_MS } from '@/constants/polling';

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
   * 轮询定时器
   * @description 用于定时刷新系统状态的定时器
   */
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Web服务状态轮询定时器
   * @description 按 WEB_SERVICE_STATUS_POLL_MS 间隔检查Web服务运行状态
   */
  private webStatusTimer: ReturnType<typeof setInterval> | null = null;

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

  // ==============================
  // 依赖注入
  // ==============================

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
      const { data: statusData } = await this.statusService.fetchStatus();
      const {
        daemonRunning,
        daemonPid,
        annualPid,
        daemonStartTime,
        projectDir,
        cacheFiles,
        serverTime,
        hostname,
        osRelease,
        kernelVersion,
        cpuCores,
        memory,
        disk,
        systemUptime,
        nodeVersion,
      } = statusData
      this.daemonRunning.value = daemonRunning;
      this.daemonPid.value = daemonPid;
      this.annualPid.value = annualPid ?? null;
      this.daemonStartTime.value = daemonStartTime ?? null;
      this.projectDir.value = projectDir;
      this.cacheFiles.value = cacheFiles;
      this.serverTime.value = serverTime;
      this.startServerTimeTimer(serverTime);
      this.hostname.value = hostname ?? '';
      this.osRelease.value = osRelease ?? '';
      this.kernelVersion.value = kernelVersion ?? '';
      this.cpuCores.value = cpuCores ?? 0;
      this.memory.value = memory ?? null;
      this.disk.value = disk ?? null;
      this.systemUptime.value = systemUptime ?? 0;
      this.nodeVersion.value = nodeVersion ?? '';
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
      const { data: { running, pid, launcherPid } } = await this.webServiceService.fetchWebServiceStatus();
      this.webRunning.value = running;
      this.webPid.value = pid;
      this.launcherPid.value = launcherPid ?? null;
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
   * @returns {void}
   * @description 立即获取一次状态，然后按指定间隔定时静默刷新
   */
  startPolling = (interval: number = SYSTEM_STATUS_POLL_MS): void => {
    this.fetchStatus();
    this.loadWebStatus();
    if (this.pollingTimer !== null) return;
    this.pollingTimer = setInterval(() => this.fetchStatus(true), interval);
    this.webStatusTimer = setInterval(() => this.loadWebStatus(), WEB_SERVICE_STATUS_POLL_MS);
  }

  /**
   * 停止轮询系统状态
   * @returns {void}
   * @description 清除定时器，停止状态轮询
   */
  stopPolling = (): void => {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.webStatusTimer !== null) {
      clearInterval(this.webStatusTimer);
      this.webStatusTimer = null;
    }
    if (this.serverTimeTimer !== null) {
      clearInterval(this.serverTimeTimer);
      this.serverTimeTimer = null;
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
