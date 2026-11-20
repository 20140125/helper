import { ref, computed, onMounted, onBeforeUnmount, watch, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { ApiManagementService } from '@/services/api-management-service';
import { usePlaygroundStore } from '@/stores/playground';
import { Permission } from '@/types/permission';
import type { ApiCategory, ApiItem, ApiExecuteResult, HeaderEntry, IApiItemFormData } from '@/types/api-management';
import { ApiItemFormData } from '@/data/initiate-data';
import type { AutoFormField } from '@/types/auto-form';
import { enhanceFields } from '@/utils/field-enhancer';
import { createApiManagementHandlers } from '@/utils/handler-registry';
import { FormMode } from '@/constants/form';
import {
  normalizeExecuteUrl,
  pickEnabledEntries,
  buildDefaultHeaders,
  formatJson,
  pickResponseFilename,
  groupItemsByCategory,
  buildItemKey,
} from '@/utils/api-management';

/**
 * API 管理页面 Model
 * @description 管理 API 条目的增删改查及执行业务逻辑
 */
export class ApiManagementModel extends BaseModel {
  // ==============================
  // 依赖注入
  // ==============================

  /**
   * API 管理服务实例
   * @type {ApiManagementService}
   * @description 用于 API 条目的增删改查及执行接口调用
   */
  service: ApiManagementService = new ApiManagementService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 接口分类列表
   * @type {Ref<ApiCategory[]>}
   * @description 用于分类下拉选择与 API 条目表单选项
   */
  categories: Ref<ApiCategory[]> = ref([]);

  /**
   * API 条目列表
   * @type {Ref<ApiItem[]>}
   * @description 全量 API 条目数据，表格与执行面板依据此渲染
   */
  items: Ref<ApiItem[]> = ref([]);

  /**
   * API 条目加载状态
   * @type {Ref<boolean>}
   * @description true 表示表格正在加载中
   */
  itemsLoading: Ref<boolean> = ref(false);

  /**
   * 当前选中的分类 ID
   * @type {Ref<string>}
   * @description 用于过滤 API 条目表格，空字符串表示不过滤
   */
  selectedCategoryId: Ref<string> = ref('');

  // ── API 条目抽屉 ──

  /**
   * API 条目抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制条目抽屉的展开
   */
  itemDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 正在编辑的 API 条目
   * @type {Ref<ApiItem | null>}
   * @description null 表示创建新条目
   */
  editingItem: Ref<ApiItem | null> = ref(null);

  /**
   * API 条目表单数据
   * @type {Ref<IApiItemFormData>}
   * @description 用于 API 条目表单的双向绑定；初始值来自 initiate-data 中的 ApiItemFormData
   */
  itemFormData: Ref<IApiItemFormData> = ref({ ...ApiItemFormData });

  /**
   * 最近一次由 method+path 自动派生出的 item_key
   * @description 用于「粘性自动填充」：当用户未手动修改过 item_key（即 itemFormData.item_key 等于
   *              lastAutoItemKey 或为空）时，method/path 变化会继续自动覆盖 item_key；一旦用户手动改过，
   *              自动填充将不再覆盖用户输入。
   */
  lastAutoItemKey: Ref<string> = ref('');

  // ── API 条目执行面板 ──
  /**
   * 当前正在执行的 API 条目
   * @type {Ref<ApiItem | null>}
   * @description null 表示未选中任何条目
   */
  executingItem: Ref<ApiItem | null> = ref(null);

  /**
   * 执行面板显隐状态
   * @type {Ref<boolean>}
   * @description 控制执行抽屉的展开
   */
  executeDrawerVisible: Ref<boolean> = ref(false);

  /**
   * API 执行中状态
   * @type {Ref<boolean>}
   * @description true 表示执行接口调用中
   */
  executing: Ref<boolean> = ref(false);

  /**
   * 执行 URL
   * @type {Ref<string>}
   * @description 可覆盖条目原始 path，供用户临时修改调用地址
   */
  executeUrl: Ref<string> = ref('');
  /**
   * 执行请求体（编辑器实时值）
   * @description 仅在编辑器 change 回调中写入；不参与 <file-content :content> 绑定，
   *              以避免每次输入都触发编辑器 watch 导致重建（光标回跳/卡壳）
   */
  executeBody: Ref<string> = ref('');
  /**
   * 执行请求体的初始/重置值
   * @description 作为 <file-content :content> 的绑定值；
 *              仅在「打开执行抽屉 / 清空 / 切换 API」时主动赋值，
   *              不会在用户输入过程中变化，从而避免编辑器被反复重建。
   */
  executeBodyInitial: Ref<string> = ref('');
  /**
   * 请求头列表
   * @type {Ref<HeaderEntry[]>}
   * @description 执行 API 时使用的请求头可选项集合
   */
  executeHeaders: Ref<HeaderEntry[]> = ref([]);

  /**
   * Query 参数列表
   * @type {Ref<HeaderEntry[]>}
   * @description 执行 API 时拼接到 URL 上的 query 项
   */
  executeParams: Ref<HeaderEntry[]> = ref([]);

  /**
   * 执行结果
   * @type {Ref<ApiExecuteResult | null>}
   * @description null 表示未执行或仅有错误信息
   */
  executeResult: Ref<ApiExecuteResult | null> = ref(null);

  /**
   * 执行错误信息
   * @type {Ref<string>}
   * @description 网络/业务错误提示文案，空字符串表示无错误
   */
  executeError: Ref<string> = ref('');

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 过滤后的 API 条目
   * @type {ComputedRef<ApiItem[]>}
   * @description 根据当前分类过滤后的条目列表
   */
  filteredItems: ComputedRef<ApiItem[]> = computed(() => {
    if (!this.selectedCategoryId.value) return this.items.value;
    return this.items.value.filter((item) => item.category_id === this.selectedCategoryId.value);
  });

  /**
   * 分类选项
   * @type {ComputedRef<Array<{ label: string; value: string }>>}
   * @description 用于 API 条目表单下拉选择的选项
   */
  categoryOptions: ComputedRef<Array<{ label: string; value: string }>> = computed(
    () => this.categories.value.map((c) => ({ label: c.name, value: c.category_key })),
  );

  /**
   * 分类 ID → 名称映射
   * @type {ComputedRef<Record<string, string>>}
   * @description category_key 为 key，分类名称为 value
   */
  categoryNameMap: ComputedRef<Record<string, string>> = computed(
    () => Object.fromEntries(this.categories.value.map((c) => [c.category_key, c.name])),
  );

  /**
   * 格式化 JSON 响应体
   * @type {ComputedRef<string>}
   * @description 美化后的 JSON 字符串，用于右侧面板展示
   */
  formattedResponseBody: ComputedRef<string> = computed(
    () => formatJson(this.executeResult.value?.body ?? ''),
  );

  /**
   * 响应体在 file-content 中的展示文件名
   * @type {ComputedRef<string>}
   * @description 按 content-type 动态决定后缀的虚拟文件名
   */
  responseFilename: ComputedRef<string> = computed(
    () => pickResponseFilename(this.executeResult.value),
  );

  /**
   * 响应状态是否成功
   * @type {ComputedRef<boolean>}
   * @description HTTP 状态码在 200~299 范围内为 true
   */
  isResponseSuccess: ComputedRef<boolean> = computed(() => {
    const status = this.executeResult.value?.status ?? 0;
    return status >= 200 && status < 300;
  });

  /**
   * API 条目表格列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 跟随 i18n 动态生成的列配置数组
   */
  apiColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { colKey: 'item_key', title: t.apiManagement.colItemKey, width: 240, fixed: 'left' },
      { colKey: 'name', title: t.apiManagement.colName, width: 180 },
      { colKey: 'method', title: t.apiManagement.colMethod, width: 100 },
      { colKey: 'path', title: t.apiManagement.colPath, ellipsis: true },
      { colKey: 'category_id', title: t.apiManagement.colCategory, width: 140 },
      { colKey: 'description', title: t.apiManagement.colDescription, ellipsis: true },
      { colKey: 'enabled', title: t.apiManagement.colEnabled, width: 90 },
      { colKey: 'actions', title: t.apiManagement.colActions, width: 130, fixed: 'right' },
    ];
  });

  /**
   * 表单字段配置
   * @type {ComputedRef<AutoFormField[]>}
   * @description 从 playground-templates.json 读取并注入动态 handler 后的字段配置
   */
  itemFormFields: ComputedRef<AutoFormField[]> = computed(() => {
    const playgroundStore = usePlaygroundStore();
    const rawFields = playgroundStore.getFieldsById('api-item-form');
    const handlers = createApiManagementHandlers({
      getCategoryOptions: () => this.categoryOptions.value,
    });
    return enhanceFields(rawFields, handlers) as AutoFormField[];
  });

  /**
   * API 条目抽屉当前模式
   * @type {ComputedRef<FormMode>}
   * @description editingItem 非空时为 Edit，否则为 Create
   */
  itemFormMode: ComputedRef<FormMode> = computed(
    () => (this.editingItem.value ? FormMode.Edit : FormMode.Create),
  );

  /**
   * API 按分类分组
   * @type {ComputedRef<Array<{ category_id: string; categoryName: string; items: ApiItem[] }>>}
   * @description 用于分组展示的数据结构
   */
  groupedItems: ComputedRef<Array<{ category_id: string; categoryName: string; items: ApiItem[] }>> = computed(
    () => groupItemsByCategory(
      this.filteredItems.value,
      this.categories.value,
      this.localeStore.t.apiManagement.uncategorized,
    ),
  );

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载接口分类列表（用于下拉选择）
   */
  loadCategories = async (): Promise<void> => {
    try {
      const res = await this.service.fetchCategories();
      this.categories.value = res.data.categories;
    } catch {
      // 静默失败，不影响主流程
    }
  };

  /**
   * 加载 API 条目列表
   * @param {boolean} silent - 静默加载（不显示 loading）
   */
  loadItems = async (silent: boolean = false): Promise<void> => {
    if (!silent) this.itemsLoading.value = true;
    try {
      const res = await this.service.fetchItems();
      this.items.value = res.data.items.map((item) => ({
        ...item,
      }));
    } finally {
      this.itemsLoading.value = false;
    }
  };

  /**
   * 打开新建 API 条目抽屉
   * @description 重置 editingItem 与 itemFormData，并使当前选中分类作为默认值
   */
  openCreateItem = (): void => {
    this.editingItem.value = null;
    this.itemFormData.value = {
      ...ApiItemFormData,
      category_id: this.selectedCategoryId.value || ApiItemFormData.category_id,
    };
    this.lastAutoItemKey.value = '';
    this.itemDrawerVisible.value = true;
  };

  /**
   * 打开编辑 API 条目抽屉
   * @param {ApiItem} item - 待编辑的 API 条目
   * @description 编辑态认为当前 item_key 是用户已确认值，不再自动覆盖
   */
  openEditItem = (item: ApiItem): void => {
    this.editingItem.value = item;
    this.itemFormData.value = { ...item };
    // 编辑态：认为当前 item_key 是用户已确认值，不再自动覆盖
    this.lastAutoItemKey.value = item.item_key ?? '';
    this.itemDrawerVisible.value = true;
  };

  /**
   * 关闭 API 条目抽屉
   * @description 同时重置编辑状态与表单数据
   */
  closeItemDrawer = (): void => {
    this.itemDrawerVisible.value = false;
    this.editingItem.value = null;
    this.itemFormData.value = { ...ApiItemFormData };
    this.lastAutoItemKey.value = '';
  };

  /**
   * 根据当前 method + path 粘性同步 item_key
   * @description 用户未手动修改过 item_key（item_key 为空或等于上次自动派生值）时才会覆盖；
   *              一旦用户手动输入，停止自动覆盖以保持用户意图
   */
  syncItemKeyFromMethodPath = (): void => {
    const form = this.itemFormData.value;
    const method = form.method ?? '';
    const path = form.path ?? '';
    if (!method || !path) return;

    const current = form.item_key ?? '';
    const isSticky = current === '' || current === this.lastAutoItemKey.value;
    if (!isSticky) return;

    const next = buildItemKey(method, path);
    if (!next || next === current) return;

    this.itemFormData.value = { ...form, item_key: next };
    this.lastAutoItemKey.value = next;
  };
  
  /**
   * 提交 API 条目表单
   * @description 会自动派生 item_key（若用户未填写）
   * @param formData 表单数据
   */
  submitItemForm = async (formData: Partial<ApiItem>): Promise<void> => {
    // 兜底派生：若用户未填写 item_key，根据 method+path 自动生成
    const payload: Partial<ApiItem> = { ...formData };
    if (!payload.item_key && payload.method && payload.path) {
      payload.item_key = buildItemKey(payload.method, payload.path);
    }

    this.pageLoading.value = true;
    try {
      if (this.editingItem.value) {
        await this.service.updateItem(this.editingItem.value.category_id, payload);
        MessagePlugin.success(this.localeStore.t.common.updateSuccess);
      } else {
        await this.service.createItem(payload);
        MessagePlugin.success(this.localeStore.t.common.createSuccess);
      }
      this.closeItemDrawer();
      await this.loadItems(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 删除 API 条目
   * @param {string} id - API 条目 ID
   */
  removeItem = async (id: string): Promise<void> => {
    try {
      await this.service.deleteItem(id);
      MessagePlugin.success(this.localeStore.t.common.deleteSuccess);
      await this.loadItems(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.deleteFailedRetry);
    }
  };

  /**
   * 切换 API 条目启用状态
   * @param {string} id - API 条目 ID
   * @param {boolean} enabled - 目标启用状态
   */
  toggleItemEnabled = async (id: string, enabled: boolean): Promise<void> => {
    try {
      await this.service.updateItem(id, { enabled });
      await this.loadItems(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    }
  };

  /**
   * 打开 API 执行面板
   * @param {ApiItem} item - 待执行的 API 条目
   * @description 初始化执行 URL、请求头、参数与请求体默认值
   */
  openExecuteDrawer = (item: ApiItem): void => {
    this.executingItem.value = item;
    this.executeUrl.value = item.path;
    this.executeBody.value = '';
    this.executeBodyInitial.value = '';
    this.executeHeaders.value = buildDefaultHeaders();
    this.executeParams.value = [{ key: '', value: '', enabled: true }];
    this.executeResult.value = null;
    this.executeError.value = '';
    this.executeDrawerVisible.value = true;
  };

  /**
   * 关闭 API 执行面板
   * @description 同时清理执行中条目与上次执行结果
   */
  closeExecuteDrawer = (): void => {
    this.executeDrawerVisible.value = false;
    this.executingItem.value = null;
    this.executeResult.value = null;
    this.executeError.value = '';
  };

  /**
   * 添加请求头行
   * @description 在表格末尾追加一行空请求头
   */
  addHeaderRow = (): void => {
    this.executeHeaders.value.push({ key: '', value: '', enabled: true });
  };

  /**
   * 删除请求头行
   * @param {number} index - 待删除行的下标
   */
  removeHeaderRow = (index: number): void => {
    this.executeHeaders.value.splice(index, 1);
  };

  /**
   * 添加 Query 参数行
   * @description 在表格末尾追加一行空 Query 参数
   */
  addParamRow = (): void => {
    this.executeParams.value.push({ key: '', value: '', enabled: true });
  };

  /**
   * 删除 Query 参数行
   * @param {number} index - 待删除行的下标
   */
  removeParamRow = (index: number): void => {
    this.executeParams.value.splice(index, 1);
  };

  /**
   * 处理 JSON 编辑器内容变化
   * @param {string} content 编辑器当前文本
   * @description 仅更新 executeBody（供执行时读取）；不写回 executeBodyInitial，
   *              避免触发 file-content 组件的 content watch 重建编辑器
   */
  handleExecuteBodyChange = (content: string): void => {
    this.executeBody.value = content;
  };

  /**
   * 执行 API 请求
   * @description 从执行面板读取 URL/请求头/参数/请求体后调用后端代理接口
   */
  executeApi = async (): Promise<void> => {
    const rawUrl = this.executeUrl.value.trim();
    if (!rawUrl) {
      MessagePlugin.warning(this.localeStore.t.apiManagement.executeUrlRequired);
      return;
    }

    const headers = pickEnabledEntries(this.executeHeaders.value);
    const params = pickEnabledEntries(this.executeParams.value);

    this.executing.value = true;
    this.executeResult.value = null;
    this.executeError.value = '';

    try {
      const res = await this.service.executeApi({
        url: normalizeExecuteUrl(rawUrl),
        method: this.executingItem.value?.method ?? 'GET',
        headers,
        params: Object.keys(params).length > 0 ? params : undefined,
        body: this.executeBody.value || undefined,
      });
      this.applyExecuteResponse(res);
    } catch {
      this.executeError.value = this.localeStore.t.common.networkErrorRetry;
    } finally {
      this.executing.value = false;
    }
  };

  /**
   * 处理执行接口响应
   * @param {{ code: number; data: ApiExecuteResult; message: string }} res - 后端返回的响应体
   * @description 按业务 code 分发到 executeResult 或 executeError
   */
  private applyExecuteResponse = (res: { code: number; data: ApiExecuteResult; message: string }): void => {
    if (res.code === 0) {
      this.executeResult.value = res.data;
      return;
    }
    this.executeError.value = res.message || this.localeStore.t.apiManagement.requestFailed;
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动窗口 resize 监听，并并行加载模板、分类与接口列表
   */
  mounted = (): void => {
    this.startResizeListener();
    // 确保 playground store 已加载（为 itemFormFields 提供模板数据）
    void usePlaygroundStore().fetchTemplates();
    void Promise.all([this.loadCategories(), this.loadItems()]);
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
 * @description 将 ApiManagementModel 类包装为 Composition API 可用的函数
 */
export const useApiManagementModel = () => {
  const model = new ApiManagementModel();

  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());

  // 实时联动：抽屉打开期间，method / path 变化时粘性自动同步 item_key
  watch(
    () => [model.itemFormData.value.method, model.itemFormData.value.path] as const,
    () => {
      if (!model.itemDrawerVisible.value) return;
      model.syncItemKeyFromMethodPath();
    },
  );

  return {
    // 语言
    ...model,
    // 权限
    Permission,
  };
};
