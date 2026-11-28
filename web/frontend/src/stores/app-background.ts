/**
 * 系统背景图全局状态
 * @description 跨页面共享背景地址，负责把 URL 应用到 <html> 的 CSS 变量与 data 属性
 */
import { ref } from 'vue';
import { defineStore } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import { AppBackgroundService } from '@/services/app-background-service';
import {
  APP_BACKGROUND_IMAGE_TYPES,
  APP_BACKGROUND_MAX_IMAGE_SIZE,
  APP_BACKGROUND_URL_PATTERN,
} from '@/constants/app-background';
import { useLocaleStore } from './locale';

export const useAppBackgroundStore = defineStore('app-background', () => {
  /** 系统背景图服务 */
  const service = new AppBackgroundService();
  /** i18n 文案 Store */
  const localeStore = useLocaleStore();

  /** 当前背景图地址，空串表示默认主题 */
  const url = ref('');
  /** 是否正在上传或保存 */
  const uploading = ref(false);

  /**
   * 把背景地址同步到根节点
   * @returns {void} 无返回值
   * @description 二次校验 URL 后再拼进 CSS，避免任意字符串注入 url()
   */
  const apply = (): void => {
    const root = document.documentElement;
    if (url.value && APP_BACKGROUND_URL_PATTERN.test(url.value)) {
      root.style.setProperty('--app-bg-image', `url("${url.value}")`);
      root.dataset.appBg = '1';
    } else {
      root.style.removeProperty('--app-bg-image');
      delete root.dataset.appBg;
    }
  };

  /**
   * 启动时读取背景配置
   * @returns {Promise<void>} 无返回值
   * @description 接口公开且失败时静默回退默认主题，不阻塞首屏
   */
  const load = async (): Promise<void> => {
    try {
      const res = await service.fetchBackground();
      url.value = res.data.result.url ?? '';
    } catch {
      url.value = '';
    }
    apply();
  };

  /**
   * 上传并立即应用背景图
   * @param {File} file - 待上传的图片
   * @returns {Promise<void>} 无返回值
   * @description 前端先校验类型与大小，上传成功后再写入配置并应用
   */
  const upload = async (file: File): Promise<void> => {
    if (!APP_BACKGROUND_IMAGE_TYPES.includes(file.type)) {
      MessagePlugin.warning(localeStore.t.config.backgroundImageTypeInvalid);
      return;
    }
    if (file.size > APP_BACKGROUND_MAX_IMAGE_SIZE) {
      MessagePlugin.warning(localeStore.t.config.backgroundImageTooLarge);
      return;
    }
    uploading.value = true;
    try {
      const res = await service.uploadBackground(file);
      await service.saveBackground(res.data.url);
      url.value = res.data.url;
      apply();
      MessagePlugin.success(localeStore.t.config.backgroundApplied);
    } catch (err) {
      MessagePlugin.error((err as Error).message || localeStore.t.config.backgroundUploadFailed);
    } finally {
      uploading.value = false;
    }
  };

  /**
   * 清除背景，恢复默认主题
   * @returns {Promise<void>} 无返回值
   * @description 失败时保留当前背景，避免界面突然变化
   */
  const clear = async (): Promise<void> => {
    uploading.value = true;
    try {
      await service.clearBackground();
      url.value = '';
      apply();
      MessagePlugin.success(localeStore.t.common.deleteSuccess);
    } catch (err) {
      MessagePlugin.error((err as Error).message || localeStore.t.common.operationFailedRetry);
    } finally {
      uploading.value = false;
    }
  };

  return { url, uploading, load, upload, clear, apply };
});
