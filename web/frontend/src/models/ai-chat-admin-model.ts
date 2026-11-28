import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel, Permission } from '@/models/base-model';
import { AiChatAdminService } from '@/services/ai-chat-admin-service';
import { formatAiTime, formatAiDuration, formatAiTokens } from '@/utils/ai-chat-admin';
import type { AiChatAdminRun, AiChatAdminDetail, AiChatAdminToolStat } from '@/types/ai-chat-admin';
import {
  AI_CHAT_ADMIN_PAGE_SIZE,
  AI_CHAT_ADMIN_SCOPE_ALL,
  AI_CHAT_ADMIN_SCOPE_ME,
  AI_CHAT_ADMIN_MESSAGE_SCOPE_RUN,
  AI_CHAT_ADMIN_DAYS_VALUES,
  AI_CHAT_ADMIN_PERMISSIONS,
} from '@/constants/ai-chat-admin';

/**
 * AI 回话管理页数据模型
 * @description 管理运行列表的筛选与分页，并按运行 ID 拉取逐轮用量、工具调用与回话正文
 */
export class AiChatAdminModel extends BaseModel {
  // ==============================
  // 依赖注入（service）
  // ==============================

  /**
   * AI 回话管理页服务实例
   * @type {AiChatAdminService}
   * @description 封装 /api/ai-chat-admin 的运行列表与详情接口
   */
  private aiChatAdminService: AiChatAdminService = new AiChatAdminService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 当前页运行记录
   * @type {Ref<AiChatAdminRun[]>}
   * @description 按开始时间倒序返回
   */
  items: Ref<AiChatAdminRun[]> = ref<AiChatAdminRun[]>([]);

  /**
   * 符合条件的总记录数
   * @type {Ref<number>}
   * @description 由后端 COUNT 查询返回
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
   * @description 与后端默认页大小保持一致
   */
  pageSize: Ref<number> = ref(AI_CHAT_ADMIN_PAGE_SIZE);

  /**
   * 统计天数
   * @type {Ref<number>}
   * @description 默认 30 天
   */
  days: Ref<number> = ref(30);

  /**
   * 统计范围
   * @type {Ref<string>}
   * @description me=仅自己，all=全量（需管理员权限）
   */
  scope: Ref<string> = ref(AI_CHAT_ADMIN_SCOPE_ME);

  /**
   * 关键词
   * @type {Ref<string>}
   * @description 匹配运行 ID、会话 ID、用户、模型与异常原因
   */
  keyword: Ref<string> = ref('');

  /**
   * 详情抽屉是否可见
   * @type {Ref<boolean>}
   * @description 点击运行行或详情按钮时打开
   */
  drawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前选中的运行 ID
   * @type {Ref<string>}
   * @description 抽屉标题展示，避免详情数据未加载时无标识
   */
  selectedRunId: Ref<string> = ref('');

  /**
   * 当前运行详情
   * @type {Ref<AiChatAdminDetail | null>}
   * @description 包含 steps、消息流水与会话信息
   */
  detail: Ref<AiChatAdminDetail | null> = ref(null);

  /**
   * 详情加载状态
   * @type {Ref<boolean>}
   * @description 控制抽屉内的 loading 遮罩
   */
  detailLoading: Ref<boolean> = ref(false);

  /**
   * 回话内容范围
   * @type {Ref<string>}
   * @description run=仅本次运行消息（默认，避免每次详情都展示同一批历史），conversation=完整会话
   */
  messageScope: Ref<string> = ref(AI_CHAT_ADMIN_MESSAGE_SCOPE_RUN);

  /**
   * 是否只显示有回话内容的运行
   * @type {Ref<boolean>}
   * @description 默认 true：中断 / 未写回消息的运行点开是空的，不必占满列表；关掉后可看全量用于排障
   */
  onlyWithMessages: Ref<boolean> = ref(true);

  // ==============================
  // 计算属性（getter）
  // ==============================

  /**
   * 是否可查看全量数据
   * @returns {boolean} 拥有 RBAC 查看/编辑权限时为 true
   */
  get canSeeAll(): boolean {
    const permissions = this.permissionStore.permissions ?? [];
    return AI_CHAT_ADMIN_PERMISSIONS.some((p) => permissions.includes(p as Permission));
  }

  /**
   * 天数下拉选项
   * @type {ComputedRef<Array<{ label: string; value: number }>>}
   * @description 标签随语言切换
   */
  daysOptions: ComputedRef<Array<{ label: string; value: number }>> = computed(() =>
    AI_CHAT_ADMIN_DAYS_VALUES.map((value) => ({
      label: this.t.value.aiChatAdmin.dayOption(value),
      value,
    })),
  );

