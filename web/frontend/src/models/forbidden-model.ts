import { ref, computed, onMounted, type ComputedRef, type Ref, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { AuthService } from '@/services/auth-service';
import type { ForbiddenPageState } from '@/types/forbidden';

/**
 * 403 无权限页面数据模型类
 * @description 管理 403 页面的展示与权限申请流程，包括来源路径解析、超管联系方式获取、申请提交等
 */
export class ForbiddenModel extends BaseModel {
  // ==============================
  // 依赖注入（router、service、store）
  // ==============================

  /**
   * Vue Router 实例
   * @type {ReturnType<typeof useRouter>}
   * @description 用于返回上一页或跳转到 dashboard
   */
  router: ReturnType<typeof useRouter> = useRouter();

  /**
   * Vue Route 实例
   * @type {ReturnType<typeof useRoute>}
   * @description 用于读取触发 403 时的来源路径与原因
   */
  route: ReturnType<typeof useRoute> = useRoute();

  /**
   * 鉴权服务实例
   * @type {AuthService}
   * @description 用于提交权限申请、获取超管联系方式
   */
  authService: AuthService = new AuthService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 触发 403 的来源路径
   * @type {Ref<string>}
   * @description 从路由 query.from 解析得到，默认回退到 dashboard
   */
  fromPath: Ref<string> = ref('/dashboard');

  /**
   * 触发原因
   * @type {Ref<ForbiddenPageState['reason']>}
   * @description 取值 'route'（前端路由拦截）或 'api'（后端接口拒访）
   */
  reason: Ref<ForbiddenPageState['reason']> = ref('route');

  /**
   * 是否已提交权限申请
   * @type {Ref<boolean>}
   * @description 提交成功后置为 true，用于切换文案为「申请已提交」
   */
  applySubmitted: Ref<boolean> = ref(false);

  /**
   * 超级管理员邮箱
   * @type {Ref<string>}
   * @description 页面挂载时从后端拉取，用于在页面上展示联系方式
   */
  adminEmail: Ref<string> = ref('');

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 页面标题
   * @type {ComputedRef<string>}
   * @description 固定文案 'Access Denied'
   */
  titleText: ComputedRef<string> = computed(() => 'Access Denied');

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 返回上一页或跳转到 dashboard
   * @returns {void}
   * @description 若浏览器历史栈非空则后退一步，否则跳转到默认首页
   */
  goBack = (): void => {
    if (window.history.length > 1) {
      this.router.back();
    } else {
      this.router.push('/dashboard');
    }
  };

  /**
   * 提交权限申请
   * @returns {Promise<void>}
   * @description 向超管发送企业微信通知；超管通过审批后申请人收到邮件通知
   */
  applyPermission = async (): Promise<void> => {
    if (this.pageLoading.value || this.applySubmitted.value) return;

    const t = this.localeStore.t.forbidden;
    // email 不再从前端传入，由后端从 JWT 解析；但仍检查登录状态
    if (!this.authStore.email) {
      MessagePlugin.warning(t.toastNoEmail);
      return;
    }

    this.pageLoading.value = true;
    try {
      const result = await this.authService.applyPermission(
        this.fromPath.value,
      );
      if (result.code === 0) {
        this.applySubmitted.value = true;
        MessagePlugin.success(t.toastSuccess);
      } else {
        MessagePlugin.error(result.message ?? t.toastFail);
      }
    } catch {
      MessagePlugin.error(t.toastNetError);
    } finally {
      this.pageLoading.value = false;
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 从路由 query 读取来源路径与拒访原因，并拉取超管联系邮箱用于展示
   */
  mounted = (): void => {
    // 从路由 query 读取来源路径与拒访原因
    const { from, reason } = this.route.query as { from?: string; reason?: string };
    if (from) this.fromPath.value = decodeURIComponent(from);
    if (reason === 'api' || reason === 'route') {
      this.reason.value = reason;
    }
    // 拉取超管邮箱用于页面展示
    this.authService.fetchAdminContact().then(({ code, data }) => {
      if (code === 0 && data?.email) {
        this.adminEmail.value = data.email;
      }
    }).catch(() => { /* silent fail */ });
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 无需清理资源
   */
  beforeUnmount = (): void => {
    // 无需清理资源
  };
}

/**
 * Composition API 包装函数
 * @description 将 ForbiddenModel 类包装为 Composition API 可用的函数
 */
export const useForbiddenModel = () => {
  const model = new ForbiddenModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => model.mounted());

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => model.beforeUnmount());
  return {
    ...model,
  };
};
