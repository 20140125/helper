import { computed, onMounted, onBeforeUnmount, ref, type Ref, type ComputedRef } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { I18nService } from '@/services/i18n-service';
import { I18N_PAIRS_PAGE_SIZE } from '@/constants/i18n-messages';
import type { I18nPair } from '@/types/i18n';
import { Permission } from '@/types/permission';

/**
 * 语言包管理页面数据模型类
 * @description 按 key 把 zh / en 合并成一行对照编辑，一次保存写两条，避免只改一种语言；
 *   保留命名空间 / 关键字筛选与分页，保存后刷新 LocaleStore 立即生效。
 */
export class I18nMessagesModel extends BaseModel {
  /** i18n 服务实例 */
  service: I18nService = new I18nService();

  /** 当前路由（支持从 ?namespace=aiChat 直接定位 AI 面板文案） */
  private route = useRoute();

  /** 当前页的中英对照记录 */
  rows: Ref<I18nPair[]> = ref([]);

  /** 过滤后的总条数（按 key 去重） */
  total: Ref<number> = ref(0);

  /** 可用命名空间清单 */
  namespaces: Ref<string[]> = ref([]);

  /** 当前筛选命名空间，空串表示全部分组 */
  namespace: Ref<string> = ref(
    typeof this.route.query.namespace === 'string' ? this.route.query.namespace : '',
  );

  /** 键路径 / 中文 / 英文关键字 */
  keyword: Ref<string> = ref('');

  /** 当前页码 */
  page: Ref<number> = ref(1);

  /** 每页条数 */
  readonly pageSize: number = I18N_PAIRS_PAGE_SIZE;

  /** 每行的中英文编辑草稿（keyPath → zh / en） */
  draft: Ref<Record<string, { zh: string; en: string }>> = ref({});

  /** 正在保存的键路径 */
  savingKey: Ref<string> = ref('');

  /** 命名空间下拉选项（首项为全部分组） */
  namespaceOptions: ComputedRef<Array<{ label: string; value: string }>> = computed(() => [
    { label: this.localeStore.t.i18nMessages.allNamespaces, value: '' },
    ...this.namespaces.value.map((ns) => ({ label: ns, value: ns })),
  ]);

  /** 中英对照表格列 */
  columns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const t = this.localeStore.t.i18nMessages;
    return [
      { colKey: 'namespace', title: t.colNamespace, width: 140 },
      { colKey: 'keyPath', title: t.colKeyPath, width: 260, ellipsis: true },
      { colKey: 'zh', title: t.langZh, minWidth: 220 },
      { colKey: 'en', title: t.langEn, minWidth: 220 },
      { colKey: 'type', title: t.colType, width: 100 },
      { colKey: 'actions', title: t.colActions, width: 100, fixed: 'right' as const },
    ];
  });

  /** 是否允许编辑文案（页面查看对所有登录用户开放，编辑需 database:edit） */
  canEditMessages = (): boolean => this.canEdit(Permission.DATABASE_VIEW);

  /**
   * 判断某行中英文是否被改动
   * @param {I18nPair} row - 文案行
   * @returns {boolean} 有改动返回 true
   */
  pairChanged = (row: I18nPair): boolean => {
    const draft = this.draft.value[row.keyPath];
    return Boolean(draft) && (draft.zh !== row.zh || draft.en !== row.en);
  };

  /** 加载当前筛选条件下的中英对照条目 */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const res = await this.service.fetchPairs({
        namespace: this.namespace.value || undefined,
        keyword: this.keyword.value.trim() || undefined,
        limit: this.pageSize,
        offset: (this.page.value - 1) * this.pageSize,
      });
      const result = res.data.result;
      this.rows.value = result.items;
      this.total.value = result.total;
      this.namespaces.value = result.namespaces;
      this.draft.value = Object.fromEntries(
        result.items.map((pair) => [pair.keyPath, { zh: pair.zh, en: pair.en }]),
      );
    } catch (err) {
      this.rows.value = [];
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /** 刷新当前列表 */
  refresh = (): Promise<void> => this.load();

  /** 切换命名空间并回到第一页 */
  handleNamespaceChange = (): void => {
    this.page.value = 1;
    void this.load();
  };

  /** 提交关键字搜索并回到第一页 */
  handleSearch = (): void => {
    this.page.value = 1;
    void this.load();
  };

  /** 重置筛选条件（回到全部分组） */
  resetFilters = (): void => {
    this.keyword.value = '';
    this.namespace.value = '';
    this.page.value = 1;
    void this.load();
  };

  /**
   * 翻页
   * @param {{ current: number }} pagination - TDesign 分页上下文
   * @returns {void}
   */
  onPageChange = (pagination: { current: number }): void => {
    this.page.value = pagination.current;
    void this.load();
  };

  /**
   * 一次保存中英文两条文案并刷新运行时语言包
   * @param {I18nPair} row - 文案行
   * @returns {Promise<void>}
   * @description 函数型条目只读；保存时后端会补齐缺失的语言记录
   */
  savePair = async (row: I18nPair): Promise<void> => {
    if (!this.canEditMessages() || row.hasFunction || !this.pairChanged(row)) return;
    const draft = this.draft.value[row.keyPath];
    if (!draft) return;
    this.savingKey.value = row.keyPath;
    try {
      await this.service.savePair(row.keyPath, draft.zh, draft.en);
      row.zh = draft.zh;
      row.en = draft.en;
      await this.localeStore.reload();
      MessagePlugin.success(this.localeStore.t.common.saveSuccess);
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.saveFailed);
    } finally {
      this.savingKey.value = '';
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
 * @description 将 I18nMessagesModel 包装为页面可用的函数
 */
export const useI18nMessagesModel = () => {
  const model = new I18nMessagesModel();
  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());
  return { ...model };
};
