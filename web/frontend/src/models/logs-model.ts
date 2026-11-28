import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { LogService } from '@/services/log-service';
import type { LogRow, LogDetail } from '@/types/log';
import { getLogLabels } from '@/types/log';
import { BaseModel } from '@/models/base-model';
import { formatLogTime } from '@/utils/format';
import {
  DEFAULT_LOG_PAGE_SIZE,
  LOG_LEVEL_OPTIONS,
  LOG_LEVEL_THEME,
  LOG_SOURCE_TYPE_OPTIONS,
} from '@/constants/logs';

/**
 * 运行日志页面数据模型类
 * @description 管理日志表格的筛选、分页与单条日志详情查看
 */
export class LogsModel extends BaseModel {
  // ==============================
  // 依赖注入（service）
  // ==============================

  /**
   * 日志服务实例
   * @type {LogService}
   * @description 封装日志分页列表与单条详情接口
   */
  logService: LogService = new LogService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 当前页日志记录
   * @type {Ref<LogRow[]>}
   * @description 按 id 倒序返回的当前页数据
   */
  items: Ref<LogRow[]> = ref<LogRow[]>([]);

  /**
   * 符合筛选条件的总记录数
   * @type {Ref<number>}
   * @description 由后端 COUNT 查询返回，用于分页
   */
  total: Ref<number> = ref(0);

  /**
   * 当前页码
   * @type {Ref<number>}
   * @description 从 1 开始，筛选条件变化时重置
   */
  page: Ref<number> = ref(1);

  /**
   * 每页条数
   * @type {Ref<number>}
   * @description 默认 15 条
   */
  pageSize: Ref<number> = ref(DEFAULT_LOG_PAGE_SIZE);

  /**
   * 来源类型筛选值
   * @type {Ref<string>}
   * @description 对应 hp_run_logs.source_type，空串表示全部来源类型
   */
  sourceTypeFilter: Ref<string> = ref('');

  /**
   * 级别筛选值
   * @type {Ref<string>}
   * @description 对应 hp_run_logs.level，空串表示全部级别
   */
  levelFilter: Ref<string> = ref('');

  /**
   * 正文关键词
   * @type {Ref<string>}
   * @description 按 message 模糊匹配
   */
  keyword: Ref<string> = ref('');

  /**
   * 当前展开详情的日志 id
   * @type {Ref<number | null>}
   * @description 点击行或详情按钮时记录，null 表示没有展开行
   */
  detailRowId: Ref<number | null> = ref(null);

  /**
   * 当前日志详情
   * @type {Ref<LogDetail | null>}
   * @description 按 id 从服务端读取的完整记录，供展开行内的详情面板展示
   */
  detail: Ref<LogDetail | null> = ref(null);

  /**
   * 详情加载状态
   * @type {Ref<boolean>}
   * @description 控制展开行内详情面板的 loading 遮罩
   */
  detailLoading: Ref<boolean> = ref(false);

  // ==============================
  // 静态数据
  // ==============================

  /**
   * 级别筛选项
   * @type {Array<{ value: string; label: string }>}
   * @description 级别是技术标识，无需随语言切换
   */
  levelOptions: Array<{ value: string; label: string }> = LOG_LEVEL_OPTIONS.map((level) => ({ value: level, label: level }));

  /**
   * 来源类型筛选项
   * @type {Array<{ value: string; label: string }>}
   * @description 来源类型是数据库枚举标识，无需随语言切换
   */
  sourceTypeOptions: Array<{ value: string; label: string }> = LOG_SOURCE_TYPE_OPTIONS.map((sourceType) => ({
    value: sourceType,
    label: sourceType,
  }));

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 日志来源标签字典
   * @type {ComputedRef<Record<string, string>>}
   * @description 直接取 hp_i18n_messages 的 logs.labels.*，未配置翻译的 source 显示原值
   */
  sourceLabels: ComputedRef<Record<string, string>> = computed(() => getLogLabels());

