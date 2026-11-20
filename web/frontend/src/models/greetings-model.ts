import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitize-html';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { GreetingsService } from '@/services/greetings-service';
import type { FileContentInstance } from '@/types/component-instances';
import { usePlaygroundStore } from '@/stores/playground';
import { Permission } from '@/types/permission';
import type { GreetingItem, GreetingsGroup, CreateGreetingPayload, UpdateGreetingPayload, IGreetingFormData } from '@/types/greetings';
import { GreetingFormData } from '@/data/initiate-data';
import type { AutoFormField } from '@/types/auto-form';
import { enhanceFields } from '@/utils/field-enhancer';
import { createGreetingsHandlers } from '@/utils/handler-registry';
import { buildContentPreview, buildMarkdownPreviewHtml, buildMarkdownFullHtml, groupGreetingsByGroup } from '@/utils/greetings';
import { FormMode } from '@/constants/form';
import {
  GREETINGS_GROUPS,
  GREETINGS_BIRTHDAY_GROUP,
  GREETINGS_GROUP_LOCALE_KEYS,
} from '@/constants/greetings';

/**
 * 节日祝福语管理页面数据模型类
 * @description 管理 greetings.json 的扁平化条目增删改查，包括按分组聚合展示、关键词筛选、Markdown 编辑器实时预览等
 */
