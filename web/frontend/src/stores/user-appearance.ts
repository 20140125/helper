/**
 * 按用户外观偏好全局状态
 * @description 管理系统背景图遮挡层不透明度，把百分比应用到根节点 CSS 变量并按用户持久化
 */
import { ref } from 'vue';
import { defineStore } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import { UserAppearanceService } from '@/services/user-appearance-service';
import {
  USER_APPEARANCE_SURFACE_OPACITY_DEFAULT,
  USER_APPEARANCE_SURFACE_OPACITY_MAX,
  USER_APPEARANCE_SURFACE_OPACITY_MIN,
} from '@/constants/user-appearance';
import { useLocaleStore } from './locale';

export const useUserAppearanceStore = defineStore('user-appearance', () => {
  /** 按用户外观偏好服务 */
  const service = new UserAppearanceService();
  /** i18n 文案 Store */
  const localeStore = useLocaleStore();

  /** 背景图遮挡层不透明度（%），按用户存数据库 */
  const surfaceOpacity = ref(USER_APPEARANCE_SURFACE_OPACITY_DEFAULT);
  /** 是否正在保存偏好 */
  const saving = ref(false);

  /**
   * 把不透明度限制在合法区间
   * @param {number} value - 原始数值
   * @returns {number} 20–100 之间的整数
   * @description 接口返回的脏数据与滑杆输入统一在此规范化，避免非法值进入 CSS
   */
  const clampSurfaceOpacity = (value: number): number => {
    if (!Number.isFinite(value)) return USER_APPEARANCE_SURFACE_OPACITY_DEFAULT;
    return Math.min(
      USER_APPEARANCE_SURFACE_OPACITY_MAX,
      Math.max(USER_APPEARANCE_SURFACE_OPACITY_MIN, Math.round(value)),
    );
  };

  /**
   * 把不透明度同步到根节点 CSS 变量
   * @returns {void} 无返回值
   * @description app-background.css 用该变量统一驱动卡片 / 顶栏 / 侧栏的 color-mix 比例
   */
  const apply = (): void => {
    document.documentElement.style.setProperty('--app-bg-surface-opacity', `${surfaceOpacity.value}%`);
  };

  /**
   * 拖动滑杆时即时预览
   * @param {number} value - 滑杆当前值
   * @returns {void} 无返回值
   * @description 只改本地 CSS 变量，不写库；松手后由 save() 持久化
   */
  const setSurfaceOpacity = (value: number): void => {
    surfaceOpacity.value = clampSurfaceOpacity(value);
    apply();
  };

  /**
   * 登录后读取当前用户的外观偏好
   * @returns {Promise<void>} 无返回值
   * @description 由顶栏挂载时调用（此时已登录）；失败时静默回退默认值，不阻塞首屏
   */
  const load = async (): Promise<void> => {
    // 先应用默认值：未登录或 401 被拦截器挂起时，界面仍按 :root 的默认 86% 渲染
    apply();
    try {
      const res = await service.fetchAppearance();
      surfaceOpacity.value = clampSurfaceOpacity(res.data.result.surfaceOpacity);
    } catch {
      surfaceOpacity.value = USER_APPEARANCE_SURFACE_OPACITY_DEFAULT;
    }
    apply();
  };

  /**
   * 把当前不透明度按用户写入数据库
   * @returns {Promise<void>} 无返回值
   * @description 失败时保留本地预览值并提示，避免拖动后界面突然跳回
   */
  const save = async (): Promise<void> => {
    saving.value = true;
    try {
      await service.updateSurfaceOpacity(surfaceOpacity.value);
    } catch (err) {
      MessagePlugin.error((err as Error).message || localeStore.t.common.operationFailedRetry);
    } finally {
      saving.value = false;
    }
  };

  return { surfaceOpacity, saving, apply, setSurfaceOpacity, load, save };
});
