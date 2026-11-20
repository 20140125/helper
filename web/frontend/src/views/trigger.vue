<template>
  <page-layout :page-loading="pageLoading" :title="t.trigger.pageTitle" :subtitle="t.trigger.subtitle">
    <!-- 分类：日常提醒 -->
    <trigger-section
      :t="t"
      :title="t.trigger.sectionDaily"
      dot-color="var(--accent-primary)" 
      :count="dailyScripts.length"
    >
      <trigger-card
        v-for="script in dailyScripts"
        :key="script.key"
        :t="t"
        :script="script"
        :running="runningKey === script.key"
        :result="scriptResults[script.key]"
        :show-run-button="script.canEdit"
        @run="triggerRun(script.key)"
        @clear-result="clearScriptResult(script.key)"
      />
    </trigger-section>

    <!-- 分类：节日与节气 -->
    <trigger-section
      :t="t"
      :title="t.trigger.sectionFestival"
      dot-color="var(--accent-amber)" 
      :count="festivalScripts.length"
    >
      <trigger-card
        v-for="script in festivalScripts"
        :key="script.key"
        :t="t"
        :script="script"
        :running="runningKey === script.key"
        :result="scriptResults[script.key]"
        :show-run-button="script.canEdit"
        @run="triggerRun(script.key)"
        @clear-result="clearScriptResult(script.key)"
      />
    </trigger-section>

    <!-- 分类：系统与工具 -->
    <trigger-section
      :t="t"
      :title="t.trigger.sectionSystem"
      dot-color="var(--accent-green)"
      :count="systemScripts.length + (showAnnualUpdate ? 1 : 0)"
    >
      <trigger-card
        v-for="script in systemScripts"
        :key="script.key"
        :t="t"
        :script="script"
        :running="runningKey === script.key"
        :result="scriptResults[script.key]"
        :show-run-button="script.canEdit"
        @run="triggerRun(script.key)"
        @clear-result="clearScriptResult(script.key)"
      />

      <!-- 年度数据更新工具 -->
      <annual-update-card
        v-if="showAnnualUpdate"
        :t="t"
        :update-tools="updateTools"
        :update-tools-expanded="updateToolsExpanded"
        :expanded-tool="expandedTool"
        :running-tool-key="runningToolKey"
        :tool-args="toolArgs"
        :tool-results="toolResults"
        :annual-update-result="scriptResults['annual_update']"
        :tool-icons="TOOL_ICONS"
        :is-mobile="isMobile"
        :show-run-button="annualUpdateScript?.canEdit ?? false"
        @toggle="toggleUpdateTools"
        @run-annual-update="runAnnualUpdate"
        @clear-annual-result="clearScriptResult('annual_update')"
        @toggle-tool="toggleTool"
        @tool-trigger-run="toolTriggerRun"
        @clear-tool-result="clearToolResult"
        @set-tool-form-ref="setToolFormRef"
        @update-tool-args="updateToolArgs"
      />
    </trigger-section>
  </page-layout>
</template>

<script setup lang="ts">
import { useTriggerModel } from '@/models/trigger-model';
import PageLayout from '@/components/common/page-layout.vue';
import TriggerCard from '@/components/trigger/trigger-card.vue';
import AnnualUpdateCard from '@/components/trigger/annual-update-card.vue';
import TriggerSection from '@/components/trigger/trigger-section.vue';

const {
  t,
  isMobile,
  TOOL_ICONS,
  runningKey,
  scriptResults,
  updateTools,
  updateToolsExpanded,
  expandedTool,
  runningToolKey,
  toolArgs,
  toolResults,
  pageLoading,
  dailyScripts,
  festivalScripts,
  systemScripts,
  showAnnualUpdate,
  annualUpdateScript,
  triggerRun,
  clearScriptResult,
  setToolFormRef,
  toggleUpdateTools,
  runAnnualUpdate,
  toggleTool,
  toolTriggerRun,
  clearToolResult,
  updateToolArgs,
} = useTriggerModel();
</script>


<style scoped>
/* 卡片内部结构 - 弹性等高布局 */
.trigger-card {
  display: flex;
  flex-direction: column;
}

.trigger-card-body {
  flex: 1;
}

.trigger-card-footer {
  margin-top: auto;
  padding-top: 8px;
}

/* 各脚本图标彩色背景 */
.trigger-icon--workday { background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.12) !important; }
.trigger-icon--birthday { background: rgba(var(--accent-red-rgb, 244, 63, 94), 0.12) !important; }
.trigger-icon--weekly { background: rgba(var(--accent-green-rgb, 16, 185, 129), 0.12) !important; }
.trigger-icon--monthly { background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.12) !important; }
.trigger-icon--festival { background: rgba(var(--accent-amber-rgb, 245, 158, 11), 0.12) !important; }
.trigger-icon--prefetch { background: rgba(var(--accent-cyan-rgb, 34, 211, 238), 0.12) !important; }
.trigger-icon--holiday_countdown { background: rgba(var(--accent-secondary-rgb, 139, 92, 246), 0.12) !important; }
.trigger-icon--clear_logs { background: rgba(var(--accent-red-rgb, 244, 63, 94), 0.12) !important; }
.trigger-icon--custom_rules { background: rgba(var(--text-muted-rgb, 107, 114, 128), 0.12) !important; }
.trigger-icon--annual_update { background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.12) !important; }


</style>
