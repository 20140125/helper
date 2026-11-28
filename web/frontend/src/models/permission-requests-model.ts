import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { PermissionRequestService } from '@/services/permission-request-service';
import { useAuthStore } from '@/stores/auth';
import type { PermissionRequestItem } from '@/types/permission-request';
import { statusTheme, capitalize } from '@/utils/rbac';

/**
 * 权限申请管理页面数据模型类
 * @description 管理权限申请页面的所有业务逻辑，包括列表查询、审批/拒绝、分页、拒绝对话框等
 */
export class PermissionRequestsModel extends BaseModel {
  // ==============================
  // 依赖注入（store / service）
  // ==============================

  /**
   * 权限申请 Service 实例
   * @description 封装权限申请相关的 HTTP 请求
   */
  service = new PermissionRequestService();

  /**
   * 认证 Store 实例
   * @description 获取当前登录用户信息
   */
  authStore = useAuthStore();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 权限申请列表数据
   * @type {Ref<PermissionRequestItem[]>}
   * @description 当前页的权限申请记录集合
   */
  items: Ref<PermissionRequestItem[]> = ref([]);

  /**
   * 总记录数
   * @type {Ref<number>}
   * @description 后端返回的符合筛选条件的总记录数
   */
  total: Ref<number> = ref(0);

  /**
   * 待审批数量
   * @type {Ref<number>}
   * @description 顶部统计使用，后端独立返回
   */
  pendingCount: Ref<number> = ref(0);

  /**
   * 当前页码
   * @type {Ref<number>}
   * @description 从 1 开始
   */
  page: Ref<number> = ref(1);

  /**
   * 每页条数
   * @type {Ref<number>}
   * @description 默认 20
   */
  pageSize: Ref<number> = ref(20);

  /**
   * 状态筛选
   * @type {Ref<'all' | 'pending' | 'approved' | 'rejected'>}
   * @description 控制列表按状态过滤
   */
  statusFilter: Ref<'all' | 'pending' | 'approved' | 'rejected'> = ref('all');

  /**
   * 当前正在操作的行标识
   * @type {Ref<string | null>}
   * @description 用于控制按钮 loading，由 request_id + 动作后缀组成
   */
  actionLoading: Ref<string | null> = ref(null);

  /**
   * 拒绝对话框可见性
   * @type {Ref<boolean>}
   * @description 控制拒绝对话框的显隐
   */
  rejectDialogVisible: Ref<boolean> = ref(false);

  /**
   * 拒绝对话框目标记录
   * @type {Ref<PermissionRequestItem | null>}
   * @description 当前拒绝表单针对的申请记录
   */
  rejectTarget: Ref<PermissionRequestItem | null> = ref(null);

  /**
   * 拒绝原因
   * @type {Ref<string>}
   * @description 表单输入的拒绝说明文本
   */
  rejectReason: Ref<string> = ref('');

  /**
   * 拒绝提交状态
   * @type {Ref<boolean>}
   * @description true 表示拒绝接口提交中
   */
  rejectSubmitting: Ref<boolean> = ref(false);

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 表格列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   */
  columns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const t = this.localeStore.t;
    return [
      { colKey: 'applicant', title: t.permissionRequests.colApplicant, width: 210 },
      { colKey: 'fromPath', title: t.permissionRequests.colPage, minWidth: 160 },
      { colKey: 'reason', title: t.permissionRequests.colReason, minWidth: 140, ellipsis: true },
      { colKey: 'status', title: t.permissionRequests.colStatus, width: 100 },
      {
        colKey: 'created_at',
        title: t.permissionRequests.colcreated_at,
        width: 200,
        sorter: true,
      },
      { colKey: 'resolvedBy', title: t.permissionRequests.colResolvedBy, width: 200 },
      { colKey: 'actions', title: t.permissionRequests.colActions, width: 160, fixed: 'right' as const },
    ];
  });

  // ==============================
  // 公共方法（箭头函数）
  // ==============================

  /**
   * 加载权限申请列表
   */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const result = await this.service.fetchList({
        status: this.statusFilter.value,
        page: this.page.value,
        pageSize: this.pageSize.value,
      });
      this.items.value = result.data.items;
      this.total.value = result.data.total;
      this.pendingCount.value = result.data.pendingCount;
    } catch {
      // silently ignore
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 状态筛选变更
   */
  onStatusChange = (): void => {
    this.page.value = 1;
    this.load();
  };

  /**
   * 分页变更
   */
  onPageChange = (p: { current: number }): void => {
    this.page.value = p.current;
    this.load();
  };

  /**
   * 批准权限申请
   */
  handleApprove = async (row: PermissionRequestItem): Promise<void> => {
    const t = this.localeStore.t;
    this.actionLoading.value = row.request_id + '_approve';
    try {
      await this.service.approveById(row.request_id, this.authStore.email ?? 'admin');
      MessagePlugin.success(t.permissionRequests.approveSuccess);
      await this.load();
    } catch {
      MessagePlugin.error(t.permissionRequests.opFailed);
    } finally {
      this.actionLoading.value = null;
    }
  };

  /**
   * 打开拒绝对话框
   */
  openRejectDialog = (row: PermissionRequestItem): void => {
    this.rejectTarget.value = row;
    this.rejectReason.value = '';
    this.rejectDialogVisible.value = true;
  };

  /**
   * 关闭拒绝对话框
   */
  closeRejectDialog = (): void => {
    this.rejectDialogVisible.value = false;
    this.rejectTarget.value = null;
  };

  /**
   * 提交拒绝
   */
  submitReject = async (): Promise<void> => {
    if (!this.rejectTarget.value) return;
    const t = this.localeStore.t;
    this.rejectSubmitting.value = true;
    this.actionLoading.value = this.rejectTarget.value.request_id + '_reject';
    try {
      await this.service.rejectById(
        this.rejectTarget.value.request_id,
        this.rejectReason.value,
        this.authStore.email ?? 'admin',
      );
      MessagePlugin.success(t.permissionRequests.rejectSuccess);
      this.closeRejectDialog();
      await this.load();
    } catch {
      MessagePlugin.error(t.permissionRequests.opFailed);
    } finally {
      this.rejectSubmitting.value = false;
      this.actionLoading.value = null;
    }
  };

  // ==============================
  // 私有方法
  // ==============================

  // （无）

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载权限申请列表数据
   */
  mounted = (): void => {
    this.load();
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
 * @description 将 PermissionRequestsModel 类包装为 Composition API 可用的函数
 */
export const usePermissionRequestsModel = () => {
  const model = new PermissionRequestsModel();

  onMounted(() => { model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {

    ...model,
    // 辅助函数
    statusTheme,
    capitalize,
  };
};
