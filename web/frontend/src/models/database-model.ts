import { computed, onMounted, onBeforeUnmount, ref, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { DatabaseService } from '@/services/database-service';
import { DATABASE_PREVIEW_LIMIT } from '@/constants/database';
import { buildResultColumns, buildResultRows } from '@/utils/database';
import type { AutoFormField } from '@/types/auto-form';
import type {
  DatabaseStatus,
  DatabaseTable,
  DatabaseTableSchema,
  DatabaseScriptFile,
  SqlExecution,
} from '@/types/database';

/**
 * 数据库管理页面数据模型类
 * @description 管理连接状态、库表浏览、SQL 控制台、建表脚本查看与高危初始化操作
 */
export class DatabaseModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * 数据库管理服务实例
   * @type {DatabaseService}
   * @description 封装所有数据库管理相关 HTTP 接口
   */
  service: DatabaseService = new DatabaseService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 数据库连接状态
   * @type {Ref<DatabaseStatus | null>}
   * @description null 表示尚未加载完成
   */
  status: Ref<DatabaseStatus | null> = ref(null);

  /**
   * 库表清单
   * @type {Ref<DatabaseTable[]>}
   * @description 当前库的全部表与视图
   */
  tables: Ref<DatabaseTable[]> = ref([]);

  /**
   * 表名搜索关键字
   * @type {Ref<string>}
   * @description 用于左侧列表本地过滤
   */
  tableKeyword: Ref<string> = ref('');

  /**
   * 当前选中的表名
   * @type {Ref<string>}
   * @description 空串表示尚未选中任何表
   */
  selectedTable: Ref<string> = ref('');

  /**
   * 当前选中表的结构
   * @type {Ref<DatabaseTableSchema | null>}
   * @description 含字段、索引与建表语句
   */
  schema: Ref<DatabaseTableSchema | null> = ref(null);

  /**
   * 当前选中表的数据预览
   * @type {Ref<SqlExecution | null>}
   * @description 按页返回的前 100 行数据
   */
  preview: Ref<SqlExecution | null> = ref(null);

  /**
   * 数据预览偏移量
   * @type {Ref<number>}
   * @description 翻页时按每页行数递增或递减
   */
  previewOffset: Ref<number> = ref(0);

  /**
   * 右侧详情当前标签页
   * @type {Ref<string>}
   * @description 取值为 schema / rows / ddl
   */
  activeTab: Ref<string> = ref('schema');

  /**
   * 建表脚本清单
   * @type {Ref<DatabaseScriptFile[]>}
   * @description helper_database.sql 与 sql/ 目录下的全部脚本
   */
  scripts: Ref<DatabaseScriptFile[]> = ref([]);

  /**
   * 建表脚本搜索关键字
   * @type {Ref<string>}
   * @description 用于左侧脚本列表本地模糊过滤
   */
  scriptKeyword: Ref<string> = ref('');

  /**
   * 当前查看的脚本路径
   * @type {Ref<string>}
   * @description 相对项目根的路径
   */
  selectedScript: Ref<string> = ref('');

  /**
   * 当前查看的脚本正文
   * @type {Ref<string>}
   * @description 只读展示，不允许在页面编辑
   */
  scriptContent: Ref<string> = ref('');

  /**
   * SQL 控制台输入内容
   * @type {Ref<string>}
   * @description 用户输入的单条 SQL 语句
   */
  sqlText: Ref<string> = ref('');

  /**
   * SQL 执行结果
   * @type {Ref<SqlExecution | null>}
   * @description 最近一次只读查询或写 SQL 的结果
   */
  queryResult: Ref<SqlExecution | null> = ref(null);

  /**
   * SQL 执行中标记
   * @type {Ref<boolean>}
   * @description 防止重复提交
   */
  running: Ref<boolean> = ref(false);

  /**
   * 初始化确认抽屉显隐
   * @type {Ref<boolean>}
   * @description 高危操作，需输入库名二次确认
   */
  initDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 初始化提交中标记
   * @type {Ref<boolean>}
   * @description 建表脚本可能耗时较久，按钮显示 loading
   */
  initLoading: Ref<boolean> = ref(false);

  /**
   * 初始化确认表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 与 auto-form 的 modelValue 契约对齐，仅需填写当前数据库名
   */
  initFormData: Ref<Record<string, unknown>> = ref({ confirmName: '' });

  // ==============================
  // 计算属性（get）
  // ==============================

  /**
   * 按关键字过滤后的表清单
   * @type {ComputedRef<DatabaseTable[]>}
   * @description 仅本地过滤，不触发接口请求
   */
  filteredTables: ComputedRef<DatabaseTable[]> = computed(() => {
    const keyword = this.tableKeyword.value.trim().toLowerCase();
    if (!keyword) return this.tables.value;
    return this.tables.value.filter((table) => table.name.toLowerCase().includes(keyword));
  });

  /**
   * 按关键字过滤后的脚本清单
   * @type {ComputedRef<DatabaseScriptFile[]>}
   * @description 空格分隔多词按 AND 匹配路径与模块名，仅本地过滤，不触发接口请求
   */
  filteredScripts: ComputedRef<DatabaseScriptFile[]> = computed(() => {
    const terms = this.scriptKeyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return this.scripts.value;
    return this.scripts.value.filter((script) => {
      const text = `${script.path} ${script.module}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    });
  });

  /**
   * 当前数据库名
   * @type {ComputedRef<string>}
   * @description 未加载状态时返回空串
   */
  databaseName: ComputedRef<string> = computed(() => this.status.value?.database ?? '');

  /**
   * 结构标签页的字段列配置
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 跟随语言切换刷新列标题
   */
  schemaColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { colKey: 'field', title: t.database.colField, width: 180 },
      { colKey: 'type', title: t.database.colType, width: 170 },
      { colKey: 'nullable', title: t.database.colNullable, width: 90 },
      { colKey: 'key', title: t.database.colKey, width: 90 },
      { colKey: 'default', title: t.database.colDefault, width: 140, ellipsis: true },
      { colKey: 'extra', title: t.database.colExtra, width: 130 },
      { colKey: 'comment', title: t.database.colComment, ellipsis: true },
    ];
  });

  /**
   * 索引表格列配置
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 跟随语言切换刷新列标题
   */
  indexColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { colKey: 'name', title: t.database.colIndexName, width: 180 },
      { colKey: 'column', title: t.database.colIndexColumn, width: 180 },
      { colKey: 'unique', title: t.database.colIndexUnique, width: 90 },
      { colKey: 'seq', title: t.database.colIndexSeq, width: 90 },
    ];
  });

  /**
   * 索引表格行数据
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 把唯一标记转换为本地化的是/否文本
   */
  indexRows: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return (this.schema.value?.indexes ?? []).map((item) => ({
      name: item.name,
      column: item.column,
      unique: item.unique ? t.common.yes : t.common.no,
      seq: item.seq,
    }));
  });

  /**
   * 数据预览列配置
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 由结果集列名动态生成
   */
  previewColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => buildResultColumns(this.preview.value));

  /**
   * 数据预览行数据
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 由结果集二维行数组转换为表格行对象
   */
  previewRows: ComputedRef<Array<Record<string, unknown>>> = computed(() => buildResultRows(this.preview.value));

  /**
   * SQL 结果列配置
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 由结果集列名动态生成
   */
  queryColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => buildResultColumns(this.queryResult.value));

  /**
   * SQL 结果行数据
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 由结果集二维行数组转换为表格行对象
   */
  queryRows: ComputedRef<Array<Record<string, unknown>>> = computed(() => buildResultRows(this.queryResult.value));

  /**
   * 初始化确认表单字段
   * @type {ComputedRef<AutoFormField[]>}
   * @description 仅一个必填的输入框，提交时校验库名是否匹配
   */
  initFields: ComputedRef<AutoFormField[]> = computed(() => {
    const { t } = this.localeStore;
    const field: AutoFormField = {
      name: 'confirmName',
      label: t.database.initConfirmLabel,
      type: 'input',
      placeholder: t.database.initConfirmPlaceholder,
      help: t.database.initConfirmHelp(this.databaseName.value),
    };
    return [field];
  });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 统一展示接口错误信息
   * @param {unknown} err - 捕获的异常
   * @description 优先展示后端 returnResponse 的 message，回退到异常文本
   */
  private showError = (err: unknown): void => {
    const apiError = err as { response?: { data?: { message?: string } }; message?: string };
    const message = apiError?.response?.data?.message
      ?? apiError?.message
      ?? this.localeStore.t.common.operationFailedRetry;
    MessagePlugin.error(message);
  };

  /**
   * 加载数据库连接状态
   * @description 失败时状态由后端返回 connected=false，不额外弹提示
   */
  loadStatus = async (): Promise<void> => {
    try {
      const res = await this.service.fetchStatus();
      this.status.value = res.data.status;
    } catch (err) {
      this.showError(err);
    }
  };

  /**
   * 加载库表清单
   * @description 首次加载或选中表失效时自动选中第一张表
   */
  loadTables = async (): Promise<void> => {
    try {
      const res = await this.service.fetchTables();
      const tables = res.data.tables;
      this.tables.value = tables;
      const stillExists = tables.some((table) => table.name === this.selectedTable.value);
      if (tables.length > 0 && !stillExists) {
        await this.selectTable(tables[0].name);
      }
    } catch (err) {
      this.showError(err);
    }
  };

  /**
   * 选中一张表并加载结构与数据
   * @param {string} name - 表名或视图名
   * @description 重置分页偏移量，并行拉取结构与首页数据
   */
  selectTable = async (name: string): Promise<void> => {
    this.selectedTable.value = name;
    this.previewOffset.value = 0;
    await Promise.all([this.loadSchema(name), this.loadPreview()]);
  };

  /**
   * 加载当前选中表的结构
   * @param {string} name - 表名或视图名
   */
  private loadSchema = async (name: string): Promise<void> => {
    try {
      const res = await this.service.fetchTableSchema(name);
      this.schema.value = res.data.schema;
    } catch (err) {
      this.showError(err);
    }
  };

  /**
   * 加载当前选中表的数据预览
   * @description 使用当前偏移量按页拉取
   */
  loadPreview = async (): Promise<void> => {
    if (!this.selectedTable.value) return;
    try {
      const res = await this.service.fetchTableRows(
        this.selectedTable.value,
        DATABASE_PREVIEW_LIMIT,
        this.previewOffset.value,
      );
      this.preview.value = res.data.result;
    } catch (err) {
      this.showError(err);
    }
  };

  /**
   * 数据预览翻页
   * @param {number} delta - 1 表示下一页，-1 表示上一页
   * @description 偏移量不会小于 0
   */
  changePage = async (delta: number): Promise<void> => {
    const next = Math.max(0, this.previewOffset.value + delta * DATABASE_PREVIEW_LIMIT);
    if (next === this.previewOffset.value) return;
    this.previewOffset.value = next;
    await this.loadPreview();
  };

  /**
   * 加载建表脚本清单
   * @description 默认展开入口聚合脚本 helper_database.sql
   */
  loadScripts = async (): Promise<void> => {
    try {
      const res = await this.service.fetchScripts();
      this.scripts.value = res.data.scripts;
      if (!this.selectedScript.value && res.data.scripts.length > 0) {
        await this.selectScript(res.data.scripts[0].path);
      }
    } catch (err) {
      this.showError(err);
    }
  };

  /**
   * 查看单个建表脚本内容
   * @param {string} scriptPath - 相对项目根的脚本路径
   */
  selectScript = async (scriptPath: string): Promise<void> => {
    try {
      const res = await this.service.fetchScript(scriptPath);
      this.selectedScript.value = res.data.path;
      this.scriptContent.value = res.data.content;
    } catch (err) {
      this.showError(err);
    }
  };

  /**
   * 执行 SQL（只读查询或写语句）
   * @param {'query' | 'execute'} mode - query 走只读接口，execute 走写接口
   * @description 写语句执行成功后刷新表清单，便于立即看到 DDL 变更
   */
  private runSql = async (mode: 'query' | 'execute'): Promise<void> => {
    const sql = this.sqlText.value.trim();
    if (!sql) {
      MessagePlugin.warning(this.localeStore.t.database.sqlRequired);
      return;
    }
    this.running.value = true;
    try {
      const res = mode === 'query'
        ? await this.service.runQuery(sql)
        : await this.service.executeSql(sql);
      this.queryResult.value = res.data.result;
      if (mode === 'execute') void this.loadTables();
    } catch (err) {
      this.showError(err);
    } finally {
      this.running.value = false;
    }
  };

  /**
   * 执行只读查询
   * @description 调用 /database/query，按 view 权限放行
   */
  runQuery = async (): Promise<void> => {
    await this.runSql('query');
  };

  /**
   * 执行写 SQL
   * @description 调用 /database/execute，仅超级管理员可用
   */
  executeSql = async (): Promise<void> => {
    await this.runSql('execute');
  };

  /**
   * 打开初始化确认抽屉
   * @description 每次打开都清空上次输入，避免误提交
   */
  openInitDrawer = (): void => {
    this.initFormData.value = { confirmName: '' };
    this.initDrawerVisible.value = true;
  };

  /**
   * 提交数据库初始化
   * @description 校验库名完全一致后执行 helper_database.sql，成功后刷新全部数据
   */
  submitInit = async (): Promise<void> => {
    const { t } = this.localeStore;
    const confirmName = String(this.initFormData.value.confirmName ?? '').trim();
    if (!confirmName) {
      MessagePlugin.warning(t.database.initNameRequired);
      return;
    }
    if (confirmName !== this.databaseName.value) {
      MessagePlugin.warning(t.database.initNameMismatch);
      return;
    }
    this.initLoading.value = true;
    try {
      const res = await this.service.initialize(confirmName);
      const { files, elapsedMs } = res.data.result;
      MessagePlugin.success(t.database.initSuccess(files, elapsedMs));
      this.initDrawerVisible.value = false;
      await this.refreshAll();
    } catch (err) {
      this.showError(err);
    } finally {
      this.initLoading.value = false;
    }
  };

  /**
   * 刷新页面全部数据
   * @description 并行加载连接状态、表清单与脚本清单
   */
  refreshAll = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      await Promise.all([this.loadStatus(), this.loadTables(), this.loadScripts()]);
    } finally {
      this.pageLoading.value = false;
    }
  };

  // ==============================
  // 生命周期
  // ==============================

  /**
   * 组件挂载时加载全部概览数据
   */
  mounted = (): void => {
    void this.refreshAll();
  };

  /**
   * 组件卸载时清理状态（当前无定时器）
   */
  beforeUnmount = (): void => {};
}

/**
 * Composition API 包装函数
 * @description 将 DatabaseModel 类包装为 Composition API 可用的函数
 */
export const useDatabaseModel = () => {
  const model = new DatabaseModel();
  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());
  return { ...model };
};
