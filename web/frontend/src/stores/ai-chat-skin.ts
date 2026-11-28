import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { defineStore } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import { AiChatSkinService } from '@/services/ai-chat-skin-service';
import {
  AI_CHAT_SKIN_PRESETS,
  DEFAULT_AI_CHAT_SKIN_SETTINGS,
} from '@/constants/ai-chat-skin';
import {
  buildAiChatSkinStyle,
  normalizeAiChatSkinPresets,
  normalizeAiChatSkinSettings,
  toAiChatSkinBlob,
} from '@/utils/ai-chat';
import type { AiChatSkinId, AiChatSkinPreset, AiChatSkinSettings } from '@/types/ai-chat-skin';
import { useLocaleStore } from '@/stores/locale';

/** 皮肤服务实例（模块级单例，避免被 Pinia 代理成响应式状态） */
const skinService = new AiChatSkinService();

/** 读取当前语言包中的皮肤文案 */
const skinText = () => useLocaleStore().t.aiChat;

/** 当前生效的背景图短地址（模块级，避免被 Pinia 代理成响应式状态） */
let activeBackgroundUrl = '';
/** 当前短地址对应的图片本体，用于复用与回收 */
let activeBackgroundSource = '';

/**
 * 为背景图生成短 Blob 地址，并回收上一次的地址
 * @param {string} dataUrl - 图片本体 data URL
 * @returns {string} 可直接写进 CSS 的短地址；无图片或解码失败时返回空串
 * @description 浏览器对单个 CSS 值有约 2MiB 上限，图片本体不能进 CSS 变量；
 *   同一张图复用已有地址，图片变化时先 revoke 旧地址避免内存泄漏
 */
const createBackgroundObjectUrl = (dataUrl: string): string => {
  if (dataUrl && dataUrl === activeBackgroundSource && activeBackgroundUrl) {
    return activeBackgroundUrl;
  }
  if (activeBackgroundUrl) {
    URL.revokeObjectURL(activeBackgroundUrl);
    activeBackgroundUrl = '';
    activeBackgroundSource = '';
  }
  if (!dataUrl || typeof URL === 'undefined' || !URL.createObjectURL) return '';
  const blob = toAiChatSkinBlob(dataUrl);
  if (!blob) return '';
  activeBackgroundUrl = URL.createObjectURL(blob);
  activeBackgroundSource = dataUrl;
  return activeBackgroundUrl;
};

/**
 * 贾维斯皮肤全局 Store 类
 * @description 管理数据库预设定义、当前用户配置及其加载/切换/上传，供抽屉与设置面板共享
 */
export class AiChatSkinStore {
  /** 当前用户皮肤配置 */
  settings: Ref<AiChatSkinSettings> = ref({ ...DEFAULT_AI_CHAT_SKIN_SETTINGS });
  /** 自定义背景图的短地址，供 CSS 变量与缩略预览使用 */
  backgroundObjectUrl: Ref<string> = ref('');
  /** 内置皮肤预设（数据库真源；接口不可用时用常量兜底） */
  presets: Ref<AiChatSkinPreset[]> = ref([...AI_CHAT_SKIN_PRESETS]);
  /** 是否正在读取皮肤配置 */
  loading: Ref<boolean> = ref(false);
  /** 是否正在保存皮肤配置 */
  saving: Ref<boolean> = ref(false);
  /** 是否正在上传自定义背景图 */
  uploading: Ref<boolean> = ref(false);
  /** 是否已尝试加载过（失败也置位，避免每次打开抽屉都重试） */
  loaded: Ref<boolean> = ref(false);

  /**
   * 聊天抽屉的局部 CSS 变量
   * @description 由 utils/ai-chat/skin.ts 结合数据库预设计算，绑定到抽屉根节点后只影响聊天窗口子树
   */
  skinStyle: ComputedRef<Record<string, string>> = computed(
    () => buildAiChatSkinStyle(
      this.settings.value,
      this.presets.value,
      this.backgroundObjectUrl.value,
    ),
  );

