import { ref, computed, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import type { FormInstanceFunctions, FormRules } from 'tdesign-vue-next';
import { useStatusStore } from '@/stores/status';
import { BaseModel } from '@/models/base-model';
/**
 * 登录弹框数据模型类
 * @description 管理邮箱验证码登录弹框的所有业务逻辑，包括发送验证码、倒计时、验证登录等
 */
export class LoginModel extends BaseModel {
  // ==============================
  // 依赖注入
  // ==============================

  /**
   * 系统状态存储实例
   * @type {ReturnType<typeof useStatusStore>}
   * @description 登录成功后启动状态轮询
   */
  statusStore: ReturnType<typeof useStatusStore> = useStatusStore();

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
        // 登录成功后启动状态轮询
        // 页面数据刷新由 authStore.routerViewKey 变更自动触发（见 auth.ts）
        this.statusStore.startPolling();
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
