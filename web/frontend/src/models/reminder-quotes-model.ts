import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { ReminderQuotesService } from '@/services/reminder-quotes-service';
import { usePlaygroundStore } from '@/stores/playground';
import { Permission } from '@/types/permission';
import type {
  ReminderQuoteItem,
  ReminderQuotesBucket,
  CreateReminderQuotePayload,
  UpdateReminderQuotePayload,
  IReminderQuoteFormData,
} from '@/types/reminder-quotes';
import { ReminderQuoteFormData } from '@/data/initiate-data';
import type { AutoFormField } from '@/types/auto-form';
import { enhanceFields } from '@/utils/field-enhancer';
import { createReminderQuotesHandlers } from '@/utils/handler-registry';
import { buildContentPreview } from '@/utils/greetings';
import {
  REMINDER_QUOTES_BUCKETS,
  REMINDER_QUOTES_BUCKET_GROUPS,
  REMINDER_QUOTES_SCENES,
  REMINDER_QUOTES_SCENE_LOCALE_KEYS,
  type ReminderQuotesScene,
} from '@/constants/reminder-quotes';
import { FormMode } from '@/constants/form';

/**
 * 提醒寄语库管理页面数据模型类
 * @description 管理 reminder-quotes.json 的扁平化条目增删改查，支持按场景/桶筛选与关键词模糊匹配
 */
