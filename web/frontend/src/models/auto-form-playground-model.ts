import { ref, computed, onMounted, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { TemplateItem } from '@/types/playground';
import { PlaygroundService } from '@/services/playground-service';
import { RbacService } from '@/services/rbac-service';
import { ApiManagementService } from '@/services/api-management-service';
import { useTemplatesStore } from '@/stores/templates';
import { usePlaygroundStore } from '@/stores/playground';
import type { AutoFormField } from '@/types/auto-form';
import type { PermissionMeta, RoleConfig } from '@/types/rbac';
import type { ApiCategory } from '@/types/api-management';
import { enhanceFields } from '@/utils/field-enhancer';
import { PermissionSelection } from '@/utils/rbac';
import { writeClipboard } from '@/utils/clipboard';
import {
  createRuleHandlers,
  createConfigHandlers,
  createRbacHandlers,
  createApiManagementHandlers,
  createGreetingsHandlers,
  createReminderQuotesHandlers,
  mergeHandlerRegistries,
} from '@/utils/handler-registry';
import { BaseModel } from '@/models/base-model';

import type { AutoFormInstance, FileContentInstance } from '@/types/component-instances';

/**
 * 表单配置器页面数据模型类
 * @description 管理表单配置器页面的所有业务逻辑，包括 JSON 编辑、实时解析、
 *              表单预览、示例模板切换、表单外观配置及提交结果展示
 */
export class AutoFormPlaygroundModel extends BaseModel {
  // ==============================
  // 状态变量
  // ==============================

  /**
   * AutoForm 组件实例引用
   * @type {Ref<InstanceType<typeof AutoForm> | undefined>}
   * @description 用于调用 validate() 方法触发表单验证
   */
  autoFormRef: Ref<AutoFormInstance | undefined> = ref(undefined);

  /**
   * FileContent 组件实例引用
   * @type {Ref<InstanceType<typeof FileContent> | undefined>}
   * @description 用于调用 resetEditor() 方法同步更新编辑器内容
   */
  fileContentRef: Ref<FileContentInstance | undefined> = ref(undefined);

  /**
   * JSON 编辑器初始/外部同步内容
   * @type {Ref<string>}
   * @description 仅用于外部向编辑器写入内容（切换模板、格式化），不在 onEditorChange 中更新，
   *              避免 prop 回写触发编辑器重建导致焦点丢失
   */
  jsonText: Ref<string> = ref('[]');

  /**
   * 编辑器当前内容（实时跟踪）
   * @type {string}
   * @description 由 onEditorChange 实时更新，用于格式化、保存、复制等操作读取最新内容，
   *              不作为 prop 传入组件，因此不会触发编辑器重建
   */
  currentEditorText: string = '[]';

  /**
   * JSON 解析错误信息
   * @type {Ref<string>}
   * @description 为空字符串时表示 JSON 合法，否则为具体的错误描述
   */
  jsonError: Ref<string> = ref('');

  /**
   * 解析后的字段配置
   * @type {Ref<AutoFormField[]>}
   * @description JSON 合法时存储解析结果，非法时为空数组
   */
  parsedFields: Ref<AutoFormField[]> = ref<AutoFormField[]>([]);

  /**
   * 表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 预览区域表单的 v-model 绑定值，实时反映用户填写内容
   */
  formData: Ref<Record<string, unknown>> = ref({});

  /**
   * 当前选中的示例模板索引
   * @type {Ref<number>}
   * @description 对应 templates 数组的下标，用于高亮当前激活的模板标签
   */
  activeTemplateIndex: Ref<number> = ref(0);

  /**
   * 响应式模板列表
   * @type {Ref<TemplateItem[]>}
   * @description 从接口加载，支持新增/删除操作
   */
  templates: Ref<TemplateItem[]> = ref<TemplateItem[]>([]);

  /**
   * 是否显示提交结果弹窗
   * @type {Ref<boolean>}
   * @description 点击「提交查看数据」后置为 true，弹窗关闭后自动置为 false
   */
  showResultDialog: Ref<boolean> = ref(false);

  /**
   * 提交结果数据快照
   * @type {Ref<Record<string, unknown>>}
   * @description 点击提交时对 formData 的浅拷贝，用于在弹窗中展示
   */
  submitResult: Ref<Record<string, unknown>> = ref({});

  /**
   * 表单标签对齐方式
   * @type {Ref<'left' | 'right' | 'top'>}
   * @description 透传给 AutoForm 的 labelAlign 属性，默认左对齐
   */
  labelAlign: Ref<'left' | 'right' | 'top'> = ref('left');

  /**
   * 表单控件尺寸
   * @type {Ref<'small' | 'medium' | 'large'>}
   * @description 透传给 AutoForm 的 size 属性，默认中等尺寸
   */
  formSize: Ref<'small' | 'medium' | 'large'> = ref('large');

  /**
   * 是否显示标签冒号
   * @type {Ref<boolean>}
   * @description 透传给 AutoForm 的 colon 属性，默认显示
   */
  showColon: Ref<boolean> = ref(false);

  /**
   * 是否显示必填标记
   * @type {Ref<boolean | undefined>}
   * @description 透传给 AutoForm 的 requiredMark 属性，默认undefined
   */
  requiredMark: Ref<boolean | undefined> = ref(undefined);

  // ==============================
  // 服务依赖
  // ==============================

  /**
   * Playground 服务实例
   * @type {PlaygroundService}
   * @description 用于保存/加载模板
   */
  private playgroundService: PlaygroundService = new PlaygroundService();

  /**
   * RBAC 服务实例（用于加载权限和角色数据供模板预览）
   * @type {RbacService}
   * @description 用于加载权限和角色数据供模板预览
   */
  private rbacService: RbacService = new RbacService();

  /**
   * API 管理服务实例（用于加载分类列表，供 api-item-form 模板预览）
   * @type {ApiManagementService}
   * @description 用于加载分类列表，供 api-item-form 模板预览
   */
  private apiManagementService: ApiManagementService = new ApiManagementService();

  /**
   * Playground 模板全局 Store（增删改后同步缓存，供其他页面共享）
   * @type {ReturnType<typeof usePlaygroundStore>}
   * @description 增删改后同步缓存，供其他页面共享
   */
  private playgroundStore: ReturnType<typeof usePlaygroundStore> = usePlaygroundStore();

  /**
   * 模板全局 Store（增删改后同步缓存，供其他页面共享）
   * @type {ReturnType<typeof useTemplatesStore>}
   * @description 增删改后同步缓存，供其他页面共享
   */
  private templatesStore: ReturnType<typeof useTemplatesStore> = useTemplatesStore();

  /**
   * RBAC 权限元信息缓存（供 rbac.permissionOptions handler 读取）
   * @type {Ref<PermissionMeta[]>}
   * @description 供 rbac.permissionOptions handler 读取
   */
  private permissionMetas: Ref<PermissionMeta[]> = ref([]);

  /**
   * RBAC 角色列表缓存（供 rbac.roleOptions handler 读取）
   * @type {Ref<RoleConfig[]>}
   * @description 供 rbac.roleOptions handler 读取
   */
  private roles: Ref<RoleConfig[]> = ref([]);

  /**
   * API 分类列表缓存（供 apiManagement.categoryOptions handler 读取）
   * @type {Ref<ApiCategory[]>}
   * @description 供 apiManagement.categoryOptions handler 读取
   */
  private apiCategories: Ref<ApiCategory[]> = ref([]);

  /**
   * 合并的 handler 注册表
   * @description 包含所有业务模块的 handler，使 playground 渲染模板时能正确解析 $handler:xxx 标记
   */
  private allHandlers: ComputedRef<ReturnType<typeof mergeHandlerRegistries>> = computed(() => mergeHandlerRegistries(
    createRuleHandlers(),
    createConfigHandlers(),
    createRbacHandlers({
      getPermissionMetas: () => this.permissionMetas.value,
      getRoles: () => this.roles.value,
    }),
    createApiManagementHandlers({
      getCategoryOptions: () =>
        this.apiCategories.value.map((c) => ({ label: c.name, value: c.category_key })),
    }),
    createGreetingsHandlers(),
    createReminderQuotesHandlers(),
    this.templatesStore.createHandlers(),
  ));

  // ==============================
  // 权限选择工具（供 #content-permissions 插槽使用）
  // ==============================

  /**
   * 权限选择工具实例（委托给 PermissionSelection 统一处理权限分组、全选、切换逻辑）
   * @description 通过注入数据源实现复用，避免与 RbacModel 重复编写相同的权限操作代码
   */
  permissionSelection = new PermissionSelection({
    getPermissionMetas: () => this.permissionMetas.value,
    getSelectedPermissions: () => (this.formData.value.permissions ?? []) as string[],
    setSelectedPermissions: (permissions) => {
      this.formData.value = { ...this.formData.value, permissions };
    },
  });

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 获取 JSON 是否合法
   * @type {ComputedRef<boolean>}
   */
  isJsonValid: ComputedRef<boolean> = computed(() => this.jsonError.value === '');

  /**
   * 获取格式化后的提交结果字符串
   * @type {ComputedRef<string>}
   */
  formattedResult: ComputedRef<string> = computed(
    () => JSON.stringify(this.submitResult.value, null, 2),
  );

  /**
   * 获取格式化后的实时表单数据字符串
   * @type {ComputedRef<string>}
   */
  formattedFormData: ComputedRef<string> = computed(
    () => JSON.stringify(this.formData.value, null, 2),
  );

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 设置 AutoForm 组件实例引用
   * @param {unknown} el - Vue :ref 回调传入的元素或组件实例
   * @returns {void}
   */
  setAutoFormRef = (el: unknown): void => {
    this.autoFormRef.value = el as AutoFormInstance | undefined;
  };

  /**
   * 设置 FileContent 组件实例引用
   * @param {unknown} el - Vue :ref 回调传入的元素或组件实例
   * @returns {void}
   */
  setFileContentRef = (el: unknown): void => {
    this.fileContentRef.value = el as FileContentInstance | undefined;
  };

  /**
   * 处理编辑器内容变更
   * @param {string} content - 编辑器最新内容
   * @param {boolean} hasError - 是否有 JSON 格式错误
   * @returns {void}
   * @description 由 file-content 组件的 change 事件触发，只更新内部跟踪变量和解析结果，
   *              不更新 jsonText（避免 prop 回写触发编辑器重建导致焦点丢失）
   */
  onEditorChange = (content: string, hasError: boolean): void => {
    // 只更新内部跟踪变量，不写回 jsonText prop
    this.currentEditorText = content;
    if (hasError) {
      this.jsonError.value = this.localeStore.t.playground.invalidJsonFormat;
      this.parsedFields.value = [];
      return;
    }
    this.parseJson(content);
  };
  /**
   * 解析 JSON 编辑器内容，更新 parsedFields 和 jsonError
   * @param {string} [text] - 要解析的文本，默认使用 currentEditorText
   * @returns {void}
   * @description 仅做业务校验（顶层必须是数组），JSON 格式合法性由编辑器自带校验保证。
   *              解析后通过 enhanceFields 将 $handler:xxx 标记替换为真实的函数/数据，
   *              使业务模板（规则表单、配置表单等）在 playground 中也能正确渲染。
   */
  parseJson = (text?: string): void => {
    const result = JSON.parse(text ?? this.currentEditorText);
    if (!Array.isArray(result)) {
      this.jsonError.value = this.localeStore.t.playground.rootMustBeArray;
      this.parsedFields.value = [];
      return;
    }
    // 通过 enhanceFields 将 $handler:xxx 标记替换为注册表中的真实值
    this.parsedFields.value = enhanceFields(result, this.allHandlers.value);
    this.jsonError.value = '';
  };

  /**
   * 切换示例模板
   * @param {number} index - 模板在 templates 中的索引
   * @returns {void}
   * @description 切换后同步更新 JSON 编辑器内容、重新解析字段并清空表单数据
   */
  applyTemplate = (index: number): void => {
    this.activeTemplateIndex.value = index;
    const text = JSON.stringify(this.templates.value[index].fields, null, 2);
    // 外部同步内容：同时更新 jsonText prop 和内部跟踪变量
    this.jsonText.value = text;
    this.currentEditorText = text;
    this.formData.value = {};
    this.parseJson(text);
    this.fileContentRef.value?.resetEditor(text);
  };

  /**
   * 格式化 JSON 编辑器内容
   * @returns {void}
   * @description 对当前 JSON 文本进行美化缩进，解析失败时更新错误信息
   */
  formatJson = (): void => {
    try {
      const parsed = JSON.parse(this.currentEditorText);
      const text = JSON.stringify(parsed, null, 2);
      // 外部同步内容：同时更新 jsonText prop 和内部跟踪变量
      this.jsonText.value = text;
      this.currentEditorText = text;
      this.jsonError.value = '';
      this.fileContentRef.value?.resetEditor(text);
    } catch (e) {
      this.jsonError.value = (e as Error).message;
    }
  };

  /**
   * 重置表单数据
   * @returns {void}
   * @description 清空预览区域所有表单字段的填写内容
   */
  resetForm = (): void => {
    this.formData.value = {};
  };

  /**
   * 提交表单并展示结果弹窗（提交前先触发验证）
   * @returns {Promise<void>}
   * @description 验证通过后对 formData 做浅拷贝快照，并打开结果弹窗
   */
  submitForm = async (): Promise<void> => {
    const result = await this.autoFormRef.value?.validate();
    // validate 返回 true 表示通过，返回对象表示有错误
    if (result !== true) {
      MessagePlugin.warning(this.localeStore.t.playground.checkFormInput);
      return;
    }
    this.submitResult.value = { ...this.formData.value };
    this.showResultDialog.value = true;
  };

  /**
   * 是否正在新增模板（控制内联输入框显隐）
   * @type {Ref<boolean>}
   */
  isAddingTemplate: Ref<boolean> = ref(false);

  /**
   * 新增模板名称输入值
   * @type {Ref<string>}
   */
  newTemplateName: Ref<string> = ref('');

  /**
   * 开始新增模板（显示内联输入框）
   * @returns {void}
   * @description 预填默认名称并展示输入框
   */
  startAddTemplate = (): void => {
    this.newTemplateName.value = this.localeStore.t.playground.defaultTemplateName(this.templates.value.length + 1);
    this.isAddingTemplate.value = true;
  };

  /**
   * 取消新增模板
   * @returns {void}
   */
  cancelAddTemplate = (): void => {
    this.isAddingTemplate.value = false;
    this.newTemplateName.value = '';
  };

  /**
   * 确认新增模板
   * @returns {Promise<void>}
   * @description 使用用户输入的名称在模板列表末尾新增一个空模板，并保存整个模板列表到源文件
   */
  addTemplate = async (): Promise<void> => {
    const label = this.newTemplateName.value.trim() || this.localeStore.t.playground.defaultTemplateName(this.templates.value.length + 1);
    this.isAddingTemplate.value = false;
    this.newTemplateName.value = '';

    const newTemplate = { label, fields: [] as unknown[] };
    this.pageLoading.value = true;
    try {
      const result = await this.playgroundService.addTemplate(newTemplate);
      if (result.code === 0) {
        // 保存成功后用后端返回的 id 更新内存中的模板列表
        const id = result.data.id ?? label;
        this.templates.value = [...this.templates.value, { id, ...newTemplate }];
        // 同步更新全局 playground store 缓存，供其他页面读取最新数据
        this.playgroundStore.setTemplates(this.templates.value);
        const newIndex = this.templates.value.length - 1;
        MessagePlugin.success(this.localeStore.t.playground.savedToTemplateSource);
        this.applyTemplate(newIndex);
      } else {
        MessagePlugin.error(result.message ?? this.localeStore.t.common.saveFailed);
      }
    } catch (err) {
      MessagePlugin.error((err as Error).message ?? this.localeStore.t.common.saveFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 删除指定模板
   * @param {number} index - 要删除的模板索引
   * @returns {Promise<void>}
   * @description 从模板列表中移除指定模板，并保存整个模板列表到源文件
   */
  deleteTemplate = async (index: number): Promise<void> => {
    if (this.templates.value.length <= 1) {
      MessagePlugin.warning(this.localeStore.t.playground.keepAtLeastOneTemplate);
      return;
    }
    const target = this.templates.value[index];
    if (!target) return;
    // 有 category 的业务模板不允许删除
    if (target.category) {
      MessagePlugin.warning(this.localeStore.t.playground.builtinBusinessNotDeletable);
      return;
    } 
    try {
      const result = await this.playgroundService.deleteTemplate(target.id);
      if (result.code === 0) {
        this.templates.value = this.templates.value.filter((t) => t.id !== target.id);
        // 同步更新全局 playground store 缓存，供其他页面读取最新数据
        this.playgroundStore.setTemplates(this.templates.value);
        // 删除后取相邻下标：优先保持同位置（后一个顶上来），越界时取最后一个
        const nextIndex = Math.min(index, this.templates.value.length - 1);
        MessagePlugin.success(this.localeStore.t.playground.savedToTemplateSource);
        this.applyTemplate(nextIndex);
      } else {
        MessagePlugin.error(result.message ?? this.localeStore.t.common.deleteFailed);
      }
    } catch (err) {
      MessagePlugin.error((err as Error).message ?? this.localeStore.t.common.deleteFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 保存当前模板 fields 到源文件
   * @returns {Promise<void>}
   * @description 将编辑器中当前 JSON 内容写回 auto-form-playground.ts 对应模板的 fields
   */
  saveTemplate = async (): Promise<void> => {
    if (!this.isJsonValid.value) {
      MessagePlugin.warning(this.localeStore.t.playground.fixJsonBeforeSave);
      return;
    }
    this.pageLoading.value = true;
    try {
      const activeTemplate = this.templates.value[this.activeTemplateIndex.value];
      if (!activeTemplate) {
        MessagePlugin.error(this.localeStore.t.playground.currentTemplateNotFound);
        return;
      }
      const result = await this.playgroundService.saveTemplateFields(
        activeTemplate.id,
        this.currentEditorText,
      );
      if (result.code === 0) {
        try {
          const updatedFields = JSON.parse(this.currentEditorText) as unknown[];
          this.playgroundStore.updateFieldsById(activeTemplate.id, updatedFields);
        } catch {
          // JSON 解析失败时不阻塞保存成功提示
        }
        MessagePlugin.success(this.localeStore.t.playground.savedToTemplateSource);
      } else {
        MessagePlugin.error(result.message ?? this.localeStore.t.common.saveFailed);
      }
    } catch (err) {
      MessagePlugin.error((err as Error).message ?? this.localeStore.t.common.saveFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 复制 JSON 配置到剪贴板
   * @returns {Promise<void>}
   * @description 调用 utils/clipboard/writeClipboard（带 execCommand fallback），
   *              并通过 MessagePlugin 提示成功 / 失败结果
   */
  copyJson = async (): Promise<void> => {
    const text = this.currentEditorText;
    const ok = await writeClipboard(text);
    if (ok) {
      MessagePlugin.success(this.localeStore.t.playground.copiedToClipboard);
    } else {
      MessagePlugin.error(this.localeStore.t.playground.copyFailedManual);
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 从接口加载模板列表，初始化编辑器内容
   */
  mounted = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      // 并行加载：playground 模板列表 + 消息模板配置 + RBAC 角色与权限数据 + API 分类列表
      const [result, , rbacData, apiCategoriesRes] = await Promise.all([
        this.playgroundService.getTemplates(),
        this.templatesStore.fetchConfig(),
        this.rbacService.fetchRoles().catch(() => null),
        this.apiManagementService.fetchCategories().catch(() => null),
      ]);

      // 缓存 RBAC 数据供 allHandlers 使用
      if (rbacData) {
        const { data: { permissionMetas, roles } } = rbacData;
        this.permissionMetas.value = permissionMetas ?? [];
        this.roles.value = roles ?? [];
      }

      // 缓存 API 分类数据供 apiManagement.categoryOptions handler 使用
      if (apiCategoriesRes && apiCategoriesRes.code === 0) {
        this.apiCategories.value = apiCategoriesRes.data?.categories ?? [];
      }

      const { code, data: { data: templates }, message } = result;
      if (code === 0 && templates && templates.length > 0) {
        this.templates.value = templates;
        // 同步到全局 playground store，供其他页面复用缓存
        this.playgroundStore.setTemplates(templates);
        this.applyTemplate(0);
      } else {
        MessagePlugin.error(message ?? this.localeStore.t.playground.loadTemplateListFailed);
      }
    } catch (err) {
      MessagePlugin.error((err as Error).message ?? this.localeStore.t.playground.loadTemplateListFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };
}

// ==============================
// Composition API 包装函数
// ==============================

/**
 * Composition API 包装函数
 * @description 将 AutoFormPlaygroundModel 类包装为 Composition API 可用的函数，
 *              供 auto-form-playground.vue 页面调用
 */
export const useAutoFormPlaygroundModel = () => {
  const model = new AutoFormPlaygroundModel();

  // 挂载时加载数据
  onMounted(async () => { await model.mounted(); });

  return {

    ...model,
  };
};
