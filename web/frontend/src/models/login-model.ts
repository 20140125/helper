import { ref, computed, watch, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import type { FormInstanceFunctions, FormRules } from 'tdesign-vue-next';
import { useBootstrapStore } from '@/stores/bootstrap';
import { BaseModel } from '@/models/base-model';
import { AuthService } from '@/services/auth-service';
/**
 * 登录弹框数据模型类
 * @description 管理邮箱验证码登录弹框的所有业务逻辑，包括发送验证码、倒计时、验证登录等
 */
export class LoginModel extends BaseModel {
  // ==============================
  // 依赖注入
  // ==============================

  /**
   * 首屏聚合数据存储实例
   * @type {ReturnType<typeof useBootstrapStore>}
   * @description 登录成功后重新拉取首屏聚合数据并启动状态轮询
   */
  bootstrapStore: ReturnType<typeof useBootstrapStore> = useBootstrapStore();

  /**
   * 鉴权服务实例
   * @type {AuthService}
   * @description 用于拉取系统默认验证码
   */
  authService: AuthService = new AuthService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 用户输入的邮箱地址
   * @type {Ref<string>}
   */
  email: Ref<string> = ref('');

  /**
   * 用户输入的验证码
   * @type {Ref<string>}
   */
  code: Ref<string> = ref('');

  /**
   * 超级管理员邮箱
   * @type {Ref<string>}
   * @description 用于匹配并预填系统默认验证码
   */
  adminEmail: Ref<string> = ref('');

  /**
   * 系统默认验证码
   * @type {Ref<string>}
   * @description 未配置时为空，登录流程保持原有邮箱验证码逻辑
   */
  defaultAuthCode: Ref<string> = ref('');

  /**
   * 发送验证码按钮 loading 状态
   * @type {Ref<boolean>}
   */
  sendLoading: Ref<boolean> = ref(false);

  /**
   * 验证登录按钮 loading 状态
   * @type {Ref<boolean>}
   */
  verifyLoading: Ref<boolean> = ref(false);

  /**
   * 发送验证码倒计时（秒）
   * @type {Ref<number>}
   * @description 0 表示可以重新发送
   */
  countdown: Ref<number> = ref(0);

  /**
   * 验证码发送成功提示
   * @type {Ref<boolean>}
   * @description 发送成功后显示提示，倒计时结束后隐藏
   */
  sendSuccess: Ref<boolean> = ref(false);

  /**
   * 登录表单引用（由 View 层通过 registerFormRef 注入）
   * @type {Ref<FormInstanceFunctions | undefined>}
   */
  formRef: Ref<FormInstanceFunctions | undefined> = ref();

  // ==============================
  // 定时器
  // ==============================

  /**
   * 倒计时定时器
   * @type {ReturnType<typeof setInterval> | null}
   */
  countdownTimer: ReturnType<typeof setInterval> | null = null;

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 是否显示登录弹框
   * @type {ComputedRef<boolean>}
   * @description 未登录时为 true
   */
  visible: ComputedRef<boolean> = computed(() => this.authStore.showLoginDialog);

  /**
   * 发送按钮是否禁用
   * @type {ComputedRef<boolean>}
   * @description 倒计时中或正在发送时禁用
   */
  sendDisabled: ComputedRef<boolean> = computed(
    () => this.countdown.value > 0 || this.sendLoading.value,
  );

  /**
   * 发送按钮文字
   * @type {ComputedRef<string>}
   * @description 倒计时中显示剩余秒数，否则显示「获取验证码」
   */
  sendBtnText: ComputedRef<string> = computed(() => {
    if (this.countdown.value > 0) {
      return this.localeStore.t.login.resendIn(this.countdown.value);
    }
    return this.localeStore.t.login.sendCode;
  });

  /**
   * 登录表单校验规则（随语言切换实时更新）
   * @type {ComputedRef<FormRules>}
   */
  formRules: ComputedRef<FormRules> = computed(() => {
    const t = this.localeStore.t.login;
    return {
      email: [
        { required: true, message: t.emailRequired, type: 'error', trigger: 'blur' },
        { email: true, message: t.emailInvalid, type: 'error', trigger: 'blur' },
      ],
      code: [
        { required: true, message: t.codeRequired, type: 'error', trigger: 'blur' },
        { min: 6, max: 6, message: t.codeLength, type: 'error', trigger: 'blur' },
      ],
    };
  });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 注册表单引用（由 View 层调用）
   * @param {FormInstanceFunctions | undefined} instance - t-form 实例
   * @returns {void}
   */
  registerFormRef = (instance: FormInstanceFunctions | undefined): void => {
    this.formRef.value = instance;
  };

  /**
   * 发送验证码：先对邮箱字段做声明式校验，通过后再调接口
   * @returns {Promise<void>}
   */
  handleSendCode = async (): Promise<void> => {
    if (this.sendDisabled.value) return;

    const result = await this.formRef.value?.validate({ fields: ['email'] });
    if (result !== true) return;

    this.sendLoading.value = true;
    try {
      const res = await this.authStore.sendCode(this.email.value.trim());
      if (res.code === 0) {
        this.sendSuccess.value = true;
        this.startCountdown();
      } else {
        this.formRef.value?.setValidateMessage({
          email: [{ type: 'error', message: res.message }],
        });
      }
    } finally {
      this.sendLoading.value = false;
    }
  };

  /**
   * 验证登录：先对全部字段做声明式校验，通过后再调接口
   * @returns {Promise<void>}
   */
  handleVerify = async (): Promise<void> => {
    const result = await this.formRef.value?.validate();
    if (result !== true) return;

    this.verifyLoading.value = true;
    try {
      const res = await this.authStore.verifyCode(
        this.email.value.trim(),
        this.code.value.trim(),
      );
      if (res.code === 0) {
        this.code.value = '';
        this.email.value = '';
        // 登录成功后按新身份重新拉取首屏聚合数据（一次请求替代 4 个）
        // 页面数据刷新由 authStore.routerViewKey 变更自动触发（见 auth.ts）
        this.bootstrapStore.reset();
        void this.bootstrapStore.load();
      } else {
        this.formRef.value?.setValidateMessage({
          code: [{ type: 'error', message: res.message }],
        });
      }
    } finally {
      this.verifyLoading.value = false;
    }
  };

  // ==============================
  // 系统默认验证码快捷登录
  // ==============================

  /**
   * 构造函数：监听邮箱输入并拉取系统默认验证码
   * @description watch 在 useLoginModel 的 setup 上下文中创建，随组件卸载自动停止
   */
  constructor() {
    super();
    watch(this.email, () => { this.syncDefaultAuthCode(); });
    void this.loadDefaultAuthCode();
  }

  /**
   * 拉取系统默认验证码
   * @returns {Promise<void>}
   * @description 生产环境接口不返回 defaultAuthCode，登录流程保持原有邮箱验证码逻辑
   */
  loadDefaultAuthCode = async (): Promise<void> => {
    try {
      const { code, data } = await this.authService.fetchAdminContact();
      if (code !== 0 || !data?.email || !data.defaultAuthCode) return;
      this.adminEmail.value = data.email;
      this.defaultAuthCode.value = data.defaultAuthCode;
      this.syncDefaultAuthCode();
    } catch {
      // 接口异常时保持原有登录流程
    }
  };

  /**
   * 输入超管邮箱时预填系统默认验证码，切回普通邮箱时清除
   * @returns {void}
   * @description 仅覆盖空验证码，避免打断用户已输入的内容
   */
  syncDefaultAuthCode = (): void => {
    const defaultAuthCode = this.defaultAuthCode.value;
    if (!defaultAuthCode) return;
    const matched = this.email.value.trim() === this.adminEmail.value;
    if (matched && !this.code.value) {
      this.code.value = defaultAuthCode;
    } else if (!matched && this.code.value === defaultAuthCode) {
      this.code.value = '';
    }
  };

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 启动 60 秒倒计时
   * @returns {void}
   * @description 每秒递减，倒计时结束后清除定时器
   */
  private startCountdown = (): void => {
      this.countdown.value = 60;
      if (this.countdownTimer !== null) {
        clearInterval(this.countdownTimer);
      }
      this.countdownTimer = setInterval(() => {
        this.countdown.value -= 1;
        if (this.countdown.value <= 0) {
          this.countdown.value = 0;
          this.sendSuccess.value = false;
          if (this.countdownTimer !== null) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
          }
        }
      }, 1000);
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件卸载前调用的生命周期方法
   * @description 清理倒计时定时器，防止内存泄漏
   */
  beforeUnmount = (): void => {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  };
}

/**
 * Composition API 包装函数
 * @description 将 LoginModel 类包装为 Composition API 可用的函数
 */
export const useLoginModel = () => {
  const model = new LoginModel();

  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {
    ...model,
  };
};
