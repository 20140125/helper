<template>
  <div
    class="rule-card"
    :class="{ 'rule-card--disabled': disabled, 'rule-card--testing': testing, 'rule-card--has-result': result }"
  >
    <!-- 顶部渐变装饰线（hover 时显示，与 trigger-card 一致） -->
    <div class="rule-card__top-line" />

    <!-- 卡片头部：名称 + 类型标签 + 开关 -->
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <!-- 拖拽排序把手（仅有编辑权限时显示，作为 Sortable 的 handle） -->
        <span v-if="showActions" class="rule-card__drag-handle" :title="t.rules.dragSortHint">
          <t-icon name="drag-move" size="14px" />
        </span>
        <span class="rule-card__icon">{{ icon }}</span>
        <span class="text-sm font-semibold truncate" style="color: var(--text-primary);">{{ name }}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <t-tag :theme="tagTheme" variant="light" size="small">{{ tagLabel }}</t-tag>
        <t-switch
          v-if="showActions"
          :value="enabled"
          size="small"
          @change="(val: boolean) => $emit('toggle', val)"
        />
      </div>
    </div>

    <!-- 触发条件 + 执行时间 -->
    <div class="flex items-center gap-1.5 mb-2">
      <t-icon name="time" size="12px" style="color: var(--text-muted); flex-shrink: 0;" />
      <code class="rule-code text-xs">{{ condition }}</code>
      <span class="text-xs" style="color: var(--text-muted); margin-left: 4px;">{{ time }}</span>
    </div>

    <!-- 内容模式：模板 / 自定义内容 -->
    <div v-if="custom_content || templateLabel" class="flex items-center gap-1.5 mb-2">
      <t-tag v-if="custom_content" theme="warning" variant="light" size="small">✏️ 自定义</t-tag>
      <t-tag v-else-if="templateLabel" theme="success" variant="light" size="small">{{ templateLabel }}</t-tag>
      <span v-if="webhookCount > 0" class="flex items-center gap-0.5 text-xs" style="color: var(--text-muted);">
        <t-icon name="chat" size="12px" /> {{ webhookCount }} 个群
      </span>
    </div>

    <!-- 提醒内容 / 空状态 -->
    <p v-if="message" class="text-xs mb-3 line-clamp-2" style="color: var(--text-secondary); line-height: 1.6;">{{ message }}</p>
    <div
      v-else-if="!custom_content && !templateLabel"
      class="flex items-center gap-1.5 text-xs mb-3"
      style="color: var(--text-muted); opacity: 0.6;"
    >
      <t-icon name="file-paste" size="12px" />
      {{ t.rules.noContentHint }}
    </div>

    <!-- 脚本执行结果 -->
    <transition name="result">
      <script-result
        v-if="result"
        :t="t"
        :result="result"
        :label="name"
        :stdout="result.stdout"
        @clear="$emit('clearResult')"
      />
    </transition>

    <!-- 底部：更新时间 + 操作按钮 -->
    <div class="flex items-center justify-between mt-auto pt-2 flex-wrap gap-2">
      <div class="flex items-center gap-2 text-xs" style="color: var(--text-muted);">
        <span v-if="created_at" :title="t.rules.createdAt + ': ' + created_at">🕐 {{ created_at }}</span>
        <span v-if="updated_at" :title="t.rules.updatedAt + ': ' + updated_at">✏️ {{ updated_at }}</span>
      </div>
      <div v-if="showActions" class="flex items-center gap-1">
        <t-tooltip :content="t.common.test">
          <t-button
            variant="text"
            size="medium"
            @click="$emit('test')"
          >
            <template #icon><t-icon name="play-circle" /></template>
          </t-button>
        </t-tooltip>
        <t-tooltip :content="t.common.edit">
          <t-button variant="text" size="medium" @click="$emit('edit')">
            <template #icon><t-icon name="edit" /></template>
          </t-button>
        </t-tooltip>
        <t-popconfirm :content="t.rules.deleteConfirm" @confirm="$emit('delete')">
          <t-tooltip :content="t.common.delete">
            <t-button variant="text" theme="danger" size="medium">
              <template #icon><t-icon name="delete" /></template>
            </t-button>
          </t-tooltip>
        </t-popconfirm>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ScriptResult from '@/components/common/script-result.vue';
import type { ScriptResultBase } from '@/types/trigger';
import type { Locale } from '@/locales/zh';

