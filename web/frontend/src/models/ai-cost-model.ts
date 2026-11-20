import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel, Permission } from '@/models/base-model';
import { AiCostService } from '@/services/ai-cost-service';
import type {
  AiCostSummary,
  AiInspectionResult,
  AiInspectionRunRecord,
  AiInspectionStatus,
} from '@/types/ai-cost';
import {
  AI_COST_DAYS_OPTIONS,
  AI_COST_SCOPE_ALL,
  AI_COST_SCOPE_ME,
  AI_COST_ADMIN_PERMISSIONS,
  EMPTY_AI_COST_SUMMARY,
  AI_INSPECTION_POLL_INTERVAL_MS,
  AI_INSPECTION_POLL_MAX_ROUNDS,
} from '@/constants/ai-cost';

/**
 * AI 成本看板页数据模型
 * @description 负责加载 AI 运行统计（成本 / 延迟 / 工具失败率），
 *   并把后端返回的原始数值加工成可直接渲染的展示文案。
 */
export class AiCostModel extends BaseModel {
  // ==============================
  // 依赖注入（service）
  // ==============================

  /**
   * 成本看板服务实例
   * @type {AiCostService}
   * @description 用于拉取 /api/ai-chat/stats 聚合结果
   */
  private aiCostService: AiCostService = new AiCostService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 统计天数
   * @type {Ref<number>}
   * @description 默认 7 天；改动后需点击刷新重新拉取
   */
  days: Ref<number> = ref(7);

  /**
   * 统计范围
   * @type {Ref<string>}
   * @description me=仅自己，all=全量（需管理员权限，否则后端降级为 me）
   */
  scope: Ref<string> = ref(AI_COST_SCOPE_ME);

  /**
   * 统计汇总
   * @type {Ref<AiCostSummary>}
   * @description 首屏为空汇总，加载成功后整体替换
   */
  summary: Ref<AiCostSummary> = ref<AiCostSummary>({ ...EMPTY_AI_COST_SUMMARY });

  /**
   * 巡检是否进行中
   * @type {Ref<boolean>}
   * @description 巡检要跑一轮完整 Agent，按钮需在此期间禁用防重复触发
   */
  inspecting: Ref<boolean> = ref(false);

  /**
   * 巡检定向重点
   * @type {Ref<string>}
   * @description 可留空；填写后追加到巡检提示词末尾，用于「重点看今天的日志报错」这类定向排查
   */
  inspectionFocus: Ref<string> = ref('');

  /**
   * 最近一次巡检结果
   * @type {Ref<AiInspectionResult | null>}
   * @description 未跑过巡检时为 null，面板据此决定是否展示结果区
   */
  inspectionResult: Ref<AiInspectionResult | null> = ref(null);

  /**
   * 定时巡检的调度状态
   * @type {Ref<AiInspectionStatus | null>}
   * @description 展示「开没开 / 上次什么时候跑 / 下次什么时候跑」；拉取失败保持 null，面板不展示该行
   */
  inspectionStatus: Ref<AiInspectionStatus | null> = ref(null);

  /**
   * 巡检结果轮询定时器
   * @type {ReturnType<typeof setInterval> | null}
   * @description 手动巡检改为后台执行后，靠它轮询状态取简报；结束时与页面卸载时都必须清理
   */
  private inspectionTimer: ReturnType<typeof setInterval> | null = null;

  // ==============================
  // 计算属性（getter）
  // ==============================

  /**
   * 是否可查看全量统计
   * @returns {boolean} 拥有 RBAC 查看/编辑权限时为 true
   */
  get canSeeAll(): boolean {
    const permissions = this.permissionStore.permissions ?? [];
    return AI_COST_ADMIN_PERMISSIONS.some((p) => permissions.includes(p as Permission));
  }

  /**
   * 工具失败率百分比文案
   * @returns {string} 形如「3.2%」
   */
  get failureRateText(): string {
    return `${(this.summary.value.tool_failure_rate * 100).toFixed(1)}%`;
  }

  /**
   * 平均耗时文案（毫秒 / 秒自动切换）
   * @returns {string} 形如「1.8s」
   */
  get avgDurationText(): string {
    const ms = this.summary.value.avg_duration_ms;
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }

  /**
   * P95 耗时文案
   * @returns {string} 形如「4.2s」
   */
  get p95DurationText(): string {
    const ms = this.summary.value.p95_duration_ms;
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }

  /**
   * 估算成本文案（元，保留 4 位小数）
   * @returns {string} 形如「0.0213 元」
   */
  get costText(): string {
    return `${this.summary.value.cost_cny.toFixed(4)} 元`;
  }

  /**
   * 是否无任何数据
   * @returns {boolean} 运行次数为 0 时为 true（用于展示空态提示）
   */
  get isEmpty(): boolean {
    return this.summary.value.runs === 0;
  }