  /**
   * 运行列表列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 数值列统一在 cell 中格式化，状态与操作列由视图插槽渲染
   */
  columns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const t = this.t.value.aiChatAdmin;
    return [
      {
        colKey: 'started_at', title: t.colTime, width: 180,
        cell: (_h: unknown, ctx: { row: AiChatAdminRun }) => this.formatTime(ctx.row.started_at),
      },
      { colKey: 'user', title: t.colUser, minWidth: 170 },
      { colKey: 'model', title: t.colModel, minWidth: 150 },
      {
        colKey: 'duration_ms', title: t.colDuration, width: 110,
        cell: (_h: unknown, ctx: { row: AiChatAdminRun }) => this.formatDuration(ctx.row.duration_ms),
      },
      { colKey: 'iterations', title: t.colIterations, width: 90 },
      {
        colKey: 'total_tokens', title: t.colTokens, width: 110,
        cell: (_h: unknown, ctx: { row: AiChatAdminRun }) => this.formatTokens(ctx.row.total_tokens),
      },
      { colKey: 'tool_calls', title: t.colToolCalls, width: 100 },
      { colKey: 'tool_failures', title: t.colFailures, width: 100 },
      { colKey: 'cost_cny', title: t.colCost, width: 110 },
      { colKey: 'status', title: t.colStatus, width: 110 },
      { colKey: 'actions', title: t.colActions, width: 110, fixed: 'right' as const },
    ];
  });

  /**
   * 按工具名聚合本次运行的调用情况
   * @returns {AiChatAdminToolStat[]} 按调用次数降序的工具统计
   * @description 逐轮 steps 里的工具调用平铺后聚合，用于「调用了哪些工具、成功率如何」
   */
  get toolStats(): AiChatAdminToolStat[] {
    const grouped = new Map<string, { calls: number; failures: number; duration: number }>();
    for (const step of this.detail.value?.trace.steps ?? []) {
      for (const call of step.tool_calls) {
        const entry = grouped.get(call.name) ?? { calls: 0, failures: 0, duration: 0 };
        entry.calls += 1;
        if (!call.ok) entry.failures += 1;
        entry.duration += call.duration_ms;
        grouped.set(call.name, entry);
      }
    }
    return Array.from(grouped.entries())
      .map(([name, entry]) => ({
        name,
        calls: entry.calls,
        failures: entry.failures,
        avg_duration_ms: Math.round(entry.duration / entry.calls),
        success_rate: (entry.calls - entry.failures) / entry.calls,
      }))
      .sort((a, b) => b.calls - a.calls);
  }

  // ==============================
  // 格式化方法
  // ==============================

  /**
   * 格式化时间戳
   * @param {number} timestamp - 毫秒时间戳
   * @returns {string} 服务器时区的可读时间
   */
  formatTime = (timestamp: number): string => formatAiTime(timestamp);

  /**
   * 格式化耗时
   * @param {number} ms - 毫秒数
   * @returns {string} 毫秒或秒文本
   */
  formatDuration = (ms: number): string => formatAiDuration(ms);

  /**
   * 格式化 token 数
   * @param {number} value - token 数
   * @returns {string} 带千分位的文本
   */
  formatTokens = (value: number): string => formatAiTokens(value);

  /**
   * 运行状态主题
   * @param {AiChatAdminRun} row - 运行记录
   * @returns {'success' | 'warning' | 'danger'} 标签主题
   */
  statusTheme = (row: AiChatAdminRun): 'success' | 'warning' | 'danger' =>
    row.error ? 'danger' : (row.tool_failures > 0 ? 'warning' : 'success');

  /**
   * 运行状态文案
   * @param {AiChatAdminRun} row - 运行记录
   * @returns {string} 本地化状态文本
   */
  statusText = (row: AiChatAdminRun): string => {
    const t = this.t.value.aiChatAdmin;
    if (row.error) return t.statusError;
    return row.tool_failures > 0 ? t.statusToolFailed : t.statusNormal;
  };

  // ==============================
  // 业务方法
  // ==============================

  /**
   * 加载当前页运行记录
   * @returns {Promise<void>}
   * @description 失败时清空列表并提示；后端把越权 scope 降级后同步回前端
   */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { data } = await this.aiChatAdminService.fetchRuns({
        days: this.days.value,
        scope: this.scope.value,
        keyword: this.keyword.value.trim(),
        page: this.page.value,
        pageSize: this.pageSize.value,
        onlyWithMessages: this.onlyWithMessages.value,
      });
      this.items.value = data.items;
      this.total.value = data.total;
      this.scope.value = data.scope ?? this.scope.value;
    } catch {
      this.items.value = [];
      this.total.value = 0;
      MessagePlugin.error(this.t.value.aiChatAdmin.loadFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 拉取当前运行详情
   * @param {string} runId - 运行 ID
   * @param {boolean} clearBefore - 是否先清空旧详情
   * @returns {Promise<void>}
   * @description 打开新运行与切换回话范围共用；切换范围时保留旧详情避免整页闪烁
   */
  private loadDetail = async (runId: string, clearBefore: boolean): Promise<void> => {
    if (clearBefore) this.detail.value = null;
    this.detailLoading.value = true;
    try {
      const { data } = await this.aiChatAdminService.fetchRunDetail(runId, this.messageScope.value);
      this.detail.value = data;
    } catch {
      MessagePlugin.error(this.t.value.aiChatAdmin.detailFailed);
    } finally {
      this.detailLoading.value = false;
    }
  };

  /**
   * 打开某次运行的详情抽屉
   * @param {AiChatAdminRun} row - 被点击的运行记录
   * @returns {Promise<void>}
   * @description 重置回话范围为「本次运行」，先清空旧详情再拉取
   */
  openDetail = async (row: AiChatAdminRun): Promise<void> => {
    this.selectedRunId.value = row.run_id;
    this.messageScope.value = AI_CHAT_ADMIN_MESSAGE_SCOPE_RUN;
    this.drawerVisible.value = true;
    await this.loadDetail(row.run_id, true);
  };

  /**
   * 切换回话内容范围
   * @param {string} value - run / conversation
   * @returns {Promise<void>}
   * @description 同一会话累积多次运行，默认只展示本次消息；需要上下文时再切到完整会话
   */
  switchMessageScope = async (value: string): Promise<void> => {
    if (!this.selectedRunId.value || value === this.messageScope.value) return;
    this.messageScope.value = value;
    await this.loadDetail(this.selectedRunId.value, false);
  };

  /**
   * 关闭详情抽屉
   * @returns {void}
   * @description 同时清空详情数据
   */
  closeDetail = (): void => {
    this.drawerVisible.value = false;
    this.detail.value = null;
  };

  /**
   * 关键词或筛选条件变更
   * @returns {void}
   * @description 重置到第一页重新加载
   */
  onFilterChange = (): void => {
    this.page.value = 1;
    void this.load();
  };

  /**
   * 切换「包含无回话记录」
   * @param {boolean} includeEmpty - 是否把没有落盘消息的运行也显示出来
   * @returns {void}
   * @description 复选框默认是「只包含有回话的运行」，勾选后才展示空跑记录用于排障
   */
  handleOnlyWithMessagesChange = (includeEmpty: boolean): void => {
    this.onlyWithMessages.value = !includeEmpty;
    this.onFilterChange();
  };

  /**
   * 分页变更
   * @param {{ current: number }} pagination - TDesign 分页组件返回的页码信息
   * @returns {void}
   */
  onPageChange = (pagination: { current: number }): void => {
    this.page.value = pagination.current;
    void this.load();
  };

  /**
   * 表格行点击
   * @param {{ row: AiChatAdminRun }} context - TDesign 行点击事件上下文
   * @returns {void}
   * @description 点击行直接打开抽屉，与操作列的详情按钮行为一致
   */
  onRowClick = (context: { row: AiChatAdminRun }): void => {
    void this.openDetail(context.row);
  };

  /**
   * 切换统计范围
   * @param {string} value - me / all
   * @returns {void}
   */
  handleScopeChange = (value: string): void => {
    this.scope.value = value;
    this.onFilterChange();
  };

  /**
   * 切换统计天数
   * @param {number} value - 天数
   * @returns {void}
   */
  handleDaysChange = (value: number): void => {
    this.days.value = value;
    this.onFilterChange();
  };

  // ==============================
  // 生命周期
  // ==============================

  /**
   * 页面挂载
   * @returns {void}
   * @description 管理员默认看全量，普通用户看自己
   */
  mounted = (): void => {
    if (this.canSeeAll) this.scope.value = AI_CHAT_ADMIN_SCOPE_ALL;
    void this.load();
  };

  /**
   * 页面卸载
   * @returns {void}
   * @description 无需清理资源
   */
  beforeUnmount = (): void => {
    // 无需清理
  };
}

/**
 * 创建 AI 回话管理页模型（组合式 API 包装）
 * @returns {object} 暴露给视图的响应式状态与方法
 * @description 类原型上的 getter 需显式包装为 computed 后才能被视图解构
 */
export const useAiChatAdminModel = () => {
  const model = new AiChatAdminModel();

  onMounted(() => { model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {
    ...model,
    canSeeAll: computed(() => model.canSeeAll),
    toolStats: computed(() => model.toolStats),
  };
};
