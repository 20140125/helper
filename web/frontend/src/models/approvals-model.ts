import { ref, computed, onMounted, type Ref, type ComputedRef } from 'vue';
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';
import { AiChatService } from '@/services/ai-chat-service';
import type { ApprovalRequest, ApprovalStatus } from '@/types/ai-chat';
import { BaseModel } from '@/models/base-model';

/** 审批单状态 → TDesign tag theme */
const STATUS_THEME: Record<string, string> = {
  pending: 'warning',
  approved: 'success',
  executed: 'success',
  rejected: 'default',
  failed: 'danger',
};

/**
 * AI 审批单页数据模型
 * @description 加载贾维斯创建的副作用操作审批单（Human-in-the-loop），支持通过执行与驳回
 */
export class ApprovalsModel extends BaseModel {
  // ==============================
  // 依赖注入（service）
  // ==============================

  /**
   * AI 助手服务实例
   * @type {AiChatService}
   * @description 用于拉取审批单列表、通过执行、驳回
   */
  private service: AiChatService = new AiChatService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 全量审批单（后端按创建时间倒序）
   * @type {Ref<ApprovalRequest[]>}
   */
  approvals: Ref<ApprovalRequest[]> = ref<ApprovalRequest[]>([]);

  /**
   * 当前状态筛选（all / pending / executed / rejected / failed）
   * @type {Ref<string>}
   * @description 一次拉全量后本地过滤，切换 Tab 不再打接口
   */
  statusFilter: Ref<string> = ref('all');

  /**
   * 正在执行通过/驳回的审批单 ID
   * @type {Ref<string>}
   * @description 空串表示无进行中的操作，用于按钮 loading 态
   */
  actingId: Ref<string> = ref('');

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 当前用户是否为超级管理员
   * @type {ComputedRef<boolean>}
   * @description 审批权只给超级管理员：非管理员只能查看，通过/驳回按钮隐藏
   */
  isAdmin: ComputedRef<boolean> = computed(() => this.authStore.isAdmin);

  /**
   * 按当前状态筛选后的审批单
   * @type {ComputedRef<ApprovalRequest[]>}
   */
  filteredApprovals: ComputedRef<ApprovalRequest[]> = computed(() => {
    if (this.statusFilter.value === 'all') return this.approvals.value;
    return this.approvals.value.filter((a) => a.status === this.statusFilter.value);
  });

  /**
   * 待审批单数量（Tab 上的角标）
   * @type {ComputedRef<number>}
   */
  pendingCount: ComputedRef<number> = computed(
    () => this.approvals.value.filter((a) => a.status === 'pending').length,
  );

  /**
   * 各状态审批单数量（Tab 上的角标）
   * @type {ComputedRef<Record<'all' | ApprovalStatus, number>>}
   */
  counts: ComputedRef<Record<'all' | ApprovalStatus, number>> = computed(() => {
    const count: Record<'all' | ApprovalStatus, number> = {
      all: this.approvals.value.length,
      pending: 0, approved: 0, executed: 0, rejected: 0, failed: 0,
    };
    for (const a of this.approvals.value) count[a.status] = (count[a.status] ?? 0) + 1;
    return count;
  });

