<template>
  <div class="ai-chat-input">
    <div class="ai-chat-input__box" :class="{ 'is-disabled': disabled }">
      <!-- 待发送图片缩略图：有附件时才出现，每张右上角带移除按钮 -->
      <div v-if="pendingImages.length > 0" class="ai-chat-input__attachments">
        <div v-for="(src, i) in pendingImages" :key="i" class="ai-chat-input__attachment">
          <img :src="src" :alt="t.aiChat.attachedImage" class="ai-chat-input__attachment-img" />
          <button
            type="button"
            class="ai-chat-input__attachment-remove"
            :title="t.aiChat.removeImage"
            :aria-label="t.aiChat.removeImage"
            @click="onRemoveImage(i)"
          >
            <t-icon name="close" size="12px" />
          </button>
        </div>
      </div>
      <t-textarea
        v-model="input"
        class="ai-chat-input__textarea"
        :placeholder="t.aiChat.inputPlaceholder"
        :autosize="{ minRows: 3, maxRows: 6 }"
        :disabled="disabled || streaming"
        @keydown.enter.exact.prevent="onEnter"
      />
      <div class="ai-chat-input__inline-bar">
        <div class="ai-chat-input__inline-bar-left">
          <!-- 工具开关：点击切换 enableTools -->
          <t-tooltip :content="t.aiChat.enableTools" placement="top">
            <button
              type="button"
              class="ai-chat-input__tool-btn"
              :class="{ 'is-active': enableTools }"
              :aria-label="t.aiChat.enableTools"
              :aria-pressed="enableTools"
              @click="enableTools = !enableTools"
            >
              <t-icon name="tools" />
            </button>
          </t-tooltip>

          
          <!-- 指定技能选择器：选中后本轮只跑该技能；选「自动」则由 AI 自行判断 -->
          <t-popup
            v-model:visible="skillPopupOpen"
            trigger="click"
            placement="top-left"
            :overlay-style="{ minWidth: '200px', padding: '4px' }"
            :disabled="availableSkills.length === 0"
          >
            <button
              type="button"
              class="ai-chat-input__model-btn"
              :class="{ 'is-pinned': Boolean(pinnedSkill) }"
              :aria-label="t.aiChat.selectSkill"
              :title="t.aiChat.skillTooltip"
              :disabled="availableSkills.length === 0"
            >
              <span v-if="currentSkillIcon" class="ai-chat-input__skill-emoji">{{ currentSkillIcon }}</span>
              <t-icon v-else name="app" class="ai-chat-input__model-icon" />
              <span class="ai-chat-input__model-label">{{ currentSkillLabel }}</span>
              <t-icon name="chevron-down" class="ai-chat-input__model-caret" />
            </button>
            <template #content>
              <div class="ai-chat-model-list">
                <div
                  class="ai-chat-model-item"
                  :class="{ 'is-active': !pinnedSkill }"
                  @click="onSelectSkill('')"
                >
                  <div class="ai-chat-model-item__main">
                    <div class="ai-chat-model-item__title">
                      <span class="ai-chat-model-item__skill-emoji">🧠</span>
                      <span>{{ t.aiChat.skillAuto }}</span>
                    </div>
                    <div class="ai-chat-model-item__desc">{{ t.aiChat.skillAutoDesc }}</div>
                  </div>
                  <t-icon v-if="!pinnedSkill" name="check" class="ai-chat-model-item__check" />
                </div>
                <!-- 卡片技能分组 -->
                <div v-if="availableSkills.length > 0" class="ai-chat-model-group">
                  {{ t.aiChat.skillGroupTitle }}
                </div>
                <div
                  v-for="s in availableSkills"
                  :key="s.key"
                  class="ai-chat-model-item"
                  :class="{ 'is-active': s.key === pinnedSkill }"
                  @click="onSelectSkill(s.key)"
                >
                  <div class="ai-chat-model-item__main">
                    <div class="ai-chat-model-item__title">
                      <span class="ai-chat-model-item__skill-emoji">{{ s.icon }}</span>
                      <span>{{ s.label }}</span>
                    </div>
                    <div v-if="s.desc" class="ai-chat-model-item__desc">{{ s.desc }}</div>
                  </div>
                  <t-icon v-if="s.key === pinnedSkill" name="check" class="ai-chat-model-item__check" />
                </div>

                <!-- 运维工具分组：新增的增删改工具（manage_rule / manage_logs / manage_cache …）也在这里 -->
                <div v-if="availableTools.length > 0" class="ai-chat-model-group">
                  {{ t.aiChat.toolGroupTitle }}
                </div>
                <div
                  v-for="tool in availableTools"
                  :key="tool.name"
                  class="ai-chat-model-item"
                  :class="{ 'is-active': `tool:${tool.name}` === pinnedSkill }"
                  @click="onSelectSkill(`tool:${tool.name}`)"
                >
                  <div class="ai-chat-model-item__main">
                    <div class="ai-chat-model-item__title">
                      <span class="ai-chat-model-item__skill-emoji">{{ toolIcon(tool.name) }}</span>
                      <span>{{ tool.name }}</span>
                    </div>
                    <div class="ai-chat-model-item__desc">{{ toolDesc(tool) }}</div>
                  </div>
                  <t-icon
                    v-if="`tool:${tool.name}` === pinnedSkill"
                    name="check"
                    class="ai-chat-model-item__check"
                  />
                </div>
              </div>
            </template>
          </t-popup>

          <!-- 上传图片：点击唤起文件选择，选中的图片压缩后挂起到输入框上方 -->
          <t-tooltip :content="t.aiChat.attachImage" placement="top">
            <button
              type="button"
              class="ai-chat-input__tool-btn"
              :class="{ 'is-active': pendingImages.length > 0 }"
              :aria-label="t.aiChat.attachImage"
              @click="onPickImage"
            >
              <t-icon name="image" />
            </button>
          </t-tooltip>
          <input
            ref="fileInputRef"
            type="file"
            class="ai-chat-input__file"
            accept="image/*"
            multiple
            @change="onFileChange"
          />

          <!-- 联网搜索开关：点击切换 enableWebSearch；仅在 enableTools=true 时可点击，
               启用后 LLM 能看到 web_search 工具并按需调用智谱联网搜索 -->
          <t-tooltip :content="t.aiChat.enableWebSearch" placement="top">
            <button
              type="button"
              class="ai-chat-input__tool-btn"
              :class="{ 'is-active': enableWebSearch }"
              :disabled="!enableTools"
              :aria-label="t.aiChat.enableWebSearch"
              :aria-pressed="enableWebSearch"
              @click="enableWebSearch = !enableWebSearch"
            >
              <t-icon name="internet" />
            </button>
          </t-tooltip>

          <!-- 规划模式开关：点击切换 enablePlanning；仅在 enableTools=true 时可点击。
               开启后 Agent 走 L3 流程：先产出执行计划 → 逐步调工具 → 收尾前自我反思，
               反思判定「未完成」时自动补跑，直到答透或达到反思轮次上限。 -->
          <t-tooltip :content="t.aiChat.enablePlanning" placement="top">
            <button
              type="button"
              class="ai-chat-input__tool-btn"
              :class="{ 'is-active': enablePlanning }"
              :disabled="!enableTools"
              :aria-label="t.aiChat.enablePlanning"
              :aria-pressed="enablePlanning"
              @click="enablePlanning = !enablePlanning"
            >
              <t-icon name="task" />
            </button>
          </t-tooltip>

          <!-- 模型选择器（胶囊按钮 + 下拉面板） -->
          <t-popup
            v-model:visible="modelPopupOpen"
            trigger="click"
            placement="top-left"
            :overlay-style="{ minWidth: '220px', padding: '4px' }"
            :disabled="availableModels.length === 0"
          >
            <button
              type="button"
              class="ai-chat-input__model-btn"
              :aria-label="t.aiChat.selectModel"
              :title="t.aiChat.modelTooltip"
              :disabled="availableModels.length === 0"
            >
              <t-icon name="star" class="ai-chat-input__model-icon" />
              <span class="ai-chat-input__model-label">{{ currentModelLabel }}</span>
              <t-icon name="chevron-down" class="ai-chat-input__model-caret" />
            </button>
            <template #content>
              <div class="ai-chat-model-list">
                <template v-for="group in groupedModels" :key="group.key">
                  <div class="ai-chat-model-group ai-chat-model-group--models">
                    <span>{{ group.label }}</span>
                    <span class="ai-chat-model-group__count">{{ group.models.length }}</span>
                  </div>
                  <div
                    v-for="m in group.models"
                    :key="m.id"
                    class="ai-chat-model-item"
                    :class="{ 'is-active': m.id === currentModel }"
                    @click="onSelectModel(m.id)"
                  >
                    <div class="ai-chat-model-item__main">
                      <div class="ai-chat-model-item__title">
                        <span>{{ m.label }}</span>
                        <span v-if="m.free" class="ai-chat-model-item__badge">
                          {{ t.aiChat.modelFree }}
                        </span>
                        <span v-else-if="m.bonusQuota" class="ai-chat-model-item__badge ai-chat-model-item__badge--bonus">
                          {{ t.aiChat.modelBonus }}
                        </span>
                      </div>
                      <div v-if="m.description" class="ai-chat-model-item__desc">
                        {{ m.description }}
                      </div>
                    </div>
                    <t-icon
                      v-if="m.id === currentModel"
                      name="check"
                      class="ai-chat-model-item__check"
                    />
                  </div>
                </template>
              </div>
            </template>
          </t-popup>

        </div>
        <div class="ai-chat-input__inline-bar-right">
          <t-button
            v-if="streaming"
            theme="danger"
            variant="outline"
            size="medium"
            shape="circle"
            @click="emit('stop')"
          >
            <template #icon><t-icon name="stop-circle" /></template>
          </t-button>
          <t-button
            v-else
            theme="primary"
            size="medium"
            shape="circle"
            :disabled="!canSend"
            @click="emit('send')"
          >
            <template #icon><t-icon name="send" /></template>
          </t-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LlmModelOption, LlmModelGroupSection } from '@/types/ai-chat';