  /**
   * 核心指标卡片数据（图标 + 标签 + 数值）
   * @returns {{ key: string; icon: string; label: string; value: string }[]}
   * @description 数值复用现有展示 getter（costText 等），保证卡片与其它位置口径一致
   */
  get statCards(): { key: string; icon: string; label: string; value: string }[] {
    const t = this.t.value.aiCost;
    return [
      { key: 'runs', icon: 'task', label: t.statRuns, value: String(this.summary.value.runs) },
      { key: 'tokens', icon: 'internet', label: t.statTokens, value: (this.summary.value.total_tokens ?? 0).toLocaleString() },
      { key: 'cost', icon: 'money', label: t.statCost, value: this.costText },
      { key: 'avg', icon: 'time', label: t.statAvgDuration, value: this.avgDurationText },
      { key: 'p95', icon: 'hourglass', label: t.statP95Duration, value: this.p95DurationText },
      { key: 'failure', icon: 'error-circle', label: t.statFailureRate, value: this.failureRateText },
    ];
  }

  /**
   * 按模型表格的列定义
   * @returns {unknown[]} TDesign 表格列配置
   * @description 历史脏数据会聚出 model='unknown' 的桶，展示时翻译为「未知」
   */
  get modelColumns(): unknown[] {
    const t = this.t.value.aiCost;
    return [
      {
        colKey: 'model',
        title: t.colModel,
        cell: (_h: unknown, ctx: { row: { model: string } }) =>
          ctx.row.model === 'unknown' ? t.unknown : ctx.row.model,
      },
      { colKey: 'runs', title: t.colRuns },
      { colKey: 'total_tokens', title: t.colTokens,
        cell: (_h: unknown, ctx: { row: { total_tokens: number } }) =>
          Number(ctx.row.total_tokens ?? 0).toLocaleString(), },
      { colKey: 'cost_cny', title: t.colCost },
      {
        colKey: 'avg_duration_ms',
        title: t.colAvgDuration,
        cell: (_h: unknown, ctx: { row: { avg_duration_ms: number } }) =>
          Number(ctx.row.avg_duration_ms ?? 0).toLocaleString(),
      },
    ];
  }

  /**
   * 按工具表格的列定义
   * @returns {unknown[]} TDesign 表格列配置
   * @description 同上：name='unknown' 的桶展示为「未知工具」；耗时加千分位
   */
  get toolColumns(): unknown[] {
    const t = this.t.value.aiCost;
    return [
      {
        colKey: 'name',
        title: t.colTool,
        cell: (_h: unknown, ctx: { row: { name: string } }) =>
          ctx.row.name === 'unknown' ? t.unknownTool : ctx.row.name,
      },
      { colKey: 'calls', title: t.colCalls },
      { colKey: 'failures', title: t.colFailures },
      {
        colKey: 'avg_duration_ms',
        title: t.colAvgDuration,
        cell: (_h: unknown, ctx: { row: { avg_duration_ms: number } }) =>
          Number(ctx.row.avg_duration_ms ?? 0).toLocaleString(),
      },
    ];
  }

  /**
   * 最近一次巡检耗时文案
   * @returns {string} 形如「12.4s」；未跑过巡检返回空串
   */
  get inspectionDurationText(): string {
    const ms = this.inspectionResult.value?.duration_ms ?? 0;
    if (!ms) return '';
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }

  /** 天数下拉选项 */
  daysOptions: { label: string; value: number }[] = AI_COST_DAYS_OPTIONS;

  /** 是否为全量范围 */
  isAllScope: ComputedRef<boolean> = computed(() => this.scope.value === AI_COST_SCOPE_ALL);

  // ==============================
  // 业务方法
  // ==============================