/** 标签主题色（与 t-tag 主题保持一致） */
type TagTheme = 'default' | 'primary' | 'warning' | 'danger' | 'success';

withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 头部图标（emoji 或文本），默认 📅 */
  icon?: string;
  /** 规则名称（显示于卡片标题） */
  name: string;
  /** 类型标签文案（如"每周" / "每月"） */
  tagLabel?: string;
  /** 类型标签主题色 */
  tagTheme?: TagTheme;
  /** 规则启用状态 */
  enabled?: boolean;
  /** 是否禁用整个卡片（业务层黑名单 / 不可按状态） */
  disabled?: boolean;
  /** 触发条件表达式文案（如 cron / weekday 描述） */
  condition?: string;
  /** 执行时间，默认 09:00 */
  time?: string;
  /** 提醒文本内容 */
  message?: string;
  /** 是否使用自定义内容（true 显示"自定义"标签，false 显示模板名） */
  custom_content?: boolean;
  /** 模板类型显示名称（custom_content=false 时展示） */
  templateLabel?: string;
  /** 通知群数量 */
  webhookCount?: number;
  /** 创建时间文案 */
  created_at?: string;
  /** 最后修改时间文案 */
  updated_at?: string;
  /** 测试中状态（点击"测试"后的加载指示） */
  testing?: boolean;
  /** 脚本执行结果（传入后在卡片底部展开） */
  result?: ScriptResultBase | null;
  /** 是否显示操作按钮（启停开关、测试、编辑、删除，权限控制） */
  showActions?: boolean;
}>(), {
  /** TODO: icon 描述 */
  icon: '📅',
  /** TODO: tagLabel 描述 */
  tagLabel: '',
  /** TODO: tagTheme 描述 */
  tagTheme: 'primary',
  /** TODO: enabled 描述 */
  enabled: true,
  /** TODO: disabled 描述 */
  disabled: false,
  /** TODO: condition 描述 */
  condition: '',
  /** TODO: time 描述 */
  time: '09:00',
  /** TODO: message 描述 */
  message: '',
  /** TODO: custom_content 描述 */
  custom_content: false,
  /** TODO: templateLabel 描述 */
  templateLabel: '',
  /** TODO: webhookCount 描述 */
  webhookCount: 0,
  /** TODO: created_at 描述 */
  created_at: '',
  /** TODO: updated_at 描述 */
  updated_at: '',
  /** TODO: testing 描述 */
  testing: false,
  /** TODO: result 描述 */
  result: null,
  /** TODO: showActions 描述 */
  showActions: true,
});

defineEmits<{
  /** 切换启用状态，参数为新状态 */
  (e: 'toggle', val: boolean): void;
  /** 点击测试按钮 */
  (e: 'test'): void;
  /** 点击编辑按钮 */
  (e: 'edit'): void;
  /** 点击删除按钮（已走 popconfirm 确认） */
  (e: 'delete'): void;
  /** 清除脚本执行结果 */
  (e: 'clearResult'): void;
}>();
</script>

<style scoped>
.rule-card {
  position: relative;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.rule-card--testing {
  background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.03);
  border-color: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.15);
}

/* 脚本执行结果区域的进入/离开动画 */
.result-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.result-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.result-enter-from,
.result-leave-to {
  opacity: 0;
  max-height: 0;
}

.result-enter-to,
.result-leave-from {
  opacity: 1;
  max-height: 400px;
}

/* 顶部渐变装饰线 */
.rule-card__top-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-primary, rgba(99, 102, 241, 0.6)), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.rule-card:hover .rule-card__top-line {
  opacity: 1;
}

/* 图标 hover 缩放 */
.rule-card__icon {
  font-size: 1rem;
  display: inline-block;
  transition: transform 0.25s ease;
}

.rule-card:hover .rule-card__icon {
  transform: scale(1.12);
}

/* 拖拽排序把手（配合 Sortable handle 使用） */
.rule-card__drag-handle {
  cursor: grab;
  color: var(--text-muted);
  opacity: 0.55;
  display: inline-flex;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

.rule-card__drag-handle:hover {
  opacity: 1;
}

.rule-card__drag-handle:active {
  cursor: grabbing;
}

/* 拖拽中的占位样式（Sortable ghostClass） */
.rule-card--drag-ghost {
  opacity: 0.4;
}
</style>