import type { Locale } from '@/types/locale';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 是否禁用整体（如健康检查未通过） */
  disabled: boolean;
  /** 是否处于流式响应中 */
  streaming: boolean;
  /** 是否允许发送（综合健康/输入非空/非流式等） */
  canSend: boolean;
  /** 可选模型列表 */
  availableModels: LlmModelOption[];
  /** 可选技能列表（供「指定技能」选择器使用；空数组时选择器禁用） */
  availableSkills: { key: string; label: string; icon: string; desc: string }[];
  /** 当前用户可用的 AI 工具列表（供「运维工具」分组使用） */
  availableTools: { name: string; description: string }[];
}>();

const emit = defineEmits<{
  /** 点击发送按钮 */
  (e: 'send'): void;
  /** 点击停止按钮（流式中） */
  (e: 'stop'): void;
  /** 用户选择了图片文件，交由父组件（model）压缩并挂起 */
  (e: 'pick-images', files: File[]): void;
  /** 移除指定下标的待发送图片 */
  (e: 'remove-image', index: number): void;
}>();

/** 隐藏的文件选择器（点击图片按钮时程序化唤起） */
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 输入框文本（v-model，Vue 3.4+ defineModel 语法糖） */
const input = defineModel<string>('input', { required: true });

/** 是否启用工具调用（v-model:enableTools，Vue 3.4+ defineModel 语法糖） */
const enableTools = defineModel<boolean>('enableTools', { required: true });

