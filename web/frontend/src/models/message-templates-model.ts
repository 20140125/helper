import { ref, computed, watch, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize-html';
import { MessagePlugin } from 'tdesign-vue-next';
import { TemplateService } from '@/services/template-service';
import { useTemplatesStore } from '@/stores/templates';
import { usePlaygroundStore } from '@/stores/playground';
import type { AutoFormField } from '@/types/auto-form';
import { enhanceFields, type HandlerRegistry } from '@/utils/field-enhancer';
import { BaseModel } from '@/models/base-model';
import type { FileContentInstance } from '@/types/component-instances';

/**
 * 消息模板页面数据模型类
 * @description 管理消息模板页面的所有业务逻辑，包括模板预览和测试发送
 */
export class MessageTemplatesModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * 模板服务实例
   * @type {TemplateService}
   * @description 用于加载、保存、预览消息模板内容
   */
  templateService: TemplateService = new TemplateService();

  /**
   * Playground 模板全局存储实例
   * @type {ReturnType<typeof usePlaygroundStore>}
   * @description 缓存全量模板，避免重复请求
   */
  playgroundStore: ReturnType<typeof usePlaygroundStore> = usePlaygroundStore();

  /**
   * 消息模板配置全局存储实例
   * @type {ReturnType<typeof useTemplatesStore>}
   * @description 共享模板类型和风格数据
   */
  templatesStore: ReturnType<typeof useTemplatesStore> = useTemplatesStore();

  /**
   * 从 JSON 加载的原始字段模板缓存
   * @type {Ref<unknown[]>}
   * @description 使用 ref 以确保响应式更新
   */
  rawSelectorFields: Ref<unknown[]> = ref([]);

  /**
   * Markdown 编辑器 FileContent 组件实例引用
   * @description 用于切换模板类型/风格时主动调用 resetEditor 刷新编辑器内容，
   *              避免 prop 双向绑定导致光标丢失
   */
  editorRef: Ref<FileContentInstance | undefined> = ref(undefined);

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 当前选中的消息类型
   * @type {Ref<string>}
   * @description 默认 morning，可在模板选择器中切换
   */
  selectedType: Ref<string> = ref('morning');

  /**
   * 当前选中的模板风格
   * @type {Ref<string>}
   * @description 默认 default，可在模板选择器中切换
   */
  selectedStyle: Ref<string> = ref('default');

  /**
   * 选择器表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 供 auto-form 的 v-model 使用
   */
  selectorValues: Ref<Record<string, unknown>> = ref({ type: 'morning', style: 'default' });

  /**
   * 预览内容
   * @type {Ref<string>}
   * @description 控制右侧预览区域的显示/隐藏
   */
  previewContent: Ref<string> = ref('');

  /**
   * 后端 preview 接口返回的渲染后内容
   * @type {Ref<string>}
   * @description 占位符已替换为真实数据
   */
  previewRenderedContent: Ref<string> = ref('');

  /**
   * 编辑器中的模板内容
   * @type {Ref<string>}
   * @description 用于编辑保存
   */
  editTemplateContent: Ref<string> = ref('');

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 消息类型下拉选项
   * @description 用 contentTypeOptions（只含有正文的类型）：本页是编辑模板正文的，
   *   没有正文的「卡片技能」key 在这里只能是空壳条目。规则表单仍走 store.typeOptions 全量。
   * @type {ComputedRef<Array<{ value: string; label: string }>>}
   */
  typeOptions: ComputedRef<Array<{ value: string; label: string }>> = computed(
    () => this.templatesStore.contentTypeOptions,
  );

  /**
   * 风格下拉选项
   * @type {ComputedRef<Array<{ value: string; label: string }>>}
   */
  styleOptions: ComputedRef<Array<{ value: string; label: string }>> = computed(
    () => this.templatesStore.styleOptions,
  );

  /**
   * 当前选中类型的标签
   * @type {ComputedRef<string>}
   */
  selectedTypeLabel: ComputedRef<string> = computed(
    () => this.templatesStore.typeNameMap[this.selectedType.value] ?? this.selectedType.value,
  );

  /**
   * 当前选中风格的标签
   * @type {ComputedRef<string>}
   */
  selectedStyleLabel: ComputedRef<string> = computed(
    () => this.templatesStore.styleNameMap[this.selectedStyle.value] ?? this.selectedStyle.value,
  );

  /**
   * 预览卡片标题
   * @type {ComputedRef<string>}
   */
  previewCardTitle: ComputedRef<string> = computed(
    () => this.selectedTypeLabel.value || this.localeStore.t.templates.preview,
  );

  /**
   * 将预览内容实时渲染为 HTML（开启 breaks，单个 \n 渲染为 <br>）
   * @type {ComputedRef<string>}
   * @description 优先使用后端 preview 接口返回的渲染结果（占位符已替换为真实数据），
   *              若后端渲染结果为空则 fallback 到编辑器原始内容
   */
  previewContentHtml: ComputedRef<string> = computed(() => {
    const content = this.previewRenderedContent.value || this.editTemplateContent.value;
    if (!content) return '';
    return sanitizeHtml(marked.parse(content, { breaks: true }) as string);
  });

  /**
   * 获取 handler 注册表
   * @description 从全局 store 创建，传入页面专属的变更回调
   */
  private get messageTemplatesHandlers(): HandlerRegistry {
    return this.templatesStore.createHandlers({
      // 本页是编辑模板正文的，只列有正文的类型；规则表单（rules-model）仍取全量
      contentOnly: true,
      onTypeChange: (val: unknown) => {
        this.selectedType.value = val as string;
      },
      onStyleChange: (val: unknown) => {
        this.selectedStyle.value = val as string;
      },
    });
  }

  /**
   * 类型 & 风格选择器的 auto-form 字段配置（从 JSON 加载并增强）
   * @type {ComputedRef<AutoFormField[]>}
   * @description 动态读取 templateTypes / templateStyles 生成 select 选项
   */
  selectorFields: ComputedRef<AutoFormField[]> = computed(() => {
    if (this.rawSelectorFields.value.length === 0) return [];
    return enhanceFields(this.rawSelectorFields.value, this.messageTemplatesHandlers);
  });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 保存编辑器中的模板内容
   * @returns {Promise<void>}
   */
  handleSaveTemplate = async (): Promise<void> => {
    if (!this.editTemplateContent.value.trim()) {
      MessagePlugin.warning(this.localeStore.t.templates.contentEmpty);
      return;
    }
    this.pageLoading.value = true;
    try {
      const result = await this.templateService.saveTemplate(
        this.selectedType.value,
        this.selectedStyle.value,
        this.editTemplateContent.value,
      );
      if (result.code === 0) {
        MessagePlugin.success(this.localeStore.t.common.saveSuccess);
      } else {
        MessagePlugin.error(result.message ?? this.localeStore.t.common.saveFailed);
      }
    } catch (e) {
      MessagePlugin.error(e instanceof Error ? e.message : this.localeStore.t.common.saveFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 设置 FileContent 编辑器组件实例引用
   * @param {unknown} el - Vue :ref 回调传入的元素或组件实例
   * @returns {void}
   */
  setEditorRef = (el: unknown): void => {
    this.editorRef.value = el as FileContentInstance | undefined;
  };

  /**
   * 处理 Markdown 编辑器内容变更
   * @param {string} content - 编辑器最新内容
   * @returns {void}
   * @description 由 file-content 组件的 change 事件触发，更新 editTemplateContent，
   *              同时触发 watch 回调调用后端 preview 接口
   */
  onEditorChange = (content: string): void => {
    this.editTemplateContent.value = content;
  };

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 加载当前选中类型和风格的模板内容，用于解析实际占位符
   * 切换类型/风格时同时清空旧的预览结果和占位符填充值，并将原始模板内容作为默认预览展示
   */
  private loadCurrentTemplate = async (): Promise<void> => {
    // 切换时清空旧状态
    this.previewContent.value = '';
    this.editTemplateContent.value = '';
    this.previewRenderedContent.value = '';

    try {
      const { data: { template } } = await this.templateService.fetchTemplate(
        this.selectedType.value,
        this.selectedStyle.value,
      );
      // 标记本次写入为程序化赋值，watcher 据此跳过重复的防抖预览
      this.lastSyncedTemplate = template;
      this.editTemplateContent.value = template;

      // 主动刷新 CodeMirror 编辑器内容
      // 因为 file-content 不监听 content prop 变化（避免重建丢失光标），需要通过 ref 手动同步
      if (this.editorRef.value && typeof this.editorRef.value.resetEditor === 'function') {
        await this.editorRef.value.resetEditor(template);
      }

      // 调用后端 preview 接口获取渲染后内容（占位符替换为真实数据）
      this.loadPreviewContent();
    } catch {
      // 静默失败，不影响主功能
    }
  };

  /**
   * 调用后端 preview 接口获取渲染后的模板内容
   * @description 后端会自动从每日缓存读取真实数据填充占位符
   * @param customTemplate - 自定义模板内容（可选，不传则使用存储中的模板）
   */
  private loadPreviewContent = async (customTemplate?: string): Promise<void> => {
    try {
      // 图片由后端以 ![](url) 拼进 preview 正文，此处只管正文
      const { data: { preview } } = await this.templateService.previewTemplate(
        this.selectedType.value,
        this.selectedStyle.value,
        customTemplate,
      );
      this.previewRenderedContent.value = preview;
    } catch {
      // 静默失败，fallback 到编辑器原始内容（previewRenderedContent 保持为空）
    }
  };

  /**
   * 预览防抖定时器 ID
   * @type {ReturnType<typeof setTimeout> | null}
   * @description 编辑器内容变化时延迟调用 preview 接口
   */
  private previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 最近一次由「切换类型/风格」程序化写入编辑器的模板内容
   * @type {string}
   * @description 用于让 editTemplateContent 的 watcher 识别“程序化赋值”，跳过由此产生的
   *              重复 preview 请求（切换类型时 loadCurrentTemplate 已直接触发一次预览）
   */
  private lastSyncedTemplate: string = '';

  /**
   * 防抖调用后端 preview 接口
   * @description 编辑器内容变化时，延迟 500ms 再调用后端渲染，避免频繁请求
   */
  debouncePreview = (template: string): void => {
    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
    }
    this.previewDebounceTimer = setTimeout(() => {
      this.loadPreviewContent(template);
    }, 500);
  };

  /**
   * 加载完整模板配置（消息类型、风格均从全局 store 获取）
   * @description 调用 store 的 fetchConfig 加载配置，并校正当前选中类型
   */
  private loadConfig = async (): Promise<void> => {
    try {
      await this.templatesStore.fetchConfig();
      const config = this.templatesStore.config;
      if (!config) return;
      // 用「有正文的类型」校验选中类型是否合法：技能类只有名字、无正文，已从模板页下线
      const names = config.template_names ?? {};
      const bodies = config.templates ?? {};
      const validTypes = Object.keys(names).filter((k) => Boolean(bodies[k]));
      if (validTypes.length > 0 && !names[this.selectedType.value]) {
        this.selectedType.value = validTypes[0];
        // 同步更新 selectorValues
        this.selectorValues.value = { ...this.selectorValues.value, type: validTypes[0] };
      }
    } catch {
      // 静默失败，不影响主功能
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载模板列表与配置，并注册类型/风格/内容变化的响应式监听
   */
  mounted = async (): Promise<void> => {
    this.pageLoading.value = true;

    // 监听类型/风格切换，自动重新加载当前模板内容
    watch(
      [this.selectedType, this.selectedStyle],
      ([type, style]) => {
        this.loadCurrentTemplate();
        // 同步更新 selectorValues，保持 auto-form 显示与实际选中值一致
        this.selectorValues.value = { type, style };
      },
    );

    // 监听编辑器内容变化，同步更新 previewContent 并防抖调用后端 preview 接口
    watch(this.editTemplateContent, (val) => {
      this.previewContent.value = val;
      // 切换类型/风格时程序化写入的模板已由 loadCurrentTemplate 直接触发一次预览，
      // 与 lastSyncedTemplate 相同则跳过，避免同一次切换发出两次 preview 请求
      if (val === this.lastSyncedTemplate) return;
      if (val) {
        this.debouncePreview(val);
      }
    });

    try {
      // 并行加载：模板内容 + 配置 + playground 模板缓存
      await Promise.all([
        this.loadCurrentTemplate(),
        this.loadConfig(),
        this.playgroundStore.fetchTemplates(),
      ]);

      // 从全局 playground store 缓存中取 fields
      const fields = this.playgroundStore.getFieldsById('message-templates-selector');
      if (fields.length > 0) {
        this.rawSelectorFields.value = fields;
      }
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 清理预览防抖定时器，防止内存泄漏
   */
  beforeUnmount = (): void => {
    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
      this.previewDebounceTimer = null;
    }
  };
}

/**
 * Composition API 包装函数
 * @description 将 MessageTemplatesModel 类包装为 Composition API 可用的函数
 */
export const useMessageTemplatesModel = () => {
  const model = new MessageTemplatesModel();

  onMounted(() => { model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {

    ...model,
  };
};