  /**
   * 表格列定义
   * @type {ComputedRef<Array<{ colKey: string; title: string; width?: number; ellipsis?: boolean }>>}
   * @description 标题取 i18n；args / reason / result 三列内容由视图层用插槽自定义渲染
   */
  columns: ComputedRef<Array<{ colKey: string; title: string; width?: number; ellipsis?: boolean }>> =
    computed(() => {
      const t = this.localeStore.t.approvals;
      return [
        { colKey: 'tool', title: t.colTool, width: 160 },
        { colKey: 'user', title: t.colUser, width: 180, ellipsis: true },
        { colKey: 'args', title: t.colArgs, ellipsis: true },
        { colKey: 'reason', title: t.colReason, ellipsis: true },
        { colKey: 'status', title: t.colStatus, width: 110 },
        { colKey: 'created_at', title: t.colCreated, width: 165 },
        { colKey: 'result', title: t.colResult, ellipsis: true },
        { colKey: 'actions', title: t.colActions, width: 180 },
      ];
    });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载审批单列表
   * @description 一次拉全量（后端上限 200 条），Tab 切换走本地过滤
   */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const res = await this.service.fetchApprovals();
      this.approvals.value = res.data.approvals ?? [];
    } catch {
      MessagePlugin.error(this.localeStore.t.approvals.loadFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 通过并执行一张审批单
   * @param {ApprovalRequest} row - 目标审批单
   * @description 后端以审批人身份执行并校验其权限，权限不足会置为 failed；
   *              因会真实触发副作用（推送/重启/执行脚本），执行前弹确认框
   */
  approve = (row: ApprovalRequest): void => {
    const t = this.localeStore.t.approvals;
    const dialog = DialogPlugin.confirm({
      header: t.approveConfirmTitle,
      body: `${t.approveConfirmBody}：${row.tool}`,
      confirmBtn: { theme: 'success', content: t.btnApprove },
      cancelBtn: this.localeStore.t.common.cancel,
      onConfirm: async () => {
        this.actingId.value = row.id;
        try {
          const res = await this.service.approveApproval(row.id);
          const updated = res.data.approval;
          this.replaceApproval(updated);
          MessagePlugin.success(updated.status === 'executed' ? t.approveSuccess : (updated.result || t.execFailed));
        } catch (err) {
          MessagePlugin.error(err instanceof Error ? err.message : t.execFailed);
        } finally {
          this.actingId.value = '';
          dialog.destroy();
          void this.load();
        }
      },
      onClose: () => { dialog.destroy(); },
    });
  };

  /**
   * 驳回一张审批单
   * @param {ApprovalRequest} row - 目标审批单
   */
  reject = (row: ApprovalRequest): void => {
    const t = this.localeStore.t.approvals;
    const dialog = DialogPlugin.confirm({
      header: t.rejectConfirmTitle,
      body: `${t.rejectConfirmBody}：${row.tool}`,
      confirmBtn: { theme: 'danger', content: t.btnReject },
      cancelBtn: this.localeStore.t.common.cancel,
      onConfirm: async () => {
        this.actingId.value = row.id;
        try {
          const res = await this.service.rejectApproval(row.id);
          this.replaceApproval(res.data.approval);
          MessagePlugin.success(t.rejectSuccess);
        } catch (err) {
          MessagePlugin.error(err instanceof Error ? err.message : t.execFailed);
        } finally {
          this.actingId.value = '';
          dialog.destroy();
          void this.load();
        }
      },
      onClose: () => { dialog.destroy(); },
    });
  };

  /**
   * 格式化时间戳为本地时间文本
   * @param {number} ts - 毫秒时间戳
   * @returns {string} 本地化时间文本；空值时返回占位符
   */
  formatTime = (ts?: number): string =>
    ts ? new Date(ts).toLocaleString('zh-CN') : '—';

  /**
   * 把工具参数格式化为可展示的 JSON 文本
   * @param {Record<string, unknown>} args - 工具参数
   * @returns {string} JSON 字符串（超长截断到 200 字符）
   */
  formatArgs = (args: Record<string, unknown>): string => {
    const text = JSON.stringify(args ?? {});
    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  };

  /**
   * 审批单状态 → TDesign tag theme
   * @param {ApprovalStatus} status - 状态
   * @returns {string} tag theme
   */
  statusTheme = (status: ApprovalStatus): string => STATUS_THEME[status] ?? 'default';

  /**
   * 审批单状态 → 本地化文案
   * @param {ApprovalStatus} status - 状态
   * @returns {string} 状态中文名；缺文案时回退为状态原文
   */
  statusLabel = (status: ApprovalStatus): string => {
    const dict = this.localeStore.t.approvals;
    const key = `tag${status.charAt(0).toUpperCase()}${status.slice(1)}` as keyof typeof dict;
    return String(dict[key] ?? status);
  };

  // ==============================
  // 私有辅助
  // ==============================

  /**
   * 用服务端返回的最新单子替换列表中的同 ID 记录
   * @param {ApprovalRequest} updated - 服务端返回的审批单
   * @description 通过/驳回后先本地替换，让状态立刻可见，再异步刷新全量
   */
  private replaceApproval = (updated: ApprovalRequest): void => {
    const idx = this.approvals.value.findIndex((a) => a.id === updated.id);
    if (idx === -1) return;
    this.approvals.value[idx] = updated;
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载审批单列表
   */
  mounted = (): void => {
    void this.load();
  };
}

/**
 * Composition API 包装函数
 * @description 将 ApprovalsModel 类包装为 Composition API 可用的函数
 */
export const useApprovalsModel = () => {
  const model = new ApprovalsModel();

  onMounted(() => { model.mounted(); });

  return {
    ...model,
  };
};
