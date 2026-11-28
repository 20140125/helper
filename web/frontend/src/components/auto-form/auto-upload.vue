<template>
  <div class="auto-upload">
    <t-upload
      v-model="fileList"
      :accept="accept"
      :multiple="multiple"
      :max="max"
      :size-limit="sizeLimit"
      :disabled="disabled"
      :draggable="draggable"
      :show-upload-progress="showUploadProgress"
      :auto-upload="autoUpload"
      :theme="theme"
      :tips="tips"
      :placeholder="placeholder"
      :action="action"
      :headers="mergedHeaders"
      :request-method="wrappedRequestMethod"
      @success="handleSuccess"
      @fail="handleFail"
      @remove="handleRemove"
      @change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UploadFile, RequestMethodResponse } from 'tdesign-vue-next';
import type { AutoFormUploadFile } from '@/types/auto-form';
import { AUTH_STORAGE_KEY } from '@/constants/auth';

const props = withDefaults(defineProps<{


  /** 当前已上传的文件列表（v-model） */
  value: AutoFormUploadFile[];
  /** 允许上传的文件类型，如 'image/*' 或 '.pdf,.docx' */
  accept?: string;
  /** 是否允许多文件上传，默认 false */
  multiple?: boolean;
  /** 最多上传文件数量，默认不限制 */
  max?: number;
  /** 文件大小限制，单位 KB，默认不限制 */
  sizeLimit?: number | { size: number; unit: 'B' | 'KB' | 'MB' | 'GB'; message?: string };
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否支持拖拽上传，默认 false */
  draggable?: boolean;
  /** 是否显示上传进度，默认 true */
  showUploadProgress?: boolean;
  /** 是否自动上传（选择文件后立即上传），默认 true */
  autoUpload?: boolean;
  /** 展示风格：file-input / file-flow / image / image-flow / custom，默认 'file-input' */
  theme?: 'file-input' | 'file-flow' | 'image' | 'image-flow' | 'custom';
  /** 底部提示文字 */
  tips?: string;
  /** 占位提示文字 */
  placeholder?: string;
  /** 上传目标 URL：传入后由 TDesign 内置方式发起上传（与 requestMethod 二选一） */
  action?: string;
  /** 自定义请求头：会与默认的鉴权 header（Authorization）浅合并，外部传入优先级更高 */
  headers?: Record<string, string>;
  /** 自定义上传方法：由调用方通过 service 实现（优先级高于 action） */
  requestMethod?: (files: AutoFormUploadFile | AutoFormUploadFile[]) => Promise<RequestMethodResponse>;
}>(), {
  multiple: false,
  draggable: false,
  showUploadProgress: true,
  autoUpload: true,
  theme: 'file-input',


});

const emit = defineEmits<{


  /** 双向绑定：文件列表变化（v-model:value） */
  (e: 'update:value', files: AutoFormUploadFile[]): void;
  /** 文件列表变化（增、删、状态更新都会触发） */
  (e: 'change', files: AutoFormUploadFile[]): void;
  /** 单个文件上传成功 */
  (e: 'success', file: AutoFormUploadFile, fileList: AutoFormUploadFile[]): void;
  /** 单个文件上传失败 */
  (e: 'fail', file: AutoFormUploadFile): void;
  /** 单个文件被移除 */
  (e: 'remove', file: AutoFormUploadFile, fileList: AutoFormUploadFile[]): void;
}>();

/**
 * 计算最终透传给 t-upload 的请求头：
 * 1. 默认从 localStorage 读取 token，注入 Authorization: Bearer xxx
 * 2. 外部通过 headers prop 传入的 header 会覆盖默认值（保留定制能力）
 * 3. 使用 computed 保证每次渲染都实时读取，避免 token 刷新后失效
 */
const mergedHeaders = computed<Record<string, string>>(() => {
  const base: Record<string, string> = {};
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  if (token) {
    base.Authorization = `Bearer ${token}`;
  }
  return { ...base, ...(props.headers ?? {

}) };
});

/** 将内部 UploadFile 格式转换为 AutoFormUploadFile */
const toAutoFile = (f: UploadFile): AutoFormUploadFile => ({
  uid: String(f.uid ?? f.name),
  name: f.name ?? '',
  url: f.url ?? '',
  status: f.status as AutoFormUploadFile['status'],
  size: f.size,
  raw: f.raw,
  response: f.response as Record<string, unknown> | undefined,
});

/** 双向绑定：将 AutoFormUploadFile[] 转换为 UploadFile[] */
const fileList = computed({
  get: () =>
    props.value.map((f) => ({
      uid: f.uid,
      name: f.name,
      url: f.url,
      status: f.status,
      size: f.size,
      raw: f.raw,
      response: f.response,
    } as UploadFile)),
  set: (list: UploadFile[]) => {
    emit('update:value', list.map(toAutoFile));
  },
});

/**
 * 统一的上传方法：仅支持调用方传入的 requestMethod
 * 组件本身不再持有 http 逻辑，保持纯 UI 职责。
 */
const wrappedRequestMethod = computed(() => {
  if (!props.requestMethod) return undefined;
  return (files: UploadFile | UploadFile[]) => {
    const converted = Array.isArray(files) ? files.map(toAutoFile) : toAutoFile(files);
    return props.requestMethod!(converted);
  };
});

/**
 * 上传成功回调：更新双向绑定的 fileList，并触发 change、success 事件
 * @param params 上传成功的文件和文件列表
 */
const handleSuccess = (params: { file: UploadFile; fileList: UploadFile[] }): void => {
  const file = toAutoFile(params.file);
  const list = params.fileList.map(toAutoFile);
  emit('update:value', list);
  emit('change', list);
  emit('success', file, list);
};

/**
 * 上传失败回调：触发 fail 事件
 * @param params 上传失败的文件
 */
const handleFail = (params: { file: UploadFile }): void => {
  emit('fail', toAutoFile(params.file));
};

/**
 * 删除文件回调：更新双向绑定的 fileList，并触发 change、remove 事件
 * @param params 删除的文件和文件列表
 */
const handleRemove = (params: { file: UploadFile; fileList: UploadFile[] }): void => {
  const file = toAutoFile(params.file);
  const list = params.fileList.map(toAutoFile);
  emit('update:value', list);
  emit('change', list);
  emit('remove', file, list);
};

/**
 * 文件列表变化回调：更新双向绑定的 fileList，并触发 change 事件
 * @param fileList 文件列表
 */
const handleChange = (fileList: UploadFile[]): void => {
  const list = fileList.map(toAutoFile);
  emit('update:value', list);
  emit('change', list);
};
</script>

<style scoped>
.auto-upload {
  width: 100%;
}

:deep(.t-upload) {
  width: 100%;
}
</style>