export class GreetingsModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * 节日祝福语服务实例
   * @type {GreetingsService}
   * @description 用于祝福语条目的增删改查接口调用
   */
  service: GreetingsService = new GreetingsService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 全量条目列表
   * @type {Ref<GreetingItem[]>}
   * @description 后端返回的所有节日祝福语条目
   */
  items: Ref<GreetingItem[]> = ref([]);

  /**
   * 当前筛选分组
   * @type {Ref<GreetingsGroup | ''>}
   * @description 空字符串表示「全部」
   */
  filterGroup: Ref<GreetingsGroup | ''> = ref('');

  /**
   * 内容关键词筛选
   * @type {Ref<string>}
   * @description 用于按 name/content 模糊匹配
   */
  keyword: Ref<string> = ref('');

  /**
   * 祝福语抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制新建/编辑祝福语抽屉的展开
   */
  greetingDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前正在编辑的条目
   * @type {Ref<GreetingItem | null>}
   * @description 为 null 时表示新建态，非 null 时表示编辑态
   */
  editingGreeting: Ref<GreetingItem | null> = ref(null);

  /**
   * 抽屉表单数据
   * @type {Ref<IGreetingFormData>}
   * @description 抽屉内 AutoForm 的 v-model 绑定值；初始值来自 initiate-data 中的 GreetingFormData
   */
  greetingFormData: Ref<IGreetingFormData> = ref({ ...GreetingFormData });

  /**
   * Markdown 编辑器当前内容
   * @type {Ref<string>}
   * @description 与 formData.content 同步，用于实时渲染预览
   */
  editorContent: Ref<string> = ref('');

  /**
   * file-content 组件实例引用
   * @type {Ref<InstanceType<typeof FileContent> | undefined>}
   * @description 用于外部 resetEditor 同步内容
   */
  editorRef: Ref<FileContentInstance | undefined> = ref(undefined);

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 抽屉当前模式
   * @type {ComputedRef<FormMode>}
   */
  greetingFormMode: ComputedRef<FormMode> = computed(
    () => (this.editingGreeting.value ? FormMode.Edit : FormMode.Create),
  );

  /**
   * 按分组聚合的条目桶
   * @type {ComputedRef<Record<GreetingsGroup, GreetingItem[]>>}
   */
  groupedItems: ComputedRef<Record<GreetingsGroup, GreetingItem[]>> = computed(
    () => groupGreetingsByGroup(this.items.value),
  );

  /**
   * 筛选后的条目（用于表格）
   * @type {ComputedRef<GreetingItem[]>}
   */
  filteredItems: ComputedRef<GreetingItem[]> = computed(() => {
    const kw = this.keyword.value.trim().toLowerCase();
    return this.items.value.filter((it) => {
      if (this.filterGroup.value && it.group !== this.filterGroup.value) return false;
      if (!kw) return true;
      return (
        it.name.toLowerCase().includes(kw) ||
        it.content.toLowerCase().includes(kw)
      );
    });
  });

  /**
   * 按分组聚合筛选后的条目（用于页面分组展示）
   * @type {ComputedRef<Array<{ group: GreetingsGroup; label: string; items: GreetingItem[] }>>}
   */
  filteredGroups: ComputedRef<Array<{ group: GreetingsGroup; label: string; items: GreetingItem[] }>> = computed(() => {
    const list = this.filteredItems.value;
    const buckets = new Map<GreetingsGroup, GreetingItem[]>();
    for (const g of GREETINGS_GROUPS) buckets.set(g, []);
    for (const it of list) buckets.get(it.group)?.push(it);
    const result: Array<{ group: GreetingsGroup; label: string; items: GreetingItem[] }> = [];
    for (const g of GREETINGS_GROUPS) {
      const items = buckets.get(g) ?? [];
      if (items.length === 0) continue;
      result.push({ group: g, label: this.getGroupLabel(g), items });
    }
    return result;
  });

  /**
   * 分组筛选下拉选项
   * @type {ComputedRef<Array<{ label: string; value: GreetingsGroup | '' }>>}
   */
  groupOptions: ComputedRef<Array<{ label: string; value: GreetingsGroup | '' }>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { label: t.greetings.filterAll, value: '' },
      ...GREETINGS_GROUPS.map((g) => ({ label: this.getGroupLabel(g), value: g })),
    ];
  });

  /**
   * 表格列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   */
  columns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { colKey: 'group', title: t.greetings.colGroup, width: 180 },
      { colKey: 'name', title: t.greetings.colName, width: 160 },
      { colKey: 'preview', title: t.greetings.colPreview, ellipsis: true },
      { colKey: 'actions', title: t.greetings.colActions, width: 120, fixed: 'right' },
    ];
  });

  /**
   * 表单字段配置
   * @type {ComputedRef<AutoFormField[]>}
   */
  greetingFormFields: ComputedRef<AutoFormField[]> = computed(() => {
    const rawFields = usePlaygroundStore().getFieldsById('greeting-form');
    return enhanceFields(rawFields, createGreetingsHandlers()) as AutoFormField[];
  });

  /**
   * 编辑器内容的实时 HTML 渲染
   * @type {ComputedRef<string>}
   */
  editorContentHtml: ComputedRef<string> = computed(() => {
    const content = this.editorContent.value;
    if (!content) return '';
    return sanitizeHtml(marked.parse(content, { breaks: true }) as string);
  });

  // ==============================
  // 工具方法
  // ==============================

  /**
   * 根据分组 key 获取展示名称
   * @param {GreetingsGroup} group - 分组 key
   * @returns {string} 分组对应的国际化展示名称
   * @description 通过 GREETINGS_GROUP_LOCALE_KEYS 查表取 i18n key，再到 t.greetings 取值，
   *              避免在 Model 里硬编码分组→文案映射。
   */
  getGroupLabel = (group: GreetingsGroup): string => {
    const localeKey = GREETINGS_GROUP_LOCALE_KEYS[group];
    const dict = this.localeStore.t.greetings as unknown as Record<string, string>;
    return dict[localeKey] ?? group;
  };

  /**
   * 构造表格预览行的纯文本
   * @param {GreetingItem} row - 当前行条目
   * @returns {string} 截断后的纯文本预览（用作 title 悬浮提示）
   */
  getRowPreview = (row: GreetingItem): string => buildContentPreview(row.content, 60);

  /**
   * 构造表格预览行的 HTML
   * @param {GreetingItem} row - 当前行条目
   * @returns {string} 首行 Markdown 渲染后的 HTML 字符串
   */
  getRowPreviewHtml = (row: GreetingItem): string => buildMarkdownPreviewHtml(row.content, 60);

  /**
   * 构造完整 Markdown HTML
   * @param {GreetingItem} row - 当前行条目
   * @returns {string} 完整内容渲染后的 HTML 字符串（用于 tooltip 悬浮展示全部）
   */
  getRowFullHtml = (row: GreetingItem): string => buildMarkdownFullHtml(row.content);

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载祝福语列表
   * @param {boolean} [silent=false] - 静默加载（不显示 loading）
   * @returns {Promise<void>}
   * @description 从服务端获取最新条目并刷新 items 状态
   */
  loadItems = async (silent: boolean = false): Promise<void> => {
    if (!silent) this.pageLoading.value = true;
    try {
      const res = await this.service.fetchGreetings();
      this.items.value = res.data.items;
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 打开新建抽屉
   * @returns {void}
   * @description 重置表单为初始空值并展开抽屉
   */
  openCreate = (): void => {
    this.editingGreeting.value = null;
    this.greetingFormData.value = { ...GreetingFormData };
    this.syncEditorContent('');
    this.greetingDrawerVisible.value = true;
  };

  /**
   * 打开编辑抽屉
   * @param {GreetingItem} item - 要编辑的条目
   * @returns {void}
   * @description 将条目数据回填到表单并同步编辑器内容
   */
  openEdit = (item: GreetingItem): void => {
    this.editingGreeting.value = item;
    this.greetingFormData.value = { group: item.group, name: item.name, content: item.content };
    this.syncEditorContent(item.content);
    this.greetingDrawerVisible.value = true;
  };

  /**
   * 关闭抽屉
   * @returns {void}
   * @description 收起抽屉并清空表单状态
   */
  closeDrawer = (): void => {
    this.greetingDrawerVisible.value = false;
    this.editingGreeting.value = null;
    this.greetingFormData.value = { ...GreetingFormData };
    this.editorContent.value = '';
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
   * @description 同步更新 editorContent 与 formData.content
   */
  onEditorChange = (content: string): void => {
    this.editorContent.value = content;
    this.greetingFormData.value = { ...this.greetingFormData.value, content };
  };

  /**
   * 提交表单
   * @param {Partial<GreetingItem>} form - 表单数据
   * @returns {Promise<void>}
   * @description 校验通过后调用新增/更新接口，并刷新列表
   */
  submitForm = async (form: Partial<GreetingItem>): Promise<void> => {
    const { t } = this.localeStore;
    const group = form.group as GreetingsGroup | undefined;
    const name = (form.name ?? '').trim();
    // 内容以 Markdown 编辑器实时内容为准
    const content = this.editorContent.value.trim();
    if (!group) {
      MessagePlugin.warning(t.greetings.validateGroupRequired);
      return;
    }
    if (!content) {
      MessagePlugin.warning(t.greetings.validateContentRequired);
      return;
    }
    if (group !== GREETINGS_BIRTHDAY_GROUP && !name) {
      MessagePlugin.warning(t.greetings.validateNameRequired);
      return;
    }
    this.pageLoading.value = true;
    try {
      if (this.editingGreeting.value) {
        const payload: UpdateGreetingPayload = { group, name, content };
        await this.service.updateGreeting(this.editingGreeting.value.id, payload);
        MessagePlugin.success(t.common.updateSuccess);
      } else {
        const payload: CreateGreetingPayload = { group, name, content };
        await this.service.createGreeting(payload);
        MessagePlugin.success(t.common.createSuccess);
      }
      this.closeDrawer();
      await this.loadItems(true);
    } catch {
      MessagePlugin.error(t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 删除条目
   * @param {string} id - 条目 ID
   * @returns {Promise<void>}
   * @description 调用服务端删除接口并刷新列表
   */
  removeItem = async (id: string): Promise<void> => {
    const { t } = this.localeStore;
    try {
      await this.service.deleteGreeting(id);
      MessagePlugin.success(t.common.deleteSuccess);
      await this.loadItems(true);
    } catch {
      MessagePlugin.error(t.common.deleteFailedRetry);
    }
  };

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 将外部内容同步到编辑器
   * @param {string} content - 需要同步的文本内容
   * @returns {void}
   * @description 主动调用 file-content 的 resetEditor 刷新编辑器显示
   */
  private syncEditorContent = (content: string): void => {
    this.editorContent.value = content;
    // 等待抽屉渲染后再 reset（编辑器初始化后才能调用）
    void Promise.resolve().then(async () => {
      await Promise.resolve();
      if (this.editorRef.value && typeof this.editorRef.value.resetEditor === 'function') {
        await this.editorRef.value.resetEditor(content);
      }
    });
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动窗口 resize 监听，并加载模板与问候语列表
   */
  mounted = (): void => {
    this.startResizeListener();
    void usePlaygroundStore().fetchTemplates();
    void this.loadItems();
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 移除窗口 resize 监听，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.stopResizeListener();
  };
}

/**
 * Composition API 包装函数
 * @description 将 GreetingsModel 类包装为 Composition API 可用的函数
 */
export const useGreetingsModel = () => {
  const model = new GreetingsModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => model.mounted());

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => model.beforeUnmount());

  return {

    formLabelWidth: computed(() => model.localeStore.formLabelWidth),
    ...model,
    // 权限
    Permission,
  };
};
