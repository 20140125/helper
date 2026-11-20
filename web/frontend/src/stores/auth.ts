import { defineStore } from 'pinia';
import { ref, computed, nextTick } from 'vue';
import { AuthService } from '@/services/auth-service';
import { usePermissionStore } from '@/stores/permission';
import { useLocaleStore } from '@/stores/locale';
import { AUTH_STORAGE_KEY } from '@/constants/auth';

/**
 * 鉴权全局 Store 类
 * @description 管理用户登录状态，供 app.vue 及所有页面共享使用
 */
export class AuthStore {
  // ==============================
  // 状态变量
  // ==============================

  /**
   * 是否已登录
   * @description 从 localStorage 初始化，登录后持久化
   */
  isLoggedIn = ref(false);

  /**
   * 是否为管理员
   * @description 登录邮箱与 MAIL_USERNAME 一致时为 true
   */
  isAdmin = ref(false);

  /**
   * 是否正在检查登录状态
   * @description 初始化时检查 token 有效性
   */
  checking = ref(true);

  /**
   * 当前登录用户的邮箱
   * @description 登录成功后赋值，退出登录时清空
   */
  email = ref('');

  /**
   * 当前用户的角色 ID
   * @description 从后端 RBAC 配置中获取
   */
  roleId = ref('');

  /**
   * 路由视图刷新 key
   * @description 绑定到 app.vue 的 <router-view :key>，变更时强制页面组件重新挂载
   *   解决登录前组件已 mounted 但 API 请求被 401 静默丢弃导致数据为空的问题
   */
  routerViewKey = ref(0);

  // ==============================
  // 依赖注入
  // ==============================

  private authService: AuthService = new AuthService();

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 是否需要显示登录弹框
   * @returns {boolean} 未登录且不在检查中时返回 true
   */
  showLoginDialog = computed(() => !this.isLoggedIn.value && !this.checking.value);

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 初始化：从 localStorage 读取 token 并向后端校验有效性
   * @returns {Promise<void>}
   * @description 页面加载时调用，防止用户篡改 localStorage 绕过登录
   */
  init = async (): Promise<void> => {
    this.checking.value = true;
    try {
      const token = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!token) {
        this.isLoggedIn.value = false;
        return;
      }
      const { code, data } = await this.authService.verifyToken(token);
      if (code === 0) {
        this.isLoggedIn.value = true;
        this.isAdmin.value = data.isAdmin ?? false;
        this.email.value = data.email ?? '';
        this.roleId.value = data.roleId ?? '';
        // 加载用户权限列表
        const permissionStore = usePermissionStore();
        permissionStore.setPermissions(data.permissions ?? []);
      } else {
      // token 无效，清除本地存储
        localStorage.removeItem(AUTH_STORAGE_KEY);
        this.isLoggedIn.value = false;
        this.email.value = '';
        this.roleId.value = '';
      }
    } catch {
      // 网络异常等情况，清除本地存储，要求重新登录
      localStorage.removeItem(AUTH_STORAGE_KEY);
      this.isLoggedIn.value = false;
      this.isAdmin.value = false;
      this.email.value = '';
      this.roleId.value = '';
      const permissionStore = usePermissionStore();
      permissionStore.clearPermissions();
    } finally {
      this.checking.value = false;
    }
  };

  /**
   * 发送验证码
   * @param {string} email - 接收验证码的邮箱地址
   * @returns {Promise<{ code: number; message: string }>} 发送结果
   * @description 调用后端接口向用户填写的邮箱发送验证码
   */
  sendCode = async (email: string): Promise<{ code: number; message: string }> => {
    try {
      return await this.authService.sendCode(email);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const message = err?.response?.data?.message ?? err?.message ?? useLocaleStore().t.login.sendFailed;
      return { code: -1, message };
    }
  };

  /**
   * 验证登录
   * @param {string} email - 接收验证码的邮箱地址
   * @param {string} code - 用户输入的验证码
   * @returns {Promise<{ code: number; message: string }>} 验证结果
   * @description 验证成功后将 JWT Token 持久化到 localStorage
   */
  verifyCode = async (email: string, code: string): Promise<{ code: number; message: string }> => {
    try {
      const { code: resCode, data: resData, message } = await this.authService.verifyCode(email, code);
      if (resCode === 0 && resData.token) {
        // 登录成功，持久化 JWT Token
        localStorage.setItem(AUTH_STORAGE_KEY, resData.token);
        this.isLoggedIn.value = true;
        this.isAdmin.value = resData.isAdmin ?? false;
        this.email.value = email;
        this.roleId.value = resData.roleId ?? '';
        // 加载用户权限列表
        const permissionStore = usePermissionStore();
        permissionStore.setPermissions(resData.permissions ?? []);
        // 触发路由视图刷新，让页面组件重新挂载以加载业务数据
        // 延迟到下一个 tick，等 login-dialog（Teleport 到 body）先完成卸载，
        // 避免 Vue 在同一 tick 内同时处理「Teleport 子树 unmount」和「keyed router-view 重挂」
        // 引发 shouldUpdateComponent 读取已置空组件 emitsOptions 的边界 bug
        await nextTick();
        this.routerViewKey.value++;
      }
      return { code: resCode, message };
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const message = err?.response?.data?.message ?? err?.message ?? useLocaleStore().t.login.verifyFailed;
      return { code: -1, message };
    }
  };

  /**
   * 退出登录
   * @returns {Promise<void>}
   * @description 通知后端清除鉴权 Cookie，并清除本地登录状态
   */
  logout = async (): Promise<void> => {
    try {
      await this.authService.logout();
    } catch {
      // 网络异常等情况忽略，仍然清空本地状态
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.isLoggedIn.value = false;
    this.isAdmin.value = false;
    this.email.value = '';
    this.roleId.value = '';
    const permissionStore = usePermissionStore();
    permissionStore.clearPermissions();
  };
}

/**
 * 创建鉴权 Store 实例的工厂函数
 * @description 将 AuthStore 类包装为 Pinia 可用的 Store
 */
export const useAuthStore = defineStore('auth', () => {
  const store = new AuthStore();

  return {
    ...store,
  };
});