  /**
   * 加载统计数据
   * @returns {Promise<void>}
   * @description 失败时保留上一次结果并提示，不清空看板
   */
  loadStats = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const res = await this.aiCostService.fetchStats(this.days.value, this.scope.value);
      this.summary.value = res.data.summary ?? { ...EMPTY_AI_COST_SUMMARY };
      // 后端发现越权会把 all 降级为 me，这里同步回前端，避免开关显示与实际不符
      this.scope.value = res.data.scope ?? this.scope.value;
    } catch (err) {
      MessagePlugin.error(`${this.t.value.aiCost.loadFailed}：${(err as Error).message}`);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 拉取定时巡检的调度状态
   * @returns {Promise<void>}
   * @description 状态行是增强信息：读不到就保持 null（面板不展示），不弹错打断整页
   */
  loadInspectionStatus = async (): Promise<void> => {
    try {
      const res = await this.aiCostService.fetchInspectionStatus();
      const status = res.data?.status ?? null;
      this.inspectionStatus.value = status;
      // 定时巡检跑完只落盘，不回填的话刷新页面就看不到上一次简报
      this.applyLastResult(status?.lastResult);
    } catch {
      // 状态拉取失败静默处理，不影响成本看板主流程
    }
  };

  // ==============================
  // 交互事件
  // ==============================

  /**
   * 停止巡检结果轮询
   * @returns {void}
   * @description 轮询结束、失败、页面卸载时统一调用，避免定时器泄漏
   */
  stopInspectionPolling = (): void => {
    if (this.inspectionTimer) {
      clearInterval(this.inspectionTimer);
      this.inspectionTimer = null;
    }
  };

  /**
   * 把最近一次巡检的产出写入结果区
   * @param {AiInspectionRunRecord | null | undefined} record - 状态接口里的 lastResult
   * @returns {void}
   * @description 页面初次加载、定时巡检落盘、手动巡检轮询三条路径共用这一份映射，
   *   避免只在轮询里回填导致「刷新就看不到上次简报」。
   */
  private applyLastResult = (record: AiInspectionRunRecord | null | undefined): void => {
    if (!record) return;
    this.inspectionResult.value = {
      ok: record.ok,
      brief: record.report,
      duration_ms: record.duration_ms,
      tool_calls: record.tool_calls,
      error: record.error,
    };
  };

  /**
   * 轮询巡检状态直到跑完，把简报回填到结果区
   * @returns {void}
   * @description 后端手动巡检是「点火即返回」，这里定时查状态：
   *   running 转 false 即结束轮询（简报由 loadInspectionStatus 统一回填）；
   *   超过最大轮次只提示，不再干等。
   */
  private startInspectionPolling = (): void => {
    this.stopInspectionPolling();
    let rounds = 0;
    this.inspectionTimer = setInterval(async () => {
      rounds += 1;
      if (rounds > AI_INSPECTION_POLL_MAX_ROUNDS) {
        this.stopInspectionPolling();
        this.inspecting.value = false;
        MessagePlugin.warning(this.t.value.aiCost.inspectStillRunning);
        return;
      }
      await this.loadInspectionStatus();
      const status = this.inspectionStatus.value;
      if (status?.running) return;

      this.stopInspectionPolling();
      this.inspecting.value = false;
      const record = status?.lastResult ?? null;
      if (!record) return;
      if (!record.ok) {
        MessagePlugin.warning(record.error || this.t.value.aiCost.inspectFailed);
      }
    }, AI_INSPECTION_POLL_INTERVAL_MS);
  };

  /**
   * 手动触发一次系统巡检
   * @returns {Promise<void>}
   * @description 巡检只带只读工具，结果只展示在本页（不推送）。
   *   接口只负责「点火」（避免长时间等待撞上超时），随后由轮询把简报取回。
   *   进行中重复点击直接忽略——一次巡检要跑完整轮 Agent，并发触发只会烧 token。
   */
  runInspection = async (): Promise<void> => {
    if (this.inspecting.value) return;
    this.inspecting.value = true;
    try {
      const focus = this.inspectionFocus.value.trim() || undefined;
      const res = await this.aiCostService.runInspection(focus, false);
      if (!res.data?.started) {
        this.inspecting.value = false;
        MessagePlugin.warning(res.message || this.t.value.aiCost.inspectFailed);
        return;
      }
      this.startInspectionPolling();
    } catch (err) {
      this.inspecting.value = false;
      MessagePlugin.error(`${this.t.value.aiCost.inspectFailed}：${(err as Error).message}`);
    }
  };

  /**
   * 切换统计范围
   * @param {string} value - me / all
   * @returns {Promise<void>}
   */
  handleScopeChange = async (value: string): Promise<void> => {
    this.scope.value = value;
    await this.loadStats();
  };

  /**
   * 切换统计天数
   * @param {number} value - 天数
   * @returns {Promise<void>}
   */
  handleDaysChange = async (value: number): Promise<void> => {
    this.days.value = value;
    await this.loadStats();
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
    if (this.canSeeAll) this.scope.value = AI_COST_SCOPE_ALL;
    void this.loadStats();
    void this.loadInspectionStatus();
  };

  /**
   * 页面卸载
   * @returns {void}
   */
  beforeUnmount = (): void => {
    // 巡检轮询可能仍在跑，离开页面必须停掉
    this.stopInspectionPolling();
  };
}

/**
 * 创建 AI 成本看板页模型（组合式 API 包装）
 * @returns {object} 暴露给视图的响应式状态与方法
 * @description 统一在 onMounted / onBeforeUnmount 中桥接模型生命周期
 */
export const useAiCostModel = () => {
  const model = new AiCostModel();

  onMounted(() => { model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {
    // i18n
    t: model.t,

    // 状态
    days: model.days,
    scope: model.scope,
    summary: model.summary,
    pageLoading: model.pageLoading,
    daysOptions: model.daysOptions,
    isAllScope: model.isAllScope,
    inspecting: model.inspecting,
    inspectionFocus: model.inspectionFocus,
    inspectionResult: model.inspectionResult,
    inspectionStatus: model.inspectionStatus,

    // 计算属性
    canSeeAll: computed(() => model.canSeeAll),
    statCards: computed(() => model.statCards),
    failureRateText: computed(() => model.failureRateText),
    avgDurationText: computed(() => model.avgDurationText),
    p95DurationText: computed(() => model.p95DurationText),
    costText: computed(() => model.costText),
    isEmpty: computed(() => model.isEmpty),
    modelColumns: computed(() => model.modelColumns),
    toolColumns: computed(() => model.toolColumns),
    inspectionDurationText: computed(() => model.inspectionDurationText),

    // 方法
    loadStats: model.loadStats,
    runInspection: model.runInspection,
    handleScopeChange: model.handleScopeChange,
    handleDaysChange: model.handleDaysChange,
  };
};
