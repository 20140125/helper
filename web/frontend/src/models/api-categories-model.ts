import { ref, computed, onMounted, onBeforeUnmount, watch, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { ApiCategoriesService } from '@/services/api-categories-service';
import { usePlaygroundStore } from '@/stores/playground';
import { Permission } from '@/types/permission';
import type { ApiCategory, IApiCategoryFormData } from '@/types/api-management';
import { ApiCategoryFormData } from '@/data/initiate-data';
import type { AutoFormField } from '@/types/auto-form';
import { FormMode } from '@/constants/form';
import { enhanceFields } from '@/utils/field-enhancer';
import { buildCategoryKey } from '@/utils/api-management';

/**
 * 接口分类管理页面数据模型类
 * @description 管理接口分类的所有业务逻辑，包括分类列表加载、新增/编辑/删除分类、表单 category_key 粘性自动派生等
 */
export class ApiCategoryModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * 接口分类服务实例
   * @type {ApiCategoriesService}
   * @description 用于分类的增删改查接口调用
   */
  service: ApiCategoriesService = new ApiCategoriesService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 接口分类列表
   * @type {Ref<ApiCategory[]>}
   * @description 当前已注册的所有接口分类
   */
  categories: Ref<ApiCategory[]> = ref([]);

  /**
   * 分类抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制新建/编辑分类抽屉的展开
   */
  categoryDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前正在编辑的分类
   * @type {Ref<ApiCategory | null>}
   * @description 为 null 时表示新建态，非 null 时表示编辑态
   */
  editingCategory: Ref<ApiCategory | null> = ref(null);

  /**
   * 分类抽屉表单数据
   * @type {Ref<IApiCategoryFormData>}
   * @description 抽屉内 AutoForm 的 v-model 绑定值；初始值来自 initiate-data 中的 ApiCategoryFormData
   */
  categoryFormData: Ref<IApiCategoryFormData> = ref({ ...ApiCategoryFormData });

  /**
   * 最近一次由 name 自动派生出的 category_key
   * @type {Ref<string>}
   * @description 用于「粘性自动填充」：用户未手动修改过 category_key（为空或等于
   *              lastAutoCategoryKey）时，name 变化会继续自动覆盖 category_key；
   *              一旦用户手动改过，自动填充将不再覆盖用户输入。
   */
  lastAutoCategoryKey: Ref<string> = ref('');

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 表格列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   */
  categoryColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { colKey: 'name', title: t.apiManagement.colName, width: 180 },
      { colKey: 'description', title: t.apiManagement.colDescription, ellipsis: true },
      { colKey: 'created_at', title: t.apiManagement.colcreated_at, width: 300 },
      { colKey: 'actions', title: t.apiManagement.colActions, width: 100, fixed: 'right' },
    ];
  });

  /**
   * 分类抽屉当前模式
   * @type {ComputedRef<FormMode>}
   */
  categoryFormMode: ComputedRef<FormMode> = computed(
    () => (this.editingCategory.value ? FormMode.Edit : FormMode.Create),
  );

  /**
   * 表单字段配置
   * @type {ComputedRef<AutoFormField[]>}
   * @description 编辑态下 category_key 作为业务主键不可变，自动设置为 disabled
   */
  categoryFormFields: ComputedRef<AutoFormField[]> = computed(() => {
    const playgroundStore = usePlaygroundStore();
    const rawFields = playgroundStore.getFieldsById('api-category-form');
    const fields = enhanceFields(rawFields, {}) as AutoFormField[];
    // 编辑态：category_key 作为业务主键不可变，禁用该字段
    if (this.editingCategory.value) {
      return fields.map((f) => (f.name === 'category_key' ? { ...f, disabled: true } : f));
    }
    return fields;
  });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载接口分类列表
   * @param {boolean} [silent=false] - 静默加载（不显示 loading）
   * @returns {Promise<void>}
   * @description 从服务端获取最新分类列表并刷新 categories 状态
   */
  loadCategories = async (silent: boolean = false): Promise<void> => {
    if (!silent) this.pageLoading.value = true;
    try {
      const res = await this.service.fetchCategories();
      this.categories.value = res.data.categories;
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 打开新建分类抽屉
   * @returns {void}
   * @description 重置表单数据为初始空值并展开抽屉
   */
  openCreateCategory = (): void => {
    this.editingCategory.value = null;
    this.categoryFormData.value = { ...ApiCategoryFormData };
    this.lastAutoCategoryKey.value = '';
    this.categoryDrawerVisible.value = true;
  };

  /**
   * 打开编辑分类抽屉
   * @param {ApiCategory} category - 要编辑的分类对象
   * @returns {void}
   * @description 将分类数据回填到表单，并将 category_key 视为用户已确认值
   */
  openEditCategory = (category: ApiCategory): void => {
    this.editingCategory.value = category;
    this.categoryFormData.value = {
      name: category.name,
      category_key: category.category_key,
      description: category.description,
    };
    // 编辑态：认为当前 category_key 是用户已确认值，不再自动覆盖
    this.lastAutoCategoryKey.value = category.category_key ?? '';
    this.categoryDrawerVisible.value = true;
  };

  /**
   * 关闭分类抽屉
   * @returns {void}
   * @description 收起抽屉并清空表单状态
   */
  closeCategoryDrawer = (): void => {
    this.categoryDrawerVisible.value = false;
    this.editingCategory.value = null;
    this.categoryFormData.value = { ...ApiCategoryFormData };
    this.lastAutoCategoryKey.value = '';
  };

  /**
   * 根据当前 name 粘性同步 category_key
   * @returns {void}
   * @description 仅在新建态且用户未手动修改过 category_key 时覆盖；
   *              编辑态由于 category_key 作为业务主键不允许修改，因此跳过。
   */
  syncCategoryKeyFromName = (): void => {
    // 编辑态不参与派生（category_key 作为业务主键不可变）
    if (this.editingCategory.value) return;

    const form = this.categoryFormData.value;
    const name = form.name ?? '';
    if (!name) return;

    const current = form.category_key ?? '';
    const isSticky = current === '' || current === this.lastAutoCategoryKey.value;
    if (!isSticky) return;

    const next = buildCategoryKey(name);
    if (!next || next === current) return;

    this.categoryFormData.value = { ...form, category_key: next };
    this.lastAutoCategoryKey.value = next;
  };

  /**
   * 提交分类表单
   * @param {Partial<ApiCategory>} formData - 表单数据
   * @returns {Promise<void>}
   * @description 兜底派生：若用户未填写 category_key，根据 name 自动生成；提交后刷新列表
   */
  submitCategoryForm = async (formData: Partial<ApiCategory>): Promise<void> => {
    const payload: Partial<ApiCategory> = { ...formData };
    if (!payload.category_key && payload.name) {
      payload.category_key = buildCategoryKey(payload.name);
    }

    this.pageLoading.value = true;
    try {
      if (this.editingCategory.value) {
        await this.service.updateCategory(this.editingCategory.value.category_key, payload);
        MessagePlugin.success(this.localeStore.t.common.updateSuccess);
      } else {
        await this.service.createCategory(payload);
        MessagePlugin.success(this.localeStore.t.common.createSuccess);
      }
      this.closeCategoryDrawer();
      await this.loadCategories(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 删除指定分类
   * @param {string} id - 分类的 category_key
   * @returns {Promise<void>}
   * @description 调用服务端删除接口并刷新列表
   */
  removeCategory = async (id: string): Promise<void> => {
    try {
      await this.service.deleteCategory(id);
      MessagePlugin.success(this.localeStore.t.common.deleteSuccess);
      await this.loadCategories(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.deleteFailedRetry);
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动窗口 resize 监听，并加载模板与分类列表
   */
  mounted = (): void => {
    this.startResizeListener();
    // 确保 playground store 已加载（为 categoryFormFields 提供模板数据）
    void usePlaygroundStore().fetchTemplates();
    void this.loadCategories();
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
 * @description 将 ApiCategoryModel 类包装为 Composition API 可用的函数
 */
export const useApiCategoryModel = () => {
  const model = new ApiCategoryModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => model.mounted());

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => model.beforeUnmount());

  // 实时联动：抽屉打开期间，name 变化时粘性自动同步 category_key
  watch(
    () => model.categoryFormData.value.name,
    () => {
      if (!model.categoryDrawerVisible.value) return;
      model.syncCategoryKeyFromName();
    },
  );

  return {

    ...model,
    // 权限
    Permission,
  };
};
