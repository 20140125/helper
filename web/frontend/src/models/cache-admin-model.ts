import { computed, onMounted, onBeforeUnmount, ref, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { CacheAdminService } from '@/services/cache-admin-service';
import { CACHE_ADMIN_FLAT_TABLES, CACHE_ADMIN_PAGE_SIZE, CACHE_ADMIN_PERIODS } from '@/constants/cache-admin';
import type { AutoFormField } from '@/types/auto-form';
import type {
  CacheAdminEntry,
  CacheAdminTable,
  CacheAdminWritePayload,
} from '@/types/cache-admin';

/**
 * 缓存数据管理页面数据模型类
 * @description 管理 13 张 hp_cache_* 表的表/粒度/关键字筛选、分页、正文编辑与删除
 */
export class CacheAdminModel extends BaseModel {
  /**
   * 缓存数据管理服务实例
   * @type {CacheAdminService}
   * @description 封装管理页的表清单、列表与单条读写接口
   */
  service: CacheAdminService = new CacheAdminService();

  /**
   * 当前页记录
   * @type {Ref<CacheAdminEntry[]>}
   * @description 由列表接口返回，按更新时间倒序
   */
  rows: Ref<CacheAdminEntry[]> = ref([]);

  /**
   * 过滤后的总条数
   * @type {Ref<number>}
   * @description 供分页组件计算总页数
   */
  total: Ref<number> = ref(0);

  /**
   * 可筛选的表清单
   * @type {Ref<CacheAdminTable[]>}
   * @description 由列表接口一并返回，避免前端硬编码表名
   */
  tables: Ref<CacheAdminTable[]> = ref([]);

  /**
   * 当前筛选表名
   * @type {Ref<string>}
   * @description 空串表示全部表
   */
  table: Ref<string> = ref('');

  /**
   * 当前筛选时间粒度
   * @type {Ref<string>}
   * @description 空串表示全部粒度
   */
  periodType: Ref<string> = ref('');

  /**
   * 键名 / section / 正文关键字
   * @type {Ref<string>}
   * @description 点击查询或回车时才参与请求，输入过程不触发
   */
  keyword: Ref<string> = ref('');

  /**
   * 当前页码
   * @type {Ref<number>}
   * @description 从 1 开始，筛选变化后重置为 1
   */
  page: Ref<number> = ref(1);

  /**
   * 每页条数
   * @type {number}
   * @description 与后端 CACHE_ADMIN_PAGE_SIZE 对齐
   */
  readonly pageSize: number = CACHE_ADMIN_PAGE_SIZE;

  /**
   * 编辑抽屉显示状态
   * @type {Ref<boolean>}
   * @description true 表示抽屉打开
   */
  drawerVisible: Ref<boolean> = ref(false);

  /**
   * 详情加载 / 保存中标记
   * @type {Ref<boolean>}
   * @description 控制抽屉确认按钮 loading
   */
  saving: Ref<boolean> = ref(false);

  /**
   * 详情加载中标记
   * @type {Ref<boolean>}
   * @description 读取单条正文时禁用确认按钮
   */
  detailLoading: Ref<boolean> = ref(false);

  /**
   * 当前编辑的记录
   * @type {Ref<CacheAdminEntry | null>}
   * @description null 表示新增模式
   */
  editing: Ref<CacheAdminEntry | null> = ref(null);

  /**
   * 是否为新增模式
   * @type {Ref<boolean>}
   * @description true 时允许修改表、section 与缓存键
   */
  isCreate: Ref<boolean> = ref(false);

  /**
   * 编辑表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 包含 table / section / key / body 四个字段
   */
  formData: Ref<Record<string, unknown>> = ref({ table: '', section: '', key: '', body: '' });

  /**
   * 表筛选下拉选项
   * @type {ComputedRef<Array<{ label: string; value: string }>>}
   * @description 首项为「全部表」，其余取后端返回的表清单
   */
  tableOptions: ComputedRef<Array<{ label: string; value: string }>> = computed(() => [
    { label: this.localeStore.t.cacheAdmin.allTables, value: '' },
    ...this.tables.value.map((item) => ({ label: item.name, value: item.name })),
  ]);

  /**
   * 粒度筛选下拉选项
   * @type {ComputedRef<Array<{ label: string; value: string }>>}
   * @description 粒度值是技术标识，标签跟随界面语言切换
   */
  periodOptions: ComputedRef<Array<{ label: string; value: string }>> = computed(() => {
    const { t } = this.localeStore;
    const labels: Record<string, string> = {
      day: t.cacheAdmin.periodDay,
      month: t.cacheAdmin.periodMonth,
      year: t.cacheAdmin.periodYear,
      static: t.cacheAdmin.periodStatic,
    };
    return [
      { label: t.cacheAdmin.allPeriods, value: '' },
      ...CACHE_ADMIN_PERIODS.map((code) => ({ label: labels[code], value: code })),
    ];
  });

  /**
   * 新增模式下的身份字段
   * @type {ComputedRef<AutoFormField[]>}
   * @description 正文改由抽屉里的 JSON 编辑器 / Markdown 预览承载，不放在表单里
   */
  fields: ComputedRef<AutoFormField[]> = computed(() => {
    const { t } = this.localeStore;
    return [
      {
        name: 'table',
        label: t.cacheAdmin.fieldTable,
        type: 'select',
        options: this.tables.value.map((item) => ({ label: item.name, value: item.name })),
        rules: [{ required: true, message: t.common.required }],
      },
      {
        name: 'section',
        label: t.cacheAdmin.fieldSection,
        type: 'input',
        placeholder: t.cacheAdmin.fieldSection,
      },
      {
        name: 'key',
        label: t.cacheAdmin.fieldKey,
        type: 'input',
        rules: [{ required: true, message: t.common.required }],
      },
    ];
  });

  /**
   * 是否允许编辑缓存数据
   * @returns {boolean} 是否拥有 cache:edit
   * @description 页面查看由 cache:view 保护，写入由路由元数据推导出 cache:edit
   */
  canEditCache = (): boolean => this.canEdit();

  /**
   * 把正文格式化为可读 JSON
   * @param {string} body - 原始正文
   * @returns {string} 可解析时缩进后的 JSON，否则原文
   * @description 展平表的 data 可能是纯文本，解析失败时保持原样
   */
  private formatBody = (body: string): string => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  };

  /**
   * 加载当前筛选条件下的缓存行
   * @returns {Promise<void>} 无返回值
   * @description 列表接口一次性返回当前页、总数与表清单
   */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const res = await this.service.fetchEntries({
        table: this.table.value || undefined,
        periodType: this.periodType.value || undefined,
        keyword: this.keyword.value.trim() || undefined,
        limit: this.pageSize,
        offset: (this.page.value - 1) * this.pageSize,
      });
      this.rows.value = res.data.result.items;
      this.total.value = res.data.result.total;
      this.tables.value = res.data.result.tables;
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
   * @description 顶部刷新按钮调用，保持当前筛选与页码
   */
  refresh = (): Promise<void> => this.load();

  /** 提交关键字搜索，重置到第一页 */
  handleSearch = (): void => {
    this.page.value = 1;
    void this.load();
  };

  /** 重置全部筛选条件并重新查询 */
  resetFilters = (): void => {
    this.table.value = '';
    this.periodType.value = '';
    this.keyword.value = '';
    this.page.value = 1;
    void this.load();
  };

  /** 切换表筛选，重置到第一页 */
  handleTableChange = (): void => {
    this.page.value = 1;
    void this.load();
  };

  /** 切换粒度筛选，重置到第一页 */
  handlePeriodChange = (): void => {
    this.page.value = 1;
    void this.load();
  };

  /**
   * 翻页
   * @param {{ current: number }} pagination - TDesign 分页变更上下文
   * @returns {void} 无返回值
   */
  onPageChange = (pagination: { current: number }): void => {
    this.page.value = pagination.current;
    void this.load();
  };

  /**
   * 打开新增抽屉
   * @returns {void} 无返回值
   * @description 默认落到第一张分类表，正文预填空 JSON 对象
   */
  openCreate = (): void => {
    if (!this.canEditCache()) return;
    const firstRes = this.tables.value.find((item) => item.kind === 'res');
    this.editing.value = null;
    this.isCreate.value = true;
    this.formData.value = {
      table: firstRes?.name ?? '',
      section: '',
      key: '',
      body: '{}',
    };
    this.drawerVisible.value = true;
  };

  /**
   * 打开编辑抽屉并读取正文全文
   * @param {CacheAdminEntry} row - 待编辑的记录
   * @returns {Promise<void>} 无返回值
   * @description 列表只带预览，编辑前按表 / section / 键拉取全文
   */
  openEdit = async (row: CacheAdminEntry): Promise<void> => {
    if (!this.canEditCache()) return;
    this.detailLoading.value = true;
    try {
      const res = await this.service.fetchEntry({
        table: row.table,
        section: row.section,
        key: row.entryKey,
      });
      const detail = res.data.result;
      this.editing.value = row;
      this.isCreate.value = false;
      this.formData.value = {
        table: detail.table,
        section: detail.section,
        key: detail.entryKey,
        body: this.formatBody(detail.body),
      };
      this.drawerVisible.value = true;
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.detailLoading.value = false;
    }
  };

  /**
   * 保存新增或编辑的缓存行
   * @returns {Promise<void>} 无返回值
   * @description 分类表正文必须是合法 JSON；展平表 data 允许纯文本
   */
  submitEdit = async (): Promise<void> => {
    if (!this.canEditCache()) return;
    const payload: CacheAdminWritePayload = {
      table: String(this.formData.value.table ?? ''),
      section: String(this.formData.value.section ?? ''),
      key: String(this.formData.value.key ?? ''),
      body: String(this.formData.value.body ?? ''),
    };
    if (!payload.table || !payload.key || !payload.body) {
      MessagePlugin.warning(this.localeStore.t.common.required);
      return;
    }
    if (!CACHE_ADMIN_FLAT_TABLES.includes(payload.table)) {
      try {
        JSON.parse(payload.body);
      } catch {
        MessagePlugin.warning(this.localeStore.t.cacheAdmin.invalidJson);
        return;
      }
    }
    this.saving.value = true;
    try {
      await this.service.saveEntry(payload);
      MessagePlugin.success(this.localeStore.t.common.saveSuccess);
      this.drawerVisible.value = false;
      await this.load();
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.saveFailed);
    } finally {
      this.saving.value = false;
    }
  };

  /**
   * 删除一条缓存行
   * @param {CacheAdminEntry} row - 待删除的记录
   * @returns {Promise<void>} 无返回值
   * @description 删除后若当前页已空且不是第一页，则回退一页
   */
  remove = async (row: CacheAdminEntry): Promise<void> => {
    if (!this.canEditCache()) return;
    try {
      await this.service.deleteEntry({
        table: row.table,
        section: row.section,
        key: row.entryKey,
      });
      MessagePlugin.success(this.localeStore.t.common.deleteSuccess);
      if (this.rows.value.length === 1 && this.page.value > 1) this.page.value -= 1;
      await this.load();
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.deleteFailed);
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
 * @description 将 CacheAdminModel 类包装为 Composition API 可用的函数
 */
export const useCacheAdminModel = () => {
  const model = new CacheAdminModel();
  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());
  return { ...model };
};
