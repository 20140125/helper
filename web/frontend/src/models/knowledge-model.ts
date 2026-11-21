import { computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { KnowledgeService } from '@/services/knowledge-service';
import type { AutoFormField } from '@/types/auto-form';
import { FormMode } from '@/constants/form';
import type {
  KnowledgeDoc,
  KnowledgeConfig,
  KnowledgeHit,
  KnowledgeDocFormData,
  KnowledgeDirsFormData,
} from '@/types/knowledge';

/**
 * 知识库管理页面数据模型类
 * @description 管理知识文档的列表/新建/编辑/删除、索引重建、检索测试与索引目录配置
 */
export class KnowledgeModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * 知识库服务实例
   * @type {KnowledgeService}
   * @description 用于文档 CRUD、索引与检索接口调用
   */
  service: KnowledgeService = new KnowledgeService();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 用户维护的知识文档列表
   * @type {Ref<KnowledgeDoc[]>}
   * @description 来自 knowledge/ 目录下的 Markdown 文件元信息
   */
  docs: Ref<KnowledgeDoc[]> = ref([]);

  /**
   * 索引目录配置
   * @type {Ref<KnowledgeConfig>}
   * @description 控制检索时扫描哪些项目根相对目录
   */
  config: Ref<KnowledgeConfig> = ref({ dirs: [], updated_at: '' });

  /**
   * 文档编辑抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制新建/编辑文档抽屉的展开
   */
  docDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前正在编辑的文档
   * @type {Ref<KnowledgeDoc | null>}
   * @description 为 null 时表示新建态，非 null 时表示编辑态
   */
  editingDoc: Ref<KnowledgeDoc | null> = ref(null);

  /**
   * 文档编辑表单数据
   * @type {Ref<KnowledgeDocFormData>}
   * @description 抽屉内 AutoForm 的 v-model 绑定值
   */
  docFormData: Ref<KnowledgeDocFormData> = ref({ name: '', content: '' });

  /**
   * 索引目录抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制索引目录配置抽屉的展开
   */
  dirsDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 索引目录表单数据
   * @type {Ref<KnowledgeDirsFormData>}
   * @description 以逗号分隔文本承载目录列表，提交时拆分为数组
   */
  dirsFormData: Ref<KnowledgeDirsFormData> = ref({ dirsText: '' });

  /**
   * 检索关键词
   * @type {Ref<string>}
   * @description 检索测试输入框的绑定值
   */
  searchQuery: Ref<string> = ref('');

  /**
   * 检索命中片段
   * @type {Ref<KnowledgeHit[]>}
   * @description 最近一次检索测试返回的片段列表
   */
  searchHits: Ref<KnowledgeHit[]> = ref([]);

  /**
   * 是否执行过检索
   * @type {Ref<boolean>}
   * @description 用于区分「尚未检索」与「检索无结果」两种空态
   */
  searchPerformed: Ref<boolean> = ref(false);

  /**
   * 检索请求进行中
   * @type {Ref<boolean>}
   * @description 防止重复点击检索按钮
   */
  searching: Ref<boolean> = ref(false);

  /**
   * 最近一次索引重建统计
   * @type {Ref<{ chunkCount: number; sources: number } | null>}
   * @description 为 null 表示当前会话尚未执行重建
   */
  reindexInfo: Ref<{ chunkCount: number; sources: number } | null> = ref(null);

  // ==============================
  // 计算属性（get）
  // ==============================

  /**
   * 文档表格列定义
   * @returns {ComputedRef<Array<Record<string, unknown>>>} 表格列配置
   */
  get docColumns(): ComputedRef<Array<Record<string, unknown>>> {
    return computed(() => {
      const { t } = this.localeStore;
      return [
        { colKey: 'name', title: t.knowledgeBase.colName, width: 260 },
        { colKey: 'typeLabel', title: t.knowledgeBase.colType, width: 110 },
        { colKey: 'path', title: t.knowledgeBase.colPath, ellipsis: true },
        { colKey: 'sizeText', title: t.knowledgeBase.colSize, width: 110 },
        { colKey: 'updated_at', title: t.knowledgeBase.colUpdatedAt, width: 190 },
        { colKey: 'actions', title: t.knowledgeBase.colActions, width: 150, fixed: 'right' },
      ];
    });
  }

  /**
   * 文档抽屉当前模式
   * @returns {ComputedRef<FormMode>} 编辑态返回 Edit，否则返回 Create
   */
  get docFormMode(): ComputedRef<FormMode> {
    return computed(() => (this.editingDoc.value ? FormMode.Edit : FormMode.Create));
  }

  /**
   * 索引目录抽屉表单模式
   * @returns {ComputedRef<FormMode>} 固定为 Edit，仅复用表单外观
   */
  get dirsFormMode(): ComputedRef<FormMode> {
    return computed(() => FormMode.Edit);
  }

  /**
   * 索引目录表单字段
   * @returns {ComputedRef<AutoFormField[]>} 表单字段配置
   */
  get dirsFormFields(): ComputedRef<AutoFormField[]> {
    return computed(() => {
      const { t } = this.localeStore;
      return [{
        name: 'dirsText',
        label: t.knowledgeBase.fieldDirs,
        type: 'textarea',
        placeholder: t.knowledgeBase.fieldDirsPlaceholder,
        help: t.knowledgeBase.fieldDirsHelp,
        autosize: { minRows: 4, maxRows: 10 },
        rules: [{ required: true, message: t.common.required }],
      }];
    });
  }

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 加载知识库概览（文档列表 + 索引目录配置）
   * @param {boolean} [silent] - 静默加载，不显示页面级 loading
   * @description 同时预处理类型标签与大小文本，供表格直接展示
   */
  loadOverview = async (silent: boolean = false): Promise<void> => {
    if (!silent) this.pageLoading.value = true;
    try {
      const res = await this.service.fetchOverview();
      const { t } = this.localeStore;
      this.docs.value = res.data.docs.map((doc) => ({
        ...doc,
        typeLabel: doc.readonly ? t.knowledgeBase.typeSystem : t.knowledgeBase.typeUser,
        sizeText: this.formatSize(doc.size),
      }));
      this.config.value = res.data.config;
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 打开新建文档抽屉
   */
  openCreateDoc = (): void => {
    this.editingDoc.value = null;
    this.docFormData.value = { name: '', content: '' };
    this.docDrawerVisible.value = true;
  };

  /**
   * 打开编辑文档抽屉
   * @param {KnowledgeDoc} doc - 要编辑的文档
   * @description 先从服务端读取正文再回填，避免只拿到元信息
   */
  openEditDoc = async (doc: KnowledgeDoc): Promise<void> => {
    if (doc.readonly) return;
    try {
      const res = await this.service.fetchDocContent(doc.path);
      this.editingDoc.value = doc;
      this.docFormData.value = { name: doc.name, content: res.data.content };
      this.docDrawerVisible.value = true;
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    }
  };

  /**
   * 关闭文档编辑抽屉
   */
  closeDocDrawer = (): void => {
    this.docDrawerVisible.value = false;
    this.editingDoc.value = null;
    this.docFormData.value = { name: '', content: '' };
  };

  /**
   * 提交文档编辑表单
   * @description 新建或覆盖文档；成功后关闭抽屉并刷新列表
   */
  submitDocForm = async (): Promise<void> => {
    const form = this.docFormData.value;
    if (!form.name?.trim() || !form.content?.trim()) {
      MessagePlugin.warning(this.localeStore.t.common.required);
      return;
    }
    this.pageLoading.value = true;
    try {
      if (this.editingDoc.value) {
        await this.service.updateDoc(this.editingDoc.value.path, { content: form.content });
        MessagePlugin.success(this.localeStore.t.common.updateSuccess);
      } else {
        await this.service.createDoc({ name: form.name.trim(), content: form.content });
        MessagePlugin.success(this.localeStore.t.common.createSuccess);
      }
      this.closeDocDrawer();
      await this.loadOverview(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 删除指定用户文档
   * @param {string} docPath - 文档相对路径
   */
  removeDoc = async (docPath: string): Promise<void> => {
    try {
      await this.service.deleteDoc(docPath);
      MessagePlugin.success(this.localeStore.t.common.deleteSuccess);
      await this.loadOverview(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.deleteFailedRetry);
    }
  };

  /**
   * 导入系统文档为用户文档副本
   * @param {KnowledgeDoc} doc - 系统文档元信息
   * @description 原系统文档保持不变，导入后可在用户文档中编辑或删除
   */
  importDoc = async (doc: KnowledgeDoc): Promise<void> => {
    try {
      await this.service.importDoc(doc.path);
      MessagePlugin.success(this.localeStore.t.knowledgeBase.importSuccess);
      await this.loadOverview(true);
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    }
  };

  /**
   * 打开索引目录配置抽屉
   */
  openDirsDrawer = (): void => {
    this.dirsFormData.value = { dirsText: this.config.value.dirs.join(',') };
    this.dirsDrawerVisible.value = true;
  };

  /**
   * 关闭索引目录配置抽屉
   */
  closeDirsDrawer = (): void => {
    this.dirsDrawerVisible.value = false;
    this.dirsFormData.value = { dirsText: '' };
  };

  /**
   * 提交索引目录配置
   * @description 将逗号分隔文本拆分为目录数组，提交后刷新概览并重置索引统计
   */
  submitDirsForm = async (): Promise<void> => {
    const dirs = this.dirsFormData.value.dirsText
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    if (dirs.length === 0) {
      MessagePlugin.warning(this.localeStore.t.common.required);
      return;
    }
    this.pageLoading.value = true;
    try {
      const res = await this.service.updateDirs(dirs);
      this.config.value = res.data.config;
      this.reindexInfo.value = null;
      this.searchHits.value = [];
      this.searchPerformed.value = false;
      MessagePlugin.success(this.localeStore.t.common.updateSuccess);
      this.closeDirsDrawer();
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 重建知识索引
   * @description 重建后更新统计信息并清空旧的检索结果
   */
  handleReindex = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const res = await this.service.reindex();
      this.reindexInfo.value = res.data;
      this.searchHits.value = [];
      this.searchPerformed.value = false;
      const { t } = this.localeStore;
      MessagePlugin.success(t.knowledgeBase.reindexSuccess(res.data.chunkCount, res.data.sources));
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 执行检索测试
   */
  handleSearch = async (): Promise<void> => {
    const query = this.searchQuery.value.trim();
    if (!query) {
      MessagePlugin.warning(this.localeStore.t.common.required);
      return;
    }
    this.searching.value = true;
    try {
      const res = await this.service.search(query, 10);
      this.searchHits.value = res.data.hits;
      this.searchPerformed.value = true;
    } catch {
      MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.searching.value = false;
    }
  };

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 格式化文件大小为可读文本
   * @param {number} bytes - 字节数
   * @returns {string} 可读文本
   */
  private formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ==============================
  // 生命周期
  // ==============================

  /**
   * 组件挂载时加载知识库概览
   */
  mounted = (): void => {
    void this.loadOverview();
  };

  /**
   * 组件卸载时清理状态（当前无定时器）
   */
  beforeUnmount = (): void => {};
}

/**
 * Composition API 包装函数
 * @description 将 KnowledgeModel 类包装为 Composition API 可用的函数
 */
export const useKnowledgeModel = () => {
  const model = new KnowledgeModel();
  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());
  return {
    ...model,
    docColumns: model.docColumns,
    docFormMode: model.docFormMode,
    dirsFormMode: model.dirsFormMode,
    dirsFormFields: model.dirsFormFields,
  };
};