  /**
   * 表格列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 列标题跟随语言切换，表格展示记录 ID、时间（含毫秒）、来源与请求地址等字段，完整正文在展开行的详情面板查看
   */
  columns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const t = this.localeStore.t;
    return [
      { colKey: 'id', title: t.logs.fieldId, width: 90 },
      {
        colKey: 'logged_at',
        title: t.logs.colTime,
        width: 200,
        cell: (_h: unknown, ctx: { row: LogRow }): string => formatLogTime(ctx.row.logged_at, ctx.row.ts_ms),
      },
      { colKey: 'level', title: t.logs.colLevel, width: 100 },
      { colKey: 'source', title: t.logs.colSource, width: 160 },
      { colKey: 'address', title: t.logs.colAddress, minWidth: 260 },
      { colKey: 'source_type', title: t.logs.fieldType, width: 120 },
      { colKey: 'hostname', title: t.logs.fieldHost, width: 140 },
      { colKey: 'pid', title: t.logs.fieldPid, width: 100 },
      { colKey: 'actions', title: t.logs.colActions, width: 110, fixed: 'right' as const },
    ];
  });

  /**
   * 表格展开行 keys
   * @type {ComputedRef<Array<string | number>>}
   * @description 只展开当前点击的那一行，详情直接显示在该行下方
   */
  expandedRowKeys: ComputedRef<Array<string | number>> = computed(() =>
    this.detailRowId.value === null ? [] : [this.detailRowId.value],
  );

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载当前页日志记录
   * @description 按当前筛选条件与分页参数请求列表，失败时清空表格
   */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { data } = await this.logService.fetchLogRows({
        page: this.page.value,
        pageSize: this.pageSize.value,
        sourceType: this.sourceTypeFilter.value || '',
        level: this.levelFilter.value || '',
        keyword: this.keyword.value.trim(),
      });
      this.items.value = data.items;
      this.total.value = data.total;
    } catch {
      this.items.value = [];
      this.total.value = 0;
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 筛选条件变更
   * @description 关闭展开行内的详情面板并重置到第一页重新加载，避免展示已不在列表中的记录
   */
  onFilterChange = (): void => {
    this.closeDetail();
    this.page.value = 1;
    this.load();
  };

  /**
   * 分页变更
   * @param {{ current: number }} pagination - TDesign 分页组件返回的页码信息
   * @description 换页时关闭详情面板，避免面板停留在新页不存在的记录
   */
  onPageChange = (pagination: { current: number }): void => {
    this.closeDetail();
    this.page.value = pagination.current;
    this.load();
  };

  /**
   * 表格行点击
   * @param {{ row: LogRow }} context - TDesign 行点击事件上下文
   */
  onRowClick = (context: { row: LogRow }): void => {
    this.openDetail(context.row);
  };

  /**
   * 展开单条日志详情
   * @param {LogRow} row - 被点击的日志记录
   * @description 在该行下方展开详情；再次点击同一行则收起
   */
  openDetail = async (row: LogRow): Promise<void> => {
    if (this.detailRowId.value === row.id) {
      this.closeDetail();
      return;
    }
    this.detailRowId.value = row.id;
    this.detail.value = null;
    this.detailLoading.value = true;
    try {
      const { data } = await this.logService.fetchLogDetail(row.id);
      this.detail.value = data.row;
    } catch {
      MessagePlugin.error(this.localeStore.t.logs.detailFailed);
      this.detail.value = null;
    } finally {
      this.detailLoading.value = false;
    }
  };

  /**
   * 收起展开行详情面板
   * @description 同时清空详情数据，避免下次展开时闪现旧内容
   */
  closeDetail = (): void => {
    this.detailRowId.value = null;
    this.detail.value = null;
  };

  /**
   * 解析级别标签主题
   * @param {string} level - 日志级别
   * @returns {'default' | 'primary' | 'success' | 'warning' | 'danger'} 标签主题
   */
  levelTheme = (level: string): 'default' | 'primary' | 'success' | 'warning' | 'danger' =>
    LOG_LEVEL_THEME[level] ?? 'default';

  /**
   * 解析来源显示名
   * @param {string} source - hp_run_logs.source 原值
   * @returns {string} 本地化后的显示名，未配置翻译时返回原值
   */
  sourceLabel = (source: string): string => this.sourceLabels.value[source] ?? source;

  /**
   * 解析列表行的请求地址
   * @param {LogRow} row - 当前行日志
   * @returns {string} 「方法 地址」文本，无地址时返回空串
   * @description 访问日志优先取 context 里已解析的 method / url，老数据与普通日志从正文兜底提取
   */
  addressOf = (row: LogRow): string => {
    const raw = row.context?.trim();
    if (raw) {
      try {
        const context = JSON.parse(raw) as Record<string, unknown>;
        const url = typeof context.url === 'string' ? context.url.trim() : '';
        if (url) {
          const method = typeof context.method === 'string' ? context.method.trim() : '';
          return method ? `${method} ${url}` : url;
        }
      } catch {
        // context 不是 JSON 时继续从正文提取
      }
    }
    const header = /▸\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+([A-Z]+)\s+(\S+)/.exec(row.message);
    if (header) return `${header[1]} ${header[2]}`;
    const inline = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S+|https?:\/\/\S+)/.exec(row.message);
    return inline ? `${inline[1]} ${inline[2]}` : '';
  };

  // ==============================
  // 生命周期
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载首页日志记录
   */
  mounted = async (): Promise<void> => {
    await this.load();
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 无需清理资源
   */
  beforeUnmount = (): void => {
    // 无需清理
  };
}

/**
 * Composition API 包装函数
 * @description 将 LogsModel 类包装为 Composition API 可用的函数
 */
export const useLogsModel = () => {
  const model = new LogsModel();

  onMounted(() => { model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {
    ...model,
  };
};