/** 是否启用联网搜索（v-model:enableWebSearch，Vue 3.4+ defineModel 语法糖） */
const enableWebSearch = defineModel<boolean>('enableWebSearch', { required: true });

/** 是否启用 L3 规划 + 反思（v-model:enablePlanning，Vue 3.4+ defineModel 语法糖） */
const enablePlanning = defineModel<boolean>('enablePlanning', { required: true });

/** 当前选中的模型 ID（v-model:currentModel，Vue 3.4+ defineModel 语法糖） */
const currentModel = defineModel<string>('currentModel', { required: true });

/** 模型选择器下拉面板开关状态（局部 UI 状态） */
const modelPopupOpen = ref(false);

/** 当前选中的技能 key（v-model:pinnedSkill；空串 = 自动，由 AI 自行判断） */
const pinnedSkill = defineModel<string>('pinnedSkill', { required: true });

/** 待发送的图片 Data URL 列表（v-model:pendingImages，Vue 3.4+ defineModel 语法糖） */
const pendingImages = defineModel<string[]>('pendingImages', { required: true });

/** 技能选择器下拉面板开关状态（局部 UI 状态） */
const skillPopupOpen = ref(false);

/** 当前选中模型的展示名称（在可选列表中匹配，未匹配则退化为 ID、再退化为默认 placeholder） */
const currentModelLabel = computed((): string => {
  if (!currentModel.value) return props.t.aiChat.selectModel;
  const matched = props.availableModels.find((m) => m.id === currentModel.value);
  return matched?.label ?? currentModel.value;
});

