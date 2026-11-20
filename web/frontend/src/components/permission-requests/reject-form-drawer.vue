<template>
  <form-drawer
    v-model="visible"
    :t="t"
    :header="t.permissionRequests.rejectDialogHeader"
    :confirm-text="t.permissionRequests.rejectConfirmBtn"
    :loading="rejectSubmitting"
    @confirm="$emit('confirm')"
    @close="$emit('close')"
  >
    <div class="reject-body">
      <!-- 目标信息卡：展示"谁申请了哪个页面" -->
      <div class="reject-target-card">
        <div class="reject-target-avatar">
          <t-icon name="user-circle" size="22px" />
        </div>
        <div class="reject-target-main">
          <div class="reject-target-email">{{ rejectTarget?.email ?? '—' }}</div>
          <div class="reject-target-path">
            <t-icon name="link" size="12px" />
            <code>{{ rejectTarget?.fromPath ?? '—' }}</code>
          </div>
        </div>
      </div>

      <!-- 温馨提示条 -->
      <div class="reject-hint">
        <t-icon name="info-circle-filled" size="16px" class="reject-hint-icon" />
        <div class="reject-hint-text">
          <div class="reject-hint-title">{{ t.permissionRequests.rejectHintTitle }}</div>
          <div class="reject-hint-desc">{{ t.permissionRequests.rejectHintEmail }}</div>
        </div>
      </div>

      <!-- 拒绝理由 -->
      <div class="reject-field">
        <div class="reject-field-label">
          <span>{{ t.permissionRequests.rejectReasonLabel }}</span>
          <span class="reject-field-optional">{{ t.permissionRequests.rejectReasonOptional }}</span>
        </div>
        <t-textarea
          v-model="rejectReason"
          :placeholder="t.permissionRequests.rejectReasonPlaceholder"
          :maxlength="200"
          :autosize="{ minRows: 4, maxRows: 8 }"
        />
      </div>
    </div>
  </form-drawer>
</template>

<script setup lang="ts">
import FormDrawer from '@/components/common/form-drawer.vue';
import type { PermissionRequestItem } from '@/types/permission-request';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 当前拒绝目标（包含申请人邮箱与来源路径），未选中时为 null */
  rejectTarget: PermissionRequestItem | null;
  /** 提交中状态，控制按钮 loading */
  rejectSubmitting: boolean;
}>();

defineEmits<{
  /** 确认提交拒绝 */
  (e: 'confirm'): void;
  /** 关闭抽屉 */
  (e: 'close'): void;
}>();

/** 抽屉显示状态（v-model:visible，Vue 3.4+ defineModel 语法糖） */
const visible = defineModel<boolean>('visible', { required: true });
/** 拒绝理由（v-model:rejectReason，Vue 3.4+ defineModel 语法糖） */
const rejectReason = defineModel<string>('rejectReason', { required: true });

</script>

<style scoped>
.reject-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 0 8px;
}

/* 目标信息卡 */
.reject-target-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.08);
  border: 1px solid rgba(var(--accent-primary-rgb, 99, 102, 241), 0.18);
}

.reject-target-avatar {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.14);
}

.reject-target-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reject-target-email {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, var(--accent-primary));
  word-break: break-all;
}

.reject-target-path {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}

.reject-target-path code {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1);
  color: var(--accent-secondary, var(--accent-primary));
}

/* 温馨提示条（琥珀色） */
.reject-hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.22);
}

.reject-hint-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: #f59e0b;
}

.reject-hint-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reject-hint-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #f59e0b);
}

.reject-hint-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

/* 理由输入区 */
.reject-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reject-field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, var(--accent-primary));
}

.reject-field-optional {
  font-size: 11px;
  font-weight: 400;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--text-muted);
  background: var(--bg-secondary, rgba(148, 163, 184, 0.12));
  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.2));
}
</style>
