import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { TemplateService } from '@/services/template-service';
import type { TemplateConfig } from '@/types/template';
import type { HandlerRegistry } from '@/utils/field-enhancer';
import { createMessageTemplatesHandlers } from '@/utils/handler-registry';
import { useLocaleStore } from '@/stores/locale';

/**
 * 消息模板配置全局 Store 类
 * @description 集中管理消息模板配置（类型、风格等），供多个页面/组件共享使用，
 *              避免每个 model 各自加载 TemplateService 和重复构建 handler 注册表
 */
export class TemplatesStore {
  // ==============================
  // 状态变量
  // ==============================

  /** 完整模板配置（从 .cache/message_templates.json 加载） */
  config = ref<TemplateConfig | null>(null);

  /** 加载状态 */
  loading = ref(false);

  /** 是否已加载过（防止重复请求） */
  private loaded = false;

  // ==============================
  // 依赖注入
  // ==============================

  private templateService: TemplateService = new TemplateService();

  // ==============================
  // 计算属性（使用箭头函数+computed，便于 ...store 展开）
  // ==============================

  /**
   * 获取当前语言下的 messageTemplates 文案 override
   * @returns {{ templateNames: Record<string,string>; styleNames: Record<string,string> }}
   * @description 从 locale store 读取 key→显示名称映射（en.ts 提供完整英文、zh.ts 为空对象降级到 json 原值），
   *              用于覆盖 message_templates.json 里的中文原值实现下拉选项双语切换
   */
  private get localeOverride(): {
    templateNames: Record<string, string>;
    styleNames: Record<string, string>;
    skillSuffix: string;
  } {
    const localeStore = useLocaleStore();
    const { templateNames, styleNames, skillSuffix } = localeStore.t.messageTemplates;
    return { templateNames, styleNames, skillSuffix };
  }

  /**
   * 消息类型下拉选项（全量）
   * @description 列出 template_names 里的全部类型，含「技能类」key
   *   （stock_market / weibo_hot …）——它们没有模板正文，到点是委托脚本取数 + LLM 排版，
   *   但在**规则表单**里必须能选到（规则靠它做定时推送）。
   *   为避免被误当成「模板」去模板页找正文，技能类的 label 后面追加 skillSuffix 说明。
   *   显示名优先取语言 override，其次 template_names。
   */
  typeOptions = computed<Array<{ value: string; label: string; sub?: string }>>(() => {
    const names = this.config.value?.template_names;
    if (!names) return [];
    const bodies = this.config.value?.templates;
    const { templateNames: override, skillSuffix } = this.localeOverride;
    return Object.entries(names).map(([value, label]) => ({
      value,
      label: override[value] ?? label,
      // 没有模板正文 = 技能类：跑脚本产出内容，与「选模板」是两回事，说明以弱化小字展示
      sub: bodies?.[value] ? undefined : skillSuffix,
    }));
  });

  /**
   * 消息模板页的下拉选项（只有真正有模板正文的提醒类）
   * @description 只列 `templates` 里存在正文的类型：技能类（stock_market / weibo_hot …）
   *   没有模板正文（推送排版由脚本侧 LLM 负责），在模板页里选不到。
   *   规则表单请用 typeOptions（全量，技能类要能选到以便委托脚本定时推送）。
   */
  contentTypeOptions = computed<Array<{ value: string; label: string }>>(() => {
    const names = this.config.value?.template_names;
    const bodies = this.config.value?.templates;
    if (!names || !bodies) return [];
    const { templateNames: override } = this.localeOverride;
    return Object.keys(names)
      .filter((key) => Boolean(bodies[key]))
      .map((value) => ({
        value,
        label: override[value] ?? names[value] ?? value,
      }));
  });

  /** 模板风格下拉选项 */
  styleOptions = computed<Array<{ value: string; label: string }>>(() => {
    const styles = this.config.value?.styles;
    if (!styles) return [];
    const { styleNames: override } = this.localeOverride;
    return Object.entries(styles).map(([key, meta]) => ({
      value: key,
      label: override[key] ?? meta.name,
    }));
  });

  /** 模板风格 key => 显示名称 映射 */
  styleNameMap = computed<Record<string, string>>(() => {
    const styles = this.config.value?.styles;
    if (!styles) return {};
    const { styleNames: override } = this.localeOverride;
    return Object.fromEntries(
      Object.entries(styles).map(([key, meta]) => [key, override[key] ?? meta.name]),
    );
  });

  /** 模板类型 key => 显示名称 映射 */
  typeNameMap = computed<Record<string, string>>(() => {
    const names = this.config.value?.template_names;
    if (!names) return {};
    const { templateNames: override } = this.localeOverride;
    return Object.fromEntries(
      Object.entries(names).map(([key, label]) => [key, override[key] ?? label]),
    );
  });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载模板配置（带缓存，多次调用只请求一次）
   * @param {boolean} force - 是否强制重新加载
   * @returns {Promise<void>}
   */
  fetchConfig = async (force = false): Promise<void> => {
    if (this.loaded && !force) return;

    this.loading.value = true;
    try {
      const result = await this.templateService.fetchConfig();
      this.config.value = result.data;
      this.loaded = true;
    } catch {
      // 静默失败，不影响主功能
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * 创建消息模板 handler 注册表
   * @description 基于当前缓存的配置数据构建 handler，供 field-enhancer 解析 $handler:messageTemplates.* 标记
   * @param options - 可选的变更回调
   * @param options.onTypeChange - 类型变更回调
   * @param options.onStyleChange - 风格变更回调
   * @param options.contentOnly - 只返回有模板正文的类型（消息模板页用，默认 false=全量）
   * @returns {HandlerRegistry}
   */
  createHandlers = (options?: {
    onTypeChange?: (val: unknown, data: Record<string, unknown>) => void;
    onStyleChange?: (val: unknown, data: Record<string, unknown>) => void;
    contentOnly?: boolean;
  }): HandlerRegistry => {
    return createMessageTemplatesHandlers({
      getTypeOptions: () => (options?.contentOnly ? this.contentTypeOptions.value : this.typeOptions.value),
      getStyleOptions: () => this.styleOptions.value,
      onTypeChange: options?.onTypeChange,
      onStyleChange: options?.onStyleChange,
    });
  }
}

/**
 * 创建消息模板配置 Pinia Store
 * @description 将 TemplatesStore 类包装为 Pinia 可用的 Store，
 *              供 config-model、message-templates-model、auto-form-playground-model 等共享使用
 */
export const useTemplatesStore = defineStore('templates', () => {
  const store = new TemplatesStore();

  return {
    ...store,
  };
});
