<template>
  <page-layout :page-loading="pageLoading" :title="t.rules.pageTitle" :subtitle="t.rules.subtitle">
    <template #actions>
      <t-button v-if="canEdit()" theme="primary" size="large" @click="openCreate">
        <template #icon><t-icon name="add" /></template>
        {{ t.rules.createBtn }}
      </t-button>
    </template>

    <!-- 规则类型说明 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div
        v-for="type in ruleTypes"
        :key="type.value"
        class="rule-type-card"
      >
        <div class="rule-type-card__top-line" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="rule-type-card__icon">{{ type.icon }}</span>
          <span class="text-sm font-semibold" style="color: var(--text-primary);">{{ type.label }}</span>
        </div>
        <p class="text-xs" style="color: var(--text-muted);">{{ type.desc }}</p>
      </div>
    </div>

    <!-- 规则列表 -->
    <card-panel :title="t.rules.listTitle"
      icon="filter"
      icon-theme="secondary"
    >
      <template #title-extra>
        <span class="text-sm" style="color: var(--text-muted);">{{ t.rules.count(rulesStore.rules.length) }}</span>
        <span v-if="canEdit()" class="text-xs ml-3" style="color: var(--text-muted); opacity: 0.8;">
          {{ t.rules.dragSortHint }}
        </span>
      </template>
      <template #actions>
        <t-button variant="outline" size="large" @click="rulesStore.fetchRules(true)">
          <template #icon><t-icon name="refresh" /></template>
          {{ t.common.refresh }}
        </t-button>
      </template>

      <!-- 空状态 -->
      <div v-if="rulesStore.rules.length === 0" class="card-body flex flex-col items-center py-12" style="color: var(--text-muted);">
        <t-icon name="list" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
        <p class="text-sm">{{ t.rules.noRules }}</p>
      </div>

      <!-- 规则卡片网格（挂载后由 Model 初始化 Sortable 实现拖拽排序） -->
      <div v-else :ref="setGridRef" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <rule-card
          v-for="rule in rulesStore.rules"
          :key="rule.id"
          :t="t"
          :icon="typeIcon[rule.type]"
          :name="rule.name"
          :tag-label="typeLabel[rule.type]"
          :tag-theme="typeTheme[rule.type]"
          :enabled="rule.enabled"
          :disabled="!rule.enabled"
          :condition="formatCondition(rule.type, rule.condition)"
          :time="rule.time || '09:00'"
          :message="rule.message"
          :custom-content="!!rule.custom_content"
          :template-label="!rule.custom_content ? templateNameMap[rule.template_id!] || '' : ''"
          :webhook-count="(rule.webhookIds || []).length"
          :created-at="rule.created_at"
          :updated-at="rule.updated_at"
          :executed-today="isExecutedToday(rule)"
          :last-triggered-at="rule.lastTriggeredAt"
          :testing="testingId === rule.id"
          :result="testResults[rule.id]"
          :show-actions="canEdit()"
          @toggle="(val: boolean) => toggleRule(rule.id, val)"
          @test="testRuleRun(rule.id)"
          @edit="openEdit(rule)"
          @delete="rulesStore.removeRule(rule.id)"
          @clear-result="clearTestResult(rule.id)"
        />
      </div>
    </card-panel>

    <!-- 新建/编辑抽屉 -->
    <rule-form-drawer
      v-model:drawer-visible="ruleDrawerVisible"
      v-model:form-data="ruleFormData"
      :header="ruleDrawerHeader"
      :t="t"
      :mode="ruleFormMode"
      :is-mobile="isMobile"
      :form-fields="ruleFormFields"
      :set-form-ref="setRuleFormRef"
      @confirm="submitForm"
      @close="closeDrawer"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { useRulesModel } from '@/models/rules-model';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import RuleCard from '@/components/rules/rule-card.vue';
import RuleFormDrawer from '@/components/rules/rule-form-drawer.vue';

const {
  t,
  rulesStore,
  canEdit,
  ruleDrawerVisible,
  ruleFormData,
  ruleDrawerHeader,
  ruleFormMode,
  ruleFormFields,
  testingId,
  testResults,
  ruleTypes,
  typeLabel,
  typeIcon,
  typeTheme,
  templateNameMap,
  formatCondition,
  isExecutedToday,
  pageLoading,
  isMobile,
  openCreate,
  openEdit,
  closeDrawer,
  submitForm,
  toggleRule,
  testRuleRun,
  clearTestResult,
  setRuleFormRef,
  setGridRef,
} = useRulesModel();
</script>

<style scoped>
</style>