/** 按配置组聚合的模型列表（保持后端返回顺序，未分组的模型归到「其它模型」） */
const groupedModels = computed<LlmModelGroupSection[]>(() => {
  const sections: LlmModelGroupSection[] = [];
  const index = new Map<string, LlmModelGroupSection>();
  props.availableModels.forEach((model) => {
    const key = model.groupId || '__other__';
    let section = index.get(key);
    if (!section) {
      section = {
        key,
        label: model.groupName || props.t.aiChat.modelOtherGroup,
        models: [],
      };
      index.set(key, section);
      sections.push(section);
    }
    section.models.push(model);
  });
  return sections;
});

/** 工具名 → emoji 的轻量映射（只覆盖语义明显的几类，其余用统一图标） */
const TOOL_ICONS: Record<string, string> = {
  query: '🔍',
  list: '📋',
  manage: '🛠️',
  create: '➕',
  update: '✏️',
  trigger: '⚡',
  send: '📤',
  card_skill: '🃏',
  annual_update: '🗓️',
  amap: '🗺️',
  translate: '🌐',
  delegate_task: '🧩',
  request_approval: '🕓',
  web_search: '🌍',
};

/**
 * 按工具名推导展示图标
 * @param {string} name - 工具名
 * @returns {string} emoji
 */
const toolIcon = (name: string): string => {
  if (TOOL_ICONS[name]) return TOOL_ICONS[name];
  const prefix = name.split('_')[0];
  return TOOL_ICONS[prefix] ?? '⚙️';
};

/**
 * 工具说明截断（后端 description 较长，下拉里只留前 42 字）
 * @param {{ name: string; description: string }} tool - 工具项
 * @returns {string} 截断后的说明
 */
const toolDesc = (tool: { name: string; description: string }): string => {
  const desc = (tool.description ?? '').trim();
  return desc.length > 42 ? `${desc.slice(0, 42)}…` : desc;
};

/**
 * 当前指定能力的展示名称（未指定时显示「自动」）
 * @description 兼容两种取值：技能 key，或 `tool:<name>`
 */
const currentSkillLabel = computed((): string => {
  const pinned = pinnedSkill.value;
  if (!pinned) return props.t.aiChat.skillAuto;
  if (pinned.startsWith('tool:')) return pinned.slice('tool:'.length);
  const matched = props.availableSkills.find((s) => s.key === pinned);
  return matched?.label ?? pinned;
});

/** 当前指定能力的 emoji 图标（未指定时为空串，按钮退化为通用图标） */
const currentSkillIcon = computed((): string => {
  const pinned = pinnedSkill.value;
  if (!pinned) return '';
  if (pinned.startsWith('tool:')) return toolIcon(pinned.slice('tool:'.length));
  const matched = props.availableSkills.find((s) => s.key === pinned);
  return matched?.icon ?? '';
});

/**
 * 指定技能并关闭下拉面板
 * @param {string} key - 技能 key；空串表示取消指定（交给 AI 自行判断）
 * @returns {void}
 */
const onSelectSkill = (key: string): void => {
  pinnedSkill.value = key;
  skillPopupOpen.value = false;
};

/**
 * 处理回车键事件（Enter 发送，Shift+Enter 换行）
 * @returns {void}
 */
const onEnter = (): void => {
  if (props.canSend) {
    emit('send');
  }
};

/**
 * 点击图片按钮：唤起隐藏的文件选择器
 * @returns {void}
 */
const onPickImage = (): void => {
  fileInputRef.value?.click();
};

/**
 * 文件选择完成：把选中的文件交给父组件处理
 * @returns {void}
 * @description 读完立即清空 input.value，保证连续选择同一个文件也能再次触发 change
 */
const onFileChange = (): void => {
  const files = Array.from(fileInputRef.value?.files ?? []);
  if (fileInputRef.value) fileInputRef.value.value = '';
  if (files.length === 0) return;
  emit('pick-images', files);
};

/**
 * 点击缩略图右上角移除按钮
 * @param {number} index - 待移除图片的下标
 * @returns {void}
 */
const onRemoveImage = (index: number): void => {
  emit('remove-image', index);
};

/**
 * 选择模型并关闭下拉面板
 * @param {string} id - 模型 ID
 * @returns {void}
 */
const onSelectModel = (id: string): void => {
  currentModel.value = id;
  modelPopupOpen.value = false;
};
</script>

<style scoped>
/* ===== 输入区 ===== */
.ai-chat-input {
  border-top: 1px solid var(--border-color);
  padding: 10px 0 0;
  flex-shrink: 0;
}

