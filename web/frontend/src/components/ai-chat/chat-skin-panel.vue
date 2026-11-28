<template>
  <div class="ai-chat-skin-panel">
    <div class="ai-chat-skin-panel__title">{{ t.aiChat.skinTitle }}</div>

    <div class="ai-chat-skin-panel__section">{{ t.aiChat.skinPresetTitle }}</div>
    <div class="ai-chat-skin-panel__presets">
      <button
        v-for="preset in presets"
        :key="preset.skinKey"
        type="button"
        class="ai-chat-skin-preset"
        :class="{ 'ai-chat-skin-preset--active': preset.skinKey === skin.settings.skinId }"
        :title="presetLabel(preset)"
        :aria-label="presetLabel(preset)"
        @click="onSelect(preset.skinKey)"
      >
        <span class="ai-chat-skin-preset__swatch" :style="{ backgroundImage: preset.swatch }">
          <t-icon v-if="preset.skinKey === skin.settings.skinId" name="check" />
        </span>
        <span class="ai-chat-skin-preset__label">{{ presetLabel(preset) }}</span>
      </button>
    </div>

    <div class="ai-chat-skin-panel__section">{{ t.aiChat.skinCustomTitle }}</div>
    <div
      v-if="skin.settings.backgroundUrl"
      class="ai-chat-skin-panel__preview"
      :style="previewStyle"
    />
    <div class="ai-chat-skin-panel__actions">
      <t-button
        size="small"
        theme="primary"
        variant="outline"
        :loading="skin.uploading"
        :disabled="skin.saving"
        @click="openFilePicker"
      >
        <template #icon><t-icon name="image" /></template>
        {{ t.aiChat.skinUpload }}
      </t-button>
      <t-button
        v-if="skin.settings.backgroundUrl"
        size="small"
        variant="text"
        :disabled="skin.saving || skin.uploading"
        @click="onRemoveBackground"
      >
        {{ t.aiChat.skinRemoveBackground }}
      </t-button>
    </div>
    <div class="ai-chat-skin-panel__hint">{{ t.aiChat.skinUploadHint }}</div>
    <input
      ref="fileInput"
      class="ai-chat-skin-panel__file"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  AI_CHAT_SKIN_IMAGE_TYPES,
  AI_CHAT_SKIN_MAX_IMAGE_SIZE,
} from '@/constants/ai-chat-skin';
import { useAiChatSkinStore } from '@/stores/ai-chat-skin';
import { useLocaleStore } from '@/stores/locale';
import type { AiChatSkinId, AiChatSkinPreset } from '@/types/ai-chat-skin';
import type { Locale } from '@/types/locale';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
}>();

/** 皮肤全局状态（跨抽屉与面板共享，读写接口由 Store 封装） */
const skin = useAiChatSkinStore();

/** 语言状态（预设名称由数据库按中英两套存放） */
const localeStore = useLocaleStore();

/** 已启用的皮肤预设（来自数据库 hp_ai_chat_skin_presets） */
const presets = computed(() => skin.presets.filter((item) => item.enabled));

/** 隐藏的原生文件选择器 */
const fileInput = ref<HTMLInputElement | null>(null);

/**
 * 当前自定义背景图的缩略预览
 * @description 使用 Store 生成的短 Blob 地址，避免把 MB 级 data URL 拼进 CSS 被浏览器丢弃
 */
const previewStyle = computed(() => ({
  backgroundImage: skin.backgroundObjectUrl ? `url("${skin.backgroundObjectUrl}")` : 'none',
}));

/**
 * 按当前语言取预设名称
 * @param {AiChatSkinPreset} preset - 预设定义
 * @returns {string} 展示名称
 * @description 名称存于数据库 label_zh / label_en，不再依赖前端语言包常量
 */
const presetLabel = (preset: AiChatSkinPreset): string => (
  localeStore.lang === 'en' ? preset.labelEn : preset.labelZh
);

/** 打开原生文件选择器 */
const openFilePicker = (): void => {
  fileInput.value?.click();
};

/**
 * 选择内置皮肤
 * @param {AiChatSkinId} id - 皮肤 ID
 * @returns {void}
 */
const onSelect = (id: AiChatSkinId): void => {
  void skin.selectPreset(id);
};

/** 移除自定义背景图 */
const onRemoveBackground = (): void => {
  void skin.removeBackground();
};

/**
 * 处理图片选择：先做类型与大小校验，再交给 Store 上传并保存
 * @param {Event} event - input change 事件
 * @returns {void}
 * @description 清空 input.value，保证连续选择同一张图片也能触发 change
 */
const onFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!(AI_CHAT_SKIN_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    MessagePlugin.warning(props.t.aiChat.skinImageTypeInvalid);
    return;
  }
  if (file.size > AI_CHAT_SKIN_MAX_IMAGE_SIZE) {
    MessagePlugin.warning(props.t.aiChat.skinImageTooLarge);
    return;
  }
  void skin.uploadBackground(file);
};
</script>

<style scoped>
.ai-chat-skin-panel {
  padding: 4px 2px 2px;
  color: var(--text-primary);
}

.ai-chat-skin-panel__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.ai-chat-skin-panel__section {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 12px 0 8px;
}

.ai-chat-skin-panel__presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ai-chat-skin-preset {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 5px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}

.ai-chat-skin-preset:hover {
  border-color: var(--accent-primary);
  transform: translateY(-1px);
}

.ai-chat-skin-preset--active {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary);
}

.ai-chat-skin-preset__swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  border-radius: 5px;
  background-size: cover;
  background-position: center;
  color: #fff;
  font-size: 16px;
}

.ai-chat-skin-preset__label {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-skin-panel__preview {
  height: 72px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background-size: cover;
  background-position: center;
  margin-bottom: 8px;
}

.ai-chat-skin-panel__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.ai-chat-skin-panel__hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

.ai-chat-skin-panel__file {
  display: none;
}
</style>
