<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.aiCost.pageTitle"
    :subtitle="t.aiCost.subtitle"
  >
    <!-- 工具栏：统计范围 + 天数 + 刷新 -->
    <div class="ai-cost-toolbar">
      <t-radio-group :value="scope" @change="handleScopeChange">
        <t-radio-button value="me">{{ t.aiCost.scopeMe }}</t-radio-button>
        <t-radio-button
          value="all"
          :disabled="!canSeeAll"
        >
          {{ t.aiCost.scopeAll }}
        </t-radio-button>
      </t-radio-group>
      <t-select
        :value="days"
        :options="daysOptions"
        class="ai-cost-days"
        @change="handleDaysChange"
      />
      <t-button theme="default" @click="loadStats">{{ t.aiCost.refresh }}</t-button>
    </div>

    <!-- 手动巡检：跑一轮只读 Agent，把系统健康简报直接呈现在本页 -->
    <inspection-panel
      v-model:focus="inspectionFocus"
      :t="t"
      :loading="inspecting"
      :result="inspectionResult"
      :duration-text="inspectionDurationText"
      :status="inspectionStatus"
      @run="runInspection"
    />

    <!-- 空态 -->
    <div v-if="isEmpty" class="ai-cost-empty">
      {{ t.aiCost.empty }}
    </div>

    <template v-else>
      <!-- 顶部核心指标：与自定义规则页说明卡片同风格（顶部渐变线 + hover 上浮） -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <div v-for="card in statCards" :key="card.key" class="stat-card">
          <div class="stat-card__top-line" />
          <div class="flex items-center gap-1.5 mb-1">
            <t-icon :name="card.icon" class="stat-card__icon" />
            <span class="stat-card__label">{{ card.label }}</span>
          </div>
          <div class="stat-card__num">{{ card.value }}</div>
        </div>
      </div>

      <!-- 按模型 -->
      <div class="ai-cost-section">
        <h3 class="ai-cost-section-title">{{ t.aiCost.sectionByModel }}</h3>
        <t-table
          :data="summary.by_model"
          :columns="modelColumns"
          row-key="model"
          size="small"
        />
      </div>

      <!-- 按工具 -->
      <div class="ai-cost-section">
        <h3 class="ai-cost-section-title">{{ t.aiCost.sectionByTool }}</h3>
        <t-table
          :data="summary.by_tool"
          :columns="toolColumns"
          row-key="name"
          size="small"
        />
      </div>

      <!-- 按天 -->
      <div class="ai-cost-section">
        <h3 class="ai-cost-section-title">{{ t.aiCost.sectionByDay }}</h3>
        <div class="ai-cost-days-list">
          <div v-for="day in summary.by_day" :key="day.date" class="ai-cost-day-row">
            <span class="ai-cost-day-date">{{ day.date }}</span>
            <span class="ai-cost-day-metric">{{ t.aiCost.dayRuns(day.runs) }}</span>
            <span class="ai-cost-day-metric">{{ t.aiCost.dayTokens(day.total_tokens) }}</span>
            <span class="ai-cost-day-metric">{{ t.aiCost.dayCost(day.cost_cny.toFixed(4)) }}</span>
          </div>
        </div>
      </div>
    </template>
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import InspectionPanel from '@/components/ai-cost/inspection-panel.vue';
import { useAiCostModel } from '@/models/ai-cost-model';

const {
  t,
  days,
  scope,
  summary,
  pageLoading,
  daysOptions,
  canSeeAll,
  statCards,
  isEmpty,
  inspecting,
  inspectionFocus,
  inspectionResult,
  inspectionStatus,
  inspectionDurationText,
  modelColumns,
  toolColumns,
  loadStats,
  runInspection,
  handleScopeChange,
  handleDaysChange,
} = useAiCostModel();
</script>

<style scoped>
.ai-cost-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.ai-cost-days {
  width: 120px;
}

.ai-cost-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}

.ai-cost-section {
  margin-bottom: 28px;
}

.ai-cost-section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.ai-cost-days-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-cost-day-row {
  display: grid;
  grid-template-columns: 120px repeat(3, 1fr);
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--td-bg-color-container);
  font-size: 13px;
}

.ai-cost-day-date {
  font-weight: 600;
}
</style>
