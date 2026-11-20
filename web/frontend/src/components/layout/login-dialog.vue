<template>
  <t-dialog
    :visible="visible"
    :close-btn="false"
    :close-on-overlay-click="false"
    :close-on-esc-keydown="false"
    :footer="false"
    :header="false"
    width="480px"
    attach="body"
    class="login-dialog"
  >
    <div class="login-card">
      <!-- 顶部 logo + 标题 -->
      <div class="login-card__hero">
        <div class="login-card__icon-wrap">
          <t-icon name="notification" size="28px" />
        </div>
        <h2 class="login-card__title">{{ t.login.appName }}</h2>
        <p class="login-card__desc">{{ t.login.desc }}</p>
      </div>

      <!-- 表单 -->
      <t-form
        :ref="registerFormRef"
        :data="formData"
        :rules="rules"
        label-align="top"
        class="login-form"
        @submit="handleFormSubmit"
      >
        <!-- 邮箱 -->
        <t-form-item name="email" class="login-form__item">
          <t-input
            v-model="email"
            size="large"
            :placeholder="t.login.emailPlaceholder"
            autocomplete="email"
            clearable
            class="login-form__input"
          >
            <template #prefix-icon>
              <t-icon name="mail" />
            </template>
          </t-input>
        </t-form-item>

        <!-- 验证码 -->
        <t-form-item name="code" class="login-form__item">
          <div class="login-form__code-row">
            <t-input
              v-model="code"
              :placeholder="t.login.codePlaceholder"
              maxlength="6"
              size="large"
              autocomplete="one-time-code"
              class="login-form__input"
              @enter="emit('verify')"
            >
              <template #prefix-icon>
                <t-icon name="lock-on" />
              </template>
            </t-input>
            <t-button
              variant="outline"
              size="large"
              :disabled="sendDisabled"
              :loading="sendLoading"
              class="login-form__send-btn"
              @click="emit('send-code')"
            >
              {{ sendBtnText }}
            </t-button>
          </div>
        </t-form-item>

        <!-- 发送成功提示 -->
        <div v-if="sendSuccess" class="login-form__send-success">
          <t-icon name="check-circle-filled" size="14px" />
          <span>{{ t.login.sendSuccess }}</span>
        </div>

        <!-- 登录按钮 -->
        <t-form-item class="login-form__item login-form__item--submit">
          <t-button
            theme="primary"
            type="submit"
            block
            size="large"
            :loading="verifyLoading"
            class="login-form__submit-btn"
          >
            {{ t.login.loginBtn }}
          </t-button>
        </t-form-item>
      </t-form>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FormInstanceFunctions, FormRules } from 'tdesign-vue-next';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 是否显示弹框 */
  visible: boolean;
  /** 发送按钮 loading 状态 */
  sendLoading: boolean;
  /** 验证按钮 loading 状态 */
  verifyLoading: boolean;
  /** 验证码发送成功提示 */
  sendSuccess: boolean;
  /** 发送按钮是否禁用 */
  sendDisabled: boolean;
  /** 发送按钮文字 */
  sendBtnText: string;
  /** 表单校验规则（由 model 提供） */
  rules: FormRules;
  /** 将 formRef 注册回 model（由 model 提供） */
  registerFormRef: (instance: FormInstanceFunctions | undefined) => void;
}>();

/** 邮箱双向绑定（v-model:email） */
const email = defineModel<string>('email', { required: true });
/** 验证码双向绑定（v-model:code） */
const code = defineModel<string>('code', { required: true });

const emit = defineEmits<{
  /** 点击发送验证码按钮 */
  (e: 'send-code'): void;
  /** 提交登录（验证码校验） */
  (e: 'verify'): void;
}>();

/** 传给 t-form 的响应式 data（读取 v-model 值） */
const formData = computed(() => ({
  email: email.value,
  code: code.value,
}));

/** t-form submit 事件（type="submit" 触发），校验通过后 emit('verify') */
const handleFormSubmit = ({ validateResult }: { validateResult: boolean | Record<string, unknown> }): void => {
  if (validateResult === true) {
    emit('verify');
  }
};
</script>

<style scoped>
/* ===== 弹框容器 ===== */
:deep(.t-dialog) {
  border-radius: 20px;
  overflow: hidden;
  padding: 0;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08);
}

:deep(.t-dialog__body) {
  padding: 0;
}

/* ===== 卡片主体 ===== */
.login-card {
  padding: 12px 24px;
}

/* ===== Hero 区域 ===== */
.login-card__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 36px;
}

.login-card__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  margin-bottom: 16px;
  box-shadow:
    0 8px 24px rgba(99, 102, 241, 0.4),
    0 2px 8px rgba(99, 102, 241, 0.2);
  position: relative;
}

/* 图标光晕 */
.login-card__icon-wrap::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
  z-index: -1;
}

.login-card__title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
  letter-spacing: -0.3px;
}

.login-card__desc {
  font-size: 14px;
  color: #9ca3af;
  margin: 0;
  line-height: 1.6;
}

/* ===== 表单 ===== */
.login-form {
  display: flex;
  flex-direction: column;
}

.login-form__item {
  margin-bottom: 32px !important;
}

:deep(.t-form__controls-content) {
  min-height: 22px;
}

.login-form__item--submit {
  margin-bottom: 0 !important;
  margin-top: 16px;
}

/* 隐藏 label（无 label 模式） */
:deep(.t-form__label) {
  display: none;
}

/* 输入框撑满宽度 */
:deep(.t-form__controls) {
  width: 100%;
}

/* 输入框样式 */
.login-form__input :deep(.t-input) {
  border-radius: 10px;
  border-color: #e5e7eb;
  background: #f9fafb;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.login-form__input :deep(.t-input:hover) {
  border-color: #a5b4fc;
  background: #fff;
}

.login-form__input :deep(.t-input.t-is-focused) {
  border-color: #6366f1;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.login-form__input :deep(.t-input__prefix) {
  color: #9ca3af;
}

/* 验证码行 */
.login-form__code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.login-form__code-row .login-form__input {
  flex: 1;
  min-width: 0;
}

.login-form__send-btn {
  flex-shrink: 0;
  white-space: nowrap;
  min-width: 120px;
  border-radius: 10px !important;
  border-color: #6366f1 !important;
  color: #6366f1 !important;
  font-weight: 500;
  transition: background 0.2s, color 0.2s !important;
}

.login-form__send-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.06) !important;
}

/* 登录按钮 */
.login-form__submit-btn {
  border-radius: 10px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 1px;
  height: 48px !important;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45);
  transition: box-shadow 0.2s, transform 0.15s !important;
}

.login-form__submit-btn:hover:not(:disabled) {
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.55) !important;
  transform: translateY(-1px);
}

.login-form__submit-btn:active {
  transform: translateY(0) !important;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35) !important;
}

/* 错误提示样式 */
:deep(.t-form__controls-content) {
  font-size: 12px;
}

/* 发送成功提示 */
.login-form__send-success {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  margin-top: -10px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #059669;
  font-size: 13px;
  line-height: 1.5;
}
</style>
