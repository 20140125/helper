<template>
  <div class="background-section">
    <div class="background-section__preview" :style="previewStyle">
      <div v-if="!background.url" class="background-section__empty">
        <t-icon name="image" size="28px" />
        <span>{{ t.config.backgroundEmpty }}</span>
      </div>
      <span v-else class="background-section__badge">{{ t.config.backgroundPreview }}</span>
    </div>

    <div class="background-section__actions">
      <t-button
        theme="primary"
        size="small"
        :loading="background.uploading"
        :disabled="!canEdit || background.uploading"
        @click="openFilePicker"
      >
        <template #icon><t-icon name="upload" /></template>
        {{ t.config.backgroundUpload }}
      </t-button>
      <t-button
        v-if="background.url"
        variant="outline"
        size="small"
        :disabled="!canEdit || background.uploading"
        @click="onClear"
      >
        <template #icon><t-icon name="rollback" /></template>
        {{ t.config.backgroundRemove }}
      </t-button>
    </div>

    <div class="background-section__hint">{{ t.config.backgroundUploadHint }}</div>
    <input
      ref="fileInput"
      class="background-section__file"
      type="file"
      :accept="APP_BACKGROUND_ACCEPT"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  APP_BACKGROUND_ACCEPT,
  APP_BACKGROUND_IMAGE_TYPES,
  APP_BACKGROUND_MAX_IMAGE_SIZE,
} from '@/constants/app-background';
import { useAppBackgroundStore } from '@/stores/app-background';
import type { Locale } from '@/types/locale';

const props = defineProps<{
  /** i18n 文案集合 */
  t: Locale;
  /** 是否允许修改系统背景 */
  canEdit: boolean;
}>();

/** 全局系统背景状态（跨页面共享，读写接口由 Store 封装） */
const background = useAppBackgroundStore();

/** 隐藏的原生文件选择器 */
const fileInput = ref<HTMLInputElement | null>(null);

/** 当前背景缩略预览 */
const previewStyle = computed(() => ({
  backgroundImage: background.url ? `url("${background.url}")` : 'none',
}));

/** 打开原生文件选择器 */
const openFilePicker = (): void => {
  fileInput.value?.click();
};

/** 清除背景，恢复默认主题 */
const onClear = (): void => {
  void background.clear();
};

/**
 * 处理图片选择：先校验类型与大小，再交给 Store 上传并保存
 * @param {Event} event - input change 事件
 * @returns {void} 无返回值
 * @description 清空 input.value，保证连续选择同一张图片也能触发 change
 */
const onFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !props.canEdit) return;
  if (!APP_BACKGROUND_IMAGE_TYPES.includes(file.type)) {
    MessagePlugin.warning(props.t.config.backgroundImageTypeInvalid);
    return;
  }
  if (file.size > APP_BACKGROUND_MAX_IMAGE_SIZE) {
    MessagePlugin.warning(props.t.config.backgroundImageTooLarge);
    return;
  }
  void background.upload(file);
};
</script>

<style scoped>
.background-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px 2px;
}

.background-section__preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 150px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  background-color: var(--bg-secondary);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
}

.background-section__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.background-section__badge {
  align-self: flex-end;
  margin: auto 10px 10px;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(9, 12, 20, 0.65);
  color: #fff;
  font-size: 11px;
}

.background-section__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.background-section__hint {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.background-section__file {
  display: none;
}
</style>