export class ReminderQuotesModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * 提醒寄语服务实例
   * @type {ReminderQuotesService}
   * @description 用于寄语条目的增删改查接口调用
   */
  service: ReminderQuotesService = new ReminderQuotesService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 全量条目列表
   * @type {Ref<ReminderQuoteItem[]>}
   * @description 后端返回的所有寄语条目
   */
  items: Ref<ReminderQuoteItem[]> = ref([]);

  /**
   * 一级场景筛选
   * @type {Ref<string>}
   * @description 取值 weekend / workday_adjust / quotes / breakfast / lunch / dinner / ''（全部）
   */
  filterScene: Ref<string> = ref('');

  /**
   * 具体 bucket 筛选
   * @type {Ref<ReminderQuotesBucket | ''>}
   * @description 空字符串表示「全部」
   */
  filterBucket: Ref<ReminderQuotesBucket | ''> = ref('');

  /**
   * 关键词筛选
   * @type {Ref<string>}
   * @description 用于按 content 模糊匹配
   */
  keyword: Ref<string> = ref('');

  /**
   * 寄语抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制新建/编辑寄语抽屉的展开
   */
  quoteDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前正在编辑的条目
   * @type {Ref<ReminderQuoteItem | null>}
   * @description 为 null 时表示新建态，非 null 时表示编辑态
   */
  editingQuote: Ref<ReminderQuoteItem | null> = ref(null);

  /**
   * 抽屉表单数据
   * @type {Ref<IReminderQuoteFormData>}
   * @description 抽屉内 AutoForm 的 v-model 绑定值；初始值来自 initiate-data 中的 ReminderQuoteFormData
   */
  quoteFormData: Ref<IReminderQuoteFormData> = ref({ ...ReminderQuoteFormData });

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 抽屉当前模式
   * @type {ComputedRef<FormMode>}
   */
  quoteFormMode: ComputedRef<FormMode> = computed(
    () => (this.editingQuote.value ? FormMode.Edit : FormMode.Create),
  );

  /**
   * 一级场景选项
   * @type {ComputedRef<Array<{ label: string; value: string }>>}
   */
  sceneOptions: ComputedRef<Array<{ label: string; value: string }>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { label: t.reminderQuotes.sceneAll, value: '' },
      ...REMINDER_QUOTES_SCENES.map((scene) => ({
        label: this.getSceneLabel(scene),
        value: scene,
      })),
    ];
  });

  /**
   * 当前场景下可选 bucket
   * @type {ComputedRef<Array<{ label: string; value: ReminderQuotesBucket | '' }>>}
   */
  bucketOptions: ComputedRef<Array<{ label: string; value: ReminderQuotesBucket | '' }>> = computed(() => {
    const { t } = this.localeStore;
    const available: ReminderQuotesBucket[] = this.filterScene.value
      ? REMINDER_QUOTES_BUCKET_GROUPS[this.filterScene.value] ?? []
      : REMINDER_QUOTES_BUCKETS;
    return [
      { label: t.reminderQuotes.bucketAll, value: '' },
      ...available.map((b) => ({ label: this.getBucketLabel(b), value: b })),
    ];
  });

  /**
   * 筛选后的条目
   * @type {ComputedRef<ReminderQuoteItem[]>}
   */
  filteredItems: ComputedRef<ReminderQuoteItem[]> = computed(() => {
    const kw = this.keyword.value.trim().toLowerCase();
    return this.items.value.filter((it) => {
      if (this.filterScene.value) {
        const scenePrefix = this.filterScene.value;
        if (!it.bucket.startsWith(`${scenePrefix}.`)) return false;
      }
      if (this.filterBucket.value && it.bucket !== this.filterBucket.value) return false;
      if (!kw) return true;
      return it.content.toLowerCase().includes(kw);
    });
  });

  /**
   * 按场景聚合筛选后的条目。按 REMINDER_QUOTES_SCENES 顺序输出，跳过空场景。
   * @type {ComputedRef<Array<{ scene: string; label: string; items: ReminderQuoteItem[] }>>}
   */
  filteredGroups: ComputedRef<Array<{ scene: string; label: string; items: ReminderQuoteItem[] }>> = computed(() => {
    const list = this.filteredItems.value;
    const buckets = new Map<ReminderQuotesScene, ReminderQuoteItem[]>();
    for (const scene of REMINDER_QUOTES_SCENES) buckets.set(scene, []);
    for (const it of list) {
      const scene = it.bucket.split('.')[0] as ReminderQuotesScene;
      if (buckets.has(scene)) buckets.get(scene)!.push(it);
    }
    const result: Array<{ scene: string; label: string; items: ReminderQuoteItem[] }> = [];
    for (const scene of REMINDER_QUOTES_SCENES) {
      const items = buckets.get(scene) ?? [];
      if (items.length === 0) continue;
      result.push({ scene, label: this.getSceneLabel(scene), items });
    }
    return result;
  });

  /**
   * 表格列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   */
  columns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { colKey: 'bucket', title: t.reminderQuotes.colBucket, width: 260 },
      { colKey: 'preview', title: t.reminderQuotes.colPreview, ellipsis: true },
      { colKey: 'actions', title: t.reminderQuotes.colActions, width: 120, fixed: 'right' },
    ];
  });

  /**
   * 表单字段配置
   * @type {ComputedRef<AutoFormField[]>}
   */
  quoteFormFields: ComputedRef<AutoFormField[]> = computed(() => {
    const rawFields = usePlaygroundStore().getFieldsById('reminder-quote-form');
    return enhanceFields(rawFields, createReminderQuotesHandlers()) as AutoFormField[];
  });

  // ==============================
  // 工具方法
  // ==============================

  /**
   * 根据 bucket 路径获取展示标签
   * @param {ReminderQuotesBucket} bucket - bucket 路径
   * @returns {string} bucket 对应的国际化展示名称
   */
  getBucketLabel = (bucket: ReminderQuotesBucket): string => {
    const { t } = this.localeStore;
    const labels = t.reminderQuotes.bucketLabels as Record<string, string>;
    return labels[bucket] ?? bucket;
  };

  /**
   * 根据 scene key 获取展示名称
   * @param {ReminderQuotesScene} scene - 场景 key
   * @returns {string} 场景对应的国际化展示名称
   * @description 通过 REMINDER_QUOTES_SCENE_LOCALE_KEYS 查表取 i18n key，
   *              再到 t.reminderQuotes 取值，避免在 Model 里硬编码场景→文案映射。
   */
  getSceneLabel = (scene: ReminderQuotesScene): string => {
    const localeKey = REMINDER_QUOTES_SCENE_LOCALE_KEYS[scene];
    const dict = this.localeStore.t.reminderQuotes as unknown as Record<string, string>;
    return dict[localeKey] ?? scene;
  };

  /**
   * 构造表格预览行的纯文本
   * @param {ReminderQuoteItem} row - 当前行条目
   * @returns {string} 截断后的纯文本预览
   */
  getRowPreview = (row: ReminderQuoteItem): string => buildContentPreview(row.content, 80);

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载寄语列表
   * @param {boolean} [silent=false] - 静默加载（不显示 loading）
   * @returns {Promise<void>}
   * @description 从服务端获取最新条目并刷新 items 状态
   */
  loadItems = async (silent: boolean = false): Promise<void> => {
    if (!silent) this.pageLoading.value = true;
    try {
      const res = await this.service.fetchReminderQuotes();
      this.items.value = res.data.items;
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 切换一级场景筛选
   * @param {string} scene - 目标场景 key（'' 表示全部）
   * @returns {void}
   * @description 切换场景时同步清空具体 bucket 筛选
   */
  onSceneChange = (scene: string): void => {
    this.filterScene.value = scene;
    // 切场景时清空具体 bucket 过滤
    this.filterBucket.value = '';
  };

  /**
   * 打开新建抽屉
   * @returns {void}
   * @description 默认取当前筛选的 bucket 或第一个 bucket 作为默认值
   */
  openCreate = (): void => {
    this.editingQuote.value = null;
    // 默认取当前筛选的 bucket 或第一个
    const defaultBucket = (this.filterBucket.value || REMINDER_QUOTES_BUCKETS[0]) as ReminderQuotesBucket;
    this.quoteFormData.value = { ...ReminderQuoteFormData, bucket: defaultBucket };
    this.quoteDrawerVisible.value = true;
  };

  /**
   * 打开编辑抽屉
   * @param {ReminderQuoteItem} item - 要编辑的条目
   * @returns {void}
   * @description 将条目数据回填到表单
   */
  openEdit = (item: ReminderQuoteItem): void => {
    this.editingQuote.value = item;
    this.quoteFormData.value = { bucket: item.bucket, content: item.content };
    this.quoteDrawerVisible.value = true;
  };

  /**
   * 关闭抽屉
   * @returns {void}
   * @description 收起抽屉并清空表单状态
   */
  closeDrawer = (): void => {
    this.quoteDrawerVisible.value = false;
    this.editingQuote.value = null;
    this.quoteFormData.value = { ...ReminderQuoteFormData };
  };

  /**
   * 提交表单
   * @param {Partial<ReminderQuoteItem>} form - 表单数据
   * @returns {Promise<void>}
   * @description 校验通过后调用新增/更新接口，并刷新列表
   */
  submitForm = async (form: Partial<ReminderQuoteItem>): Promise<void> => {
    const { t } = this.localeStore;
    const bucket = form.bucket as ReminderQuotesBucket | undefined;
    const content = (form.content ?? '').trim();
    if (!bucket) {
      MessagePlugin.warning(t.reminderQuotes.validateBucketRequired);
      return;
    }
    if (!content) {
      MessagePlugin.warning(t.reminderQuotes.validateContentRequired);
      return;
    }
    this.pageLoading.value = true;
    try {
      if (this.editingQuote.value) {
        const payload: UpdateReminderQuotePayload = { bucket, content };
        await this.service.updateReminderQuote(this.editingQuote.value.id, payload);
        MessagePlugin.success(t.common.updateSuccess);
      } else {
        const payload: CreateReminderQuotePayload = { bucket, content };
        await this.service.createReminderQuote(payload);
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
      await this.service.deleteReminderQuote(id);
      MessagePlugin.success(t.common.deleteSuccess);
      await this.loadItems(true);
    } catch {
      MessagePlugin.error(t.common.deleteFailedRetry);
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动窗口 resize 监听，并加载模板与提醒语列表
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
 * @description 将 ReminderQuotesModel 类包装为 Composition API 可用的函数
 */
export const useReminderQuotesModel = () => {
  const model = new ReminderQuotesModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => model.mounted());

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => model.beforeUnmount());

  return {

    ...model,
    // 权限
    Permission,
  };
};