/* 输入框容器：把 textarea + 内嵌工具栏视觉上合成一个"大输入框" */
.ai-chat-input__box {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card, transparent);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
}

.ai-chat-input__box:focus-within {
  border-color: var(--accent-primary, #0052d9);
  box-shadow: 0 0 0 2px var(--accent-primary-bg, rgba(0, 82, 217, 0.12));
}

.ai-chat-input__box.is-disabled {
  opacity: 0.6;
}

/* textarea 去掉默认外框，避免与外层容器重影 */
.ai-chat-input__textarea :deep(.t-textarea__inner),
.ai-chat-input__textarea :deep(textarea) {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  resize: none;
  padding: 10px 12px 4px;
}

/* 内嵌工具栏：左侧工具开关图标 + 右侧发送按钮 */
.ai-chat-input__inline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 6px;
}

.ai-chat-input__inline-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-chat-input__inline-bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 工具开关：未激活态为灰色描边图标按钮，激活态用主题色高亮 */
.ai-chat-input__tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.ai-chat-input__tool-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.ai-chat-input__tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-chat-input__tool-btn:disabled:hover {
  color: var(--text-muted);
  border-color: var(--border-color);
}

.ai-chat-input__tool-btn.is-active {
  background: var(--accent-primary-bg, rgba(0, 82, 217, 0.12));
  border-color: var(--accent-primary, #0052d9);
  color: var(--accent-primary, #0052d9);
}

/* 隐藏的原生文件选择器（由图片按钮程序化唤起） */
.ai-chat-input__file {
  display: none;
}

/* ===== 待发送图片缩略图 ===== */
.ai-chat-input__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px 0;
}

.ai-chat-input__attachment {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}

.ai-chat-input__attachment-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 右上角移除按钮：默认半透明，hover 时提高不透明度 */
.ai-chat-input__attachment-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s ease;
}

.ai-chat-input__attachment-remove:hover {
  opacity: 1;
}

/* ===== 模型选择器：胶囊按钮 ===== */
.ai-chat-input__model-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-card, transparent);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.ai-chat-input__model-btn:hover:not(:disabled) {
  border-color: var(--accent-primary, #0052d9);
  color: var(--accent-primary, #0052d9);
}

.ai-chat-input__model-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 已指定技能：高亮胶囊，提示本轮不会由 AI 自选 */
.ai-chat-input__model-btn.is-pinned {
  border-color: var(--accent-primary, #0052d9);
  color: var(--accent-primary, #0052d9);
  background: var(--accent-primary-bg, rgba(0, 82, 217, 0.12));
}

.ai-chat-input__model-icon {
  font-size: 14px;
  color: var(--accent-green, #00a870);
  flex-shrink: 0;
}

/* 技能选择器：选中技能的 emoji 图标（与 t-icon 同尺寸占位，避免按钮宽度跳动） */
.ai-chat-input__skill-emoji {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

/* 技能下拉项：label 前的 emoji 图标 */
.ai-chat-model-item__skill-emoji {
  margin-right: 6px;
}

.ai-chat-input__model-label {
  max-width: 140px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ai-chat-input__model-caret {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ===== 模型下拉列表 ===== */
.ai-chat-model-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.ai-chat-model-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.ai-chat-model-item:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
}

.ai-chat-model-item.is-active {
  background: var(--accent-primary-bg, rgba(0, 82, 217, 0.08));
}

.ai-chat-model-item__main {
  flex: 1;
  min-width: 0;
}

.ai-chat-model-item__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.ai-chat-model-item__badge {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--accent-green-bg, rgba(0, 168, 112, 0.12));
  color: var(--accent-green, #00a870);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

.ai-chat-model-item__badge--bonus {
  background: var(--accent-orange-bg, rgba(255, 154, 46, 0.14));
  color: var(--accent-orange, #ff9a2e);
}

.ai-chat-model-item__desc {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 下拉内的分组标题（卡片技能 / 运维工具） */
.ai-chat-model-group {
  margin: 4px 0 2px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  opacity: 0.75;
}

/* 模型下拉按配置组分段：标题滚动时吸顶，右侧显示该组模型数 */
.ai-chat-model-group--models {
  position: sticky;
  top: -2px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
  padding: 6px 8px 4px;
  background: var(--card-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  opacity: 1;
}

.ai-chat-model-group__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  font-size: 10px;
  font-weight: 500;
}

.ai-chat-model-item__check {
  color: var(--accent-primary, #0052d9);
  font-size: 14px;
  flex-shrink: 0;
}
</style>
