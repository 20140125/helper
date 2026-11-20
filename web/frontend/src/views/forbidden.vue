<template>
  <page-layout :page-loading="pageLoading" :title="t.forbidden.pageTitle">
    <div class="forbidden-container">

      <!-- Icon -->
      <div class="forbidden-icon-wrap" :class="{ submitted: applySubmitted }">
        <t-icon :name="applySubmitted ? 'check-circle' : 'lock-on'" class="forbidden-icon" :class="{ submitted: applySubmitted }" />
      </div>

      <!-- Title -->
      <h2 class="forbidden-title">{{ applySubmitted ? t.forbidden.titleSubmitted : t.forbidden.titleText }}</h2>

      <!-- Description -->
      <p class="forbidden-desc">
        <template v-if="applySubmitted">{{ t.forbidden.descSubmitted }}</template>
        <template v-else-if="reason === 'api'">{{ t.forbidden.descApi }}</template>
        <template v-else>{{ t.forbidden.descRoute(fromPath) }}</template>
      </p>

      <!-- Admin contact -->
      <p v-if="adminEmail && !applySubmitted" class="forbidden-admin">
        {{ t.forbidden.admin }}<span class="forbidden-admin-email">{{ adminEmail }}</span>
      </p>

      <!-- Actions -->
      <div class="forbidden-actions">
        <t-button
          v-if="!applySubmitted"
          theme="primary"
          size="large"
          @click="applyPermission"
        >
          <template #icon><t-icon name="send" /></template>
          {{ t.forbidden.btnApply }}
        </t-button>
        <t-button variant="outline" size="large" @click="goBack">
          <template #icon><t-icon name="arrow-left" /></template>
          {{ t.forbidden.btnBack }}
        </t-button>
      </div>

      <!-- Source path hint -->
      <p v-if="fromPath && !applySubmitted" class="forbidden-from">
        {{ t.forbidden.fromLabel }}<span class="forbidden-from-path">{{ fromPath }}</span>
      </p>
    </div>
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import { useForbiddenModel } from '@/models/forbidden-model';

const {
  pageLoading,
  fromPath,
  reason,
  adminEmail,
  applySubmitted,
  applyPermission,
  goBack,
  t,
} = useForbiddenModel();
</script>

<style scoped>
.forbidden-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 2rem;
  position: relative;
}

.forbidden-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background-color: var(--accent-danger-bg, rgba(229, 57, 53, 0.08));
  margin-bottom: 1.5rem;
  transition: background-color 0.3s ease;
}

.forbidden-icon-wrap.submitted {
  background-color: rgba(22, 163, 74, 0.08);
}

.forbidden-icon {
  font-size: 3rem;
  color: var(--accent-danger, #e53935);
  transition: color 0.3s ease;
}

.forbidden-icon.submitted {
  color: #16a34a;
}

.forbidden-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.forbidden-desc {
  font-size: 0.95rem;
  color: var(--text-muted);
  max-width: 440px;
  line-height: 1.7;
  margin-bottom: 0.75rem;
}

.forbidden-admin {
  font-size: 0.85rem;
  color: var(--text-secondary, var(--text-primary));
  margin-bottom: 2rem;
}

.forbidden-admin-email {
  font-family: monospace;
  color: var(--accent-primary, #3b82f6);
  background: var(--bg-code, rgba(0, 0, 0, 0.04));
  padding: 0.1em 0.4em;
  border-radius: 3px;
  user-select: all;
}

.forbidden-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.forbidden-from {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.forbidden-from-path {
  font-family: monospace;
  color: var(--text-secondary, var(--text-primary));
  background: var(--bg-code, rgba(0, 0, 0, 0.04));
  padding: 0 0.3em;
  border-radius: 3px;
}
</style>