  /**
   * 统一写入皮肤配置并同步背景图短地址
   * @param {AiChatSkinSettings} next - 目标皮肤配置
   * @returns {void}
   * @description 所有配置写入都经过此处，保证图片本体与 CSS 短地址始终一致
   */
  applySettings = (next: AiChatSkinSettings): void => {
    this.backgroundObjectUrl.value = createBackgroundObjectUrl(next.backgroundUrl);
    this.settings.value = next;
  };

  /**
   * 加载皮肤预设与当前用户配置
   * @param {boolean} force - 是否强制重新请求，默认 false
   * @returns {Promise<void>}
   * @description 首次打开抽屉时惰性加载；两个接口互不依赖，用 Promise.all 并行发出，
   *   各自独立降级（任一失败都不阻断聊天），归一化等两个响应都到齐后再执行
   */
  load = async (force: boolean = false): Promise<void> => {
    if (!force && this.loaded.value) return;
    this.loading.value = true;
    try {
      const [presetsRes, skinRes] = await Promise.all([
        skinService.fetchPresets().catch(() => null),
        skinService.fetchSkin().catch(() => null),
      ]);
      const normalized = presetsRes ? normalizeAiChatSkinPresets(presetsRes.data.presets) : [];
      this.presets.value = normalized.length ? normalized : [...AI_CHAT_SKIN_PRESETS];
      this.applySettings(skinRes
        ? normalizeAiChatSkinSettings(skinRes.data.skin, this.presets.value)
        : { ...DEFAULT_AI_CHAT_SKIN_SETTINGS });
    } finally {
      this.loading.value = false;
      this.loaded.value = true;
    }
  };

  /**
   * 选择内置皮肤
   * @param {AiChatSkinId} id - 皮肤预设 ID
   * @returns {Promise<void>}
   * @description 切换预设会同时清除自定义背景图，避免两套皮肤状态叠加
   */
  selectPreset = async (id: AiChatSkinId): Promise<void> => {
    await this.persist({ skinId: id, backgroundUrl: '' });
  };

  /**
   * 上传并应用自定义背景图
   * @param {File} file - 已完成类型与大小校验的图片文件
   * @returns {Promise<boolean>} 上传并保存是否成功
   * @description 先上传拿到图片本体 data URL，再随当前预设一起写进数据库
   */
  uploadBackground = async (file: File): Promise<boolean> => {
    this.uploading.value = true;
    try {
      const res = await skinService.uploadBackground(file);
      const url = res.data.url;
      await this.persist({ ...this.settings.value, backgroundUrl: url });
      return this.settings.value.backgroundUrl === url;
    } catch {
      MessagePlugin.error(skinText().skinUploadFailed);
      return false;
    } finally {
      this.uploading.value = false;
    }
  };

  /**
   * 移除自定义背景图
   * @returns {Promise<void>}
   * @description 保留当前预设配色，只清空图片本体
   */
  removeBackground = async (): Promise<void> => {
    await this.persist({ ...this.settings.value, backgroundUrl: '' });
  };

  /**
   * 乐观更新并持久化皮肤配置
   * @param {AiChatSkinSettings} next - 目标皮肤配置
   * @returns {Promise<void>}
   * @description 先本地生效保证即时反馈，保存失败则回滚并给出提示
   */
  persist = async (next: AiChatSkinSettings): Promise<void> => {
    const previous = { ...this.settings.value };
    this.applySettings(next);
    this.saving.value = true;
    try {
      const res = await skinService.saveSkin(next);
      this.applySettings(normalizeAiChatSkinSettings(res.data.skin, this.presets.value));
      MessagePlugin.success(skinText().skinApplied);
    } catch {
      this.applySettings(previous);
      MessagePlugin.error(skinText().skinSaveFailed);
    } finally {
      this.saving.value = false;
    }
  };
}

/**
 * 创建贾维斯皮肤 Store 的工厂函数
 * @description 包装为 Pinia setup store，供聊天抽屉与皮肤面板共享同一份状态
 */
export const useAiChatSkinStore = defineStore('aiChatSkin', () => {
  const store = new AiChatSkinStore();
  return { ...store };
});
