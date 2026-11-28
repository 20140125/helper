import { computed, onMounted, onBeforeUnmount, ref, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { I18nService } from '@/services/i18n-service';
import { I18N_DEFAULT_NAMESPACE, I18N_LANG_CODES, I18N_MESSAGES_PAGE_SIZE } from '@/constants/i18n-messages';
import type { AutoFormField } from '@/types/auto-form';
import type { I18nLang, I18nMessage } from '@/types/i18n';
import { Permission } from '@/types/permission';

/**
 * 语言包管理页面数据模型类
 * @description 管理语言切换、命名空间/关键字筛选、分页与静态文案编辑，保存后刷新语言 Store
 */
export class I18nMessagesModel extends BaseModel {
  /**
   * i18n 语言包服务实例
   * @type {I18nService}
   * @description 封装运行时语言包与管理页读写接口
   */
  service: I18nService = new I18nService();

  /**
   * 当前页记录
   * @type {Ref<I18nMessage[]>}
   * @description 由列表接口返回，按语言包顺序排列
   */
  rows: Ref<I18nMessage[]> = ref([]);

  /**
   * 过滤后的总条数
   * @type {Ref<number>}
   * @description 供分页组件显示总页数
   */
  total: Ref<number> = ref(0);

  /**
   * 当前语言下的命名空间清单
   * @type {Ref<string[]>}
   * @description 由列表接口一并返回，随语言切换刷新
   */
  namespaces: Ref<string[]> = ref([]);

  /**
   * 当前筛选语言
   * @type {Ref<I18nLang>}
   * @description 默认中文，与运行时语言切换相互独立
   */
  lang: Ref<I18nLang> = ref('zh');

  /**
   * 当前筛选命名空间
   * @type {Ref<string>}
   * @description 默认 I18N_DEFAULT_NAMESPACE，不提供「全部分组」选项
   */
  namespace: Ref<string> = ref(I18N_DEFAULT_NAMESPACE);

  /**
   * 键路径 / 文案关键字
   * @type {Ref<string>}
   * @description 提交搜索时才参与查询，输入过程不触发请求
   */
  keyword: Ref<string> = ref('');

  /**
   * 固定返回条数（默认查询参数，页面不分页）
   * @type {number}
   * @description 与后端 I18N_MESSAGES_PAGE_SIZE 对齐，配合筛选与关键字定位
   */
  readonly defaultLimit: number = I18N_MESSAGES_PAGE_SIZE;

  /**
   * 编辑抽屉显示状态
   * @type {Ref<boolean>}
   * @description true 表示抽屉打开
   */
  drawerVisible: Ref<boolean> = ref(false);

  /**
   * 保存中标记
   * @type {Ref<boolean>}
   * @description 控制抽屉确认按钮 loading
   */
  saving: Ref<boolean> = ref(false);

  /**
   * 当前编辑的记录
   * @type {Ref<I18nMessage | null>}
   * @description null 表示未选中记录
   */
  editing: Ref<I18nMessage | null> = ref(null);

  /**
   * 编辑表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 仅包含 value 字段，提交时读取
   */
  formData: Ref<Record<string, unknown>> = ref({ value: '' });

  /**
   * 语言下拉选项
   * @type {ComputedRef<Array<{ label: string; value: I18nLang }>>}
   * @description 跟随界面语言切换显示中文或英文标签
   */
  langOptions: ComputedRef<Array<{ label: string; value: I18nLang }>> = computed(() => {
    const { t } = this.localeStore;
    return I18N_LANG_CODES.map((code) => ({
      label: code === 'zh' ? t.i18nMessages.langZh : t.i18nMessages.langEn,
      value: code,
    }));
  });

  /**
   * 命名空间下拉选项
   * @type {ComputedRef<Array<{ label: string; value: string }>>}
   * @description 首项为「全部」，其余取当前语言的命名空间
   */
  namespaceOptions: ComputedRef<Array<{ label: string; value: string }>> = computed(() =>
    this.namespaces.value.map((ns) => ({ label: ns, value: ns })),
  );

  /**
   * 编辑表单字段
   * @type {ComputedRef<AutoFormField[]>}
   * @description 单个多行文本框，提交时校验必填
   */
  fields: ComputedRef<AutoFormField[]> = computed(() => {
    const { t } = this.localeStore;
    return [{
      name: 'value',
      label: t.i18nMessages.fieldValue,
      type: 'textarea',
      placeholder: t.i18nMessages.fieldValuePlaceholder,
      rules: [{ required: true, message: t.common.required }],
    }];
  });

  /**
   * 是否允许编辑文案
   * @returns {boolean} 是否拥有 database:edit
   * @description 页面查看已放开给所有登录用户，编辑仍由 database:view 推导出 database:edit 校验
   */
  canEditMessages = (): boolean => this.canEdit(Permission.DATABASE_VIEW);

  /**
   * 加载当前筛选条件下的语言包条目
   * @returns {Promise<void>} 无返回值
   * @description 固定默认参数 limit=500、offset=0 一次返回；靠筛选与关键字缩小范围，页面不分页
   */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const res = await this.service.fetchMessages({
        lang: this.lang.value,
        namespace: this.namespace.value,
        keyword: this.keyword.value.trim() || undefined,
        limit: this.defaultLimit,
        offset: 0,
      });
      this.rows.value = res.data.result.items;
      this.total.value = res.data.result.total;
      this.namespaces.value = res.data.result.namespaces;
    } catch (err) {
      this.rows.value = [];
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 刷新当前列表
   * @returns {Promise<void>} 无返回值
   * @description 顶部刷新按钮调用，保持当前筛选条件
   */
  refresh = (): Promise<void> => this.load();

  /**
   * 切换筛选语言
   * @returns {void} 无返回值
   * @description 语言变化时命名空间列表也随之变化，先清空命名空间再重新查询
   */
  handleLangChange = (): void => {
    this.namespace.value = I18N_DEFAULT_NAMESPACE;
    void this.load();
  };

  /**
   * 切换筛选命名空间
   * @returns {void} 无返回值
   * @description 按新命名空间重新查询
   */
  handleNamespaceChange = (): void => {
    void this.load();
  };

  /**
   * 提交关键字搜索
   * @returns {void} 无返回值
   * @description 仅在点击搜索或按下回车时请求，避免输入即校验/请求
   */
  handleSearch = (): void => {
    void this.load();
  };

  /**
   * 重置筛选条件
   * @returns {void} 无返回值
   * @description 清空关键字与命名空间并重新查询，保留当前选择的语言
   */
  resetFilters = (): void => {
    this.keyword.value = '';
    this.namespace.value = I18N_DEFAULT_NAMESPACE;
    void this.load();
  };

  /**
   * 打开编辑抽屉
   * @param {I18nMessage} row - 待编辑的记录
   * @returns {void} 无返回值
   * @description 仅允许编辑静态文案；函数型条目由 TS 语言包源码维护
   */
  openEdit = (row: I18nMessage): void => {
    if (!this.canEditMessages() || row.valueType !== 'text') return;
    this.editing.value = row;
    this.formData.value = { value: row.value };
    this.drawerVisible.value = true;
  };

  /**
   * 保存文案并刷新运行时语言包
   * @returns {Promise<void>} 无返回值
   * @description 写库成功后重新拉取列表与 LocaleStore，使当前会话立即使用新文案
   */
  submitEdit = async (): Promise<void> => {
    const row = this.editing.value;
    if (!row) return;
    const value = String(this.formData.value.value ?? '');
    if (!value.trim()) {
      MessagePlugin.warning(this.localeStore.t.common.required);
      return;
    }
    this.saving.value = true;
    try {
      await this.service.updateMessage(row.id, value);
      MessagePlugin.success(this.localeStore.t.common.saveSuccess);
      this.drawerVisible.value = false;
      await Promise.all([this.load(), this.localeStore.reload()]);
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.saveFailed);
    } finally {
      this.saving.value = false;
    }
  };

  /** 组件挂载时加载列表 */
  mounted = (): void => {
    void this.load();
  };

  /** 组件卸载时清理状态（当前无定时器） */
  beforeUnmount = (): void => {};
}

/**
 * Composition API 包装函数
 * @description 将 I18nMessagesModel 类包装为 Composition API 可用的函数
 */
export const useI18nMessagesModel = () => {
  const model = new I18nMessagesModel();
  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());
  return { ...model };
};
