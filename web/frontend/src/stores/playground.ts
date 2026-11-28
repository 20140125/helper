import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TemplateItem } from '@/types/playground';
import { PlaygroundService } from '@/services/playground-service';

/**
 * Playground 模板全局 Store 类
 * @description 缓存 /api/playground 返回的全量模板列表（数据源 hp_playground_templates），
 *              供 config-model、message-templates-model、rule-form-drawer 等共享使用，
 *              避免多个页面各自请求 /api/playground 或 /api/playground/:id
 */
export class PlaygroundStore {
  // ==============================
  // 状态变量
  // ==============================

  /** 全量模板列表 */
  templates = ref<TemplateItem[]>([]);

  /** 加载状态 */
  loading = ref(false);

  /** 是否已加载过（防止重复请求） */
  private loaded = false;

  // ==============================
  // 依赖注入
  // ==============================

  private playgroundService: PlaygroundService = new PlaygroundService();

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载全量模板列表（带缓存，多次调用只请求一次）
   * @param {boolean} force - 是否强制重新加载
   * @returns {Promise<void>}
   */
  fetchTemplates = async (force: boolean = false): Promise<void> => {
    if (this.loaded && !force) return;

    this.loading.value = true;
    try {
      const { code, data: { data: templates } } = await this.playgroundService.getTemplates();
      if (code === 0 && templates) {
        this.templates.value = templates;
        this.loaded = true;
      }
    } catch {
      // 静默失败，不影响主功能
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * 按 id 获取单个模板（从缓存中查找，不发请求）
   * @param {string} id - 模板唯一标识
   * @returns {TemplateItem | undefined} 模板数据，未找到时返回 undefined
   */
  getTemplateById = (id: string): TemplateItem | undefined => {
    return this.templates.value.find((t) => t.id === id);
  }

  /**
   * 按 id 获取模板的 fields（从缓存中查找）
   * @param {string} id - 模板唯一标识
   * @returns {unknown[]} fields 数组，未找到时返回空数组
   */
  getFieldsById = (id: string): unknown[] => {
    return this.getTemplateById(id)?.fields ?? [];
  }

  // ==============================
  // 缓存同步方法（供 playground 页面增删改后更新 store）
  // ==============================

  /**
   * 直接设置全量模板列表（跳过网络请求，直接更新缓存）
   * @param {TemplateItem[]} templates - 最新的模板列表
   * @description 供 auto-form-playground-model 在增删改操作后同步 store 缓存，
   *              避免其他页面读到过期数据
   */
  setTemplates = (templates: TemplateItem[]): void => {
    this.templates.value = templates;
    this.loaded = true;
  }

  /**
   * 按 id 更新单个模板的 fields（就地更新缓存，不发请求）
   * @param {string} id - 模板唯一标识
   * @param {unknown[]} fields - 更新后的 fields 数组
   */
  updateFieldsById = (id: string, fields: unknown[]): void => {
    const tpl = this.templates.value.find((t) => t.id === id);
    if (tpl) {
      tpl.fields = fields;
    }
  }
}

/**
 * 创建 Playground 模板 Pinia Store
 * @description 将 PlaygroundStore 类包装为 Pinia 可用的 Store
 */
export const usePlaygroundStore = defineStore('playground', () => {
  const store = new PlaygroundStore();

  return {
    ...store,
  };
});
