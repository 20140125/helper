import { ref, watch, onMounted, onBeforeUnmount, type Ref, computed, type ComputedRef } from 'vue';
import { useRoute } from 'vue-router';
import { LogService } from '@/services/log-service';
import type { LogItem } from '@/types/log';
import { LOG_LABELS, getLogLabels } from '@/types/log';
import { BaseModel } from '@/models/base-model';
import { MessagePlugin } from 'tdesign-vue-next';

/**
 * 日志页面数据模型类
 * @description 管理日志页面的所有业务逻辑，包括日志列表加载、日志内容查看、日志清空及响应式布局处理
 */
export class LogsModel extends BaseModel {
  // ==============================
  // 依赖注入（route、service）
  // ==============================

  /**
   * 路由实例
   * @type {ReturnType<typeof useRoute>}
   * @description 用于读取路由查询参数，自动定位到指定日志
   */
  route: ReturnType<typeof useRoute> = useRoute();

  /**
   * 日志服务实例
   * @type {LogService}
   * @description 用于获取日志列表、日志内容及清空日志
   */
  logService: LogService = new LogService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 日志列表
   * @type {Ref<LogItem[]>}
   * @description 当前可用的日志文件列表
   */
  logs: Ref<LogItem[]> = ref<LogItem[]>([]);

  /**
   * 当前选中的日志 key
   * @type {Ref<string>}
   * @description 当前正在查看的日志文件标识
   */
  activeKey: Ref<string> = ref('');

  /**
   * 日志内容
   * @type {Ref<string>}
   * @description 当前选中日志文件的文本内容
   */
  logContent: Ref<string> = ref('');

  /**
   * 显示行数
   * @type {Ref<number>}
   * @description 日志内容显示的最大行数，默认100行
   */
  lineCount: Ref<number> = ref(100);

  /**
   * 日志标签
   * @type {ComputedRef<Record<string, string>>}
   * @description 日志文件标签映射
   */
  LOG_LABELS: ComputedRef<Record<string, string>> = computed(() => getLogLabels());

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载日志内容
   * @returns {Promise<void>}
   * @description 根据当前选中的日志 key 和行数加载日志文本内容
   */
  loadContent = async (): Promise<void> => {
    if (!this.activeKey.value) return;
    this.pageLoading.value = true;
    try {
      const { data: { content } } = await this.logService.fetchLogContent(this.activeKey.value, this.lineCount.value);
      this.logContent.value = content;
    } catch {
      // 请求失败时清空内容，不阻塞页面
      this.logContent.value = '';
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 选中日志
   * @param {string} key - 日志文件标识
   * @returns {Promise<void>}
   * @description 切换当前选中的日志文件并加载其内容
   */
  selectLog = async (key: string): Promise<void> => {
    this.activeKey.value = key;
    await this.loadContent();
  };

  /**
   * 清空日志
   * @returns {Promise<void>}
   * @description 清空当前选中的日志文件内容，并刷新日志列表
   */
  clearLog = async (): Promise<void> => {
    if (!this.activeKey.value) return;
    await this.logService.removeLog(this.activeKey.value);
    this.logContent.value = '';
    MessagePlugin.success(this.localeStore.t.logs.clearSuccess);
    const { data: { logs } } = await this.logService.fetchLogs();
    this.logs.value = logs;
  };

  /**
   * 加载日志列表
   * @param {string} [autoSelectKey] - 自动选中的日志 key（可选）
   * @returns {Promise<void>}
   * @description 从服务端获取日志列表，并自动选中指定或第一个日志
   */
  loadLogs = async (autoSelectKey?: string): Promise<void> => {
    try {
      const { data: { logs } } = await this.logService.fetchLogs();
      this.logs.value = logs;

      if (autoSelectKey && LOG_LABELS[autoSelectKey]) {
        await this.selectLog(autoSelectKey);
      } else if (this.logs.value.length > 0) {
        await this.selectLog(this.logs.value[0].key);
      }
    } catch {
      // 请求失败时保持原有数据，不阻塞页面
      this.logs.value = [];
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动窗口 resize 监听并加载日志列表
   */
  mounted = async (): Promise<void> => {
    this.startResizeListener();
    this.pageLoading.value = true;

    // 监听路由 key 参数变化，自动切换日志
    watch(
      () => this.route.query.key,
      (key: unknown) => {
        if (key && typeof key === 'string' && LOG_LABELS[key]) {
          this.selectLog(key);
        }
      },
    );

    try {
      await this.loadLogs(this.route.query.key as string | undefined);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 移除窗口 resize 监听，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.stopResizeListener();
  };
}

/**
 * Composition API 包装函数
 * @description 将 LogsModel 类包装为 Composition API 可用的函数
 */
export const useLogsModel = () => {
  const model = new LogsModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => { model.mounted(); });

  // 在组件卸载时调用 beforeUnmount 方法
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {

    ...model,
  };
};
