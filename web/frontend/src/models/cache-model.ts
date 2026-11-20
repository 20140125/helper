import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { CacheService } from '@/services/cache-service';
import type { CacheFile } from '@/types/cache';
import { BaseModel } from '@/models/base-model';
import { MessagePlugin } from 'tdesign-vue-next';

/**
 * 缓存管理页面数据模型类
 * @description 管理缓存文件列表查看、内容编辑、保存等业务逻辑，支持JSON格式化和验证
 */
export class CacheModel extends BaseModel {
  // ==============================
  // 依赖注入
  // ==============================

  /**
   * 路由实例
   * @type {ReturnType<typeof useRoute>}
   * @description 用于访问路由参数和导航
   */
  route: ReturnType<typeof useRoute> = useRoute();

  /**
   * 缓存服务实例
   * @type {CacheService}
   * @description 用于缓存文件的查询、读取和保存
   */
  private cacheService: CacheService = new CacheService();

  /**
   * 消息插件实例
   * @type {typeof MessagePlugin}
   * @description 用于显示用户提示消息
   */
  messagePlugin: typeof MessagePlugin = MessagePlugin;

  // ==============================
  // 状态变量
  // ==============================

  /**
   * 缓存文件列表
   * @type {Ref<CacheFile[]>}
   * @description 存储系统中所有可用的缓存文件信息
   */
  files: Ref<CacheFile[]> = ref<CacheFile[]>([]);

  /**
   * 当前选中的文件名
   * @type {Ref<string>}
   * @description 当前正在查看或编辑的缓存文件名
   */
  selectedFile: Ref<string> = ref('');

  /**
   * 文件原始内容
   * @type {Ref<string>}
   * @description 缓存文件的原始内容，用于内容比较和恢复
   */
  fileRawContent: Ref<string> = ref('');

  /**
   * 文件原始内容备份
   * @type {Ref<string>}
   * @description 用于检测内容是否被修改的原始内容备份
   */
  originalContent: Ref<string> = ref('');

  /**
   * 内容是否被修改
   * @type {Ref<boolean>}
   * @description 检测当前文件内容是否与原始内容不同
   */
  isDirty: Ref<boolean> = ref(false);

  /**
   * JSON格式错误状态
   * @type {Ref<boolean>}
   * @description 检测当前文件内容是否存在JSON格式错误
   */
  hasJsonError: Ref<boolean> = ref(false);

  /**
   * 文件内容编辑器引用
   * @type {Ref<{ getContent: () => string } | null>}
   * @description 编辑器组件的引用，用于获取当前编辑内容
   */
  fileContentRef: Ref<{ getContent: () => string } | null> = ref(null);


  // ==============================
  // 公共方法
  // ==============================

  /**
   * 编辑器内容变化处理
   * @param {string} content - 当前编辑器内容
   * @param {boolean} hasError - 是否存在JSON格式错误
   * @returns {void}
   * @description 监听编辑器内容变化，更新脏数据状态和错误状态
   */
  handleEditorChange = (content: string, hasError: boolean): void => {
    this.isDirty.value = content !== this.originalContent.value;
    this.hasJsonError.value = hasError;
  };

  /**
   * 加载文件列表
   * @returns {Promise<void>}
   * @description 从服务端获取缓存文件列表并更新files状态
   */
  loadFileList = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { data: { files } } = await this.cacheService.fetchCacheFiles();
      this.files.value = files;
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 加载文件内容
   * @param {string} filename - 要加载的文件名
   * @returns {Promise<void>}
   * @description 从服务端获取指定缓存文件的内容，并进行JSON格式化处理
   */
  loadFileContent = async (filename: string): Promise<void> => {
    this.pageLoading.value = true;
    this.hasJsonError.value = false;
    try {
      const { data: { content } } = await this.cacheService.fetchCacheFileContent(filename);
      let formatted = content;
      try {
        const parsed = JSON.parse(content);
        formatted = JSON.stringify(parsed, null, 2);
      } catch {
        // 保持原始内容
      }
      this.originalContent.value = formatted;
      this.fileRawContent.value = formatted;
      this.isDirty.value = false;
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 选择文件
   * @param {string} filename - 要选择的文件名
   * @returns {Promise<void>}
   * @description 切换当前选中的文件，如果有未保存的修改会提示用户确认
   */
  selectFile = async (filename: string): Promise<void> => {
    if (this.selectedFile.value === filename) return;
    if (this.isDirty.value) {
      const confirmed = window.confirm(this.localeStore.t.cache.unsavedConfirm);
      if (!confirmed) return;
    }
    this.selectedFile.value = filename;
    await this.loadFileContent(filename);
  };

  /**
   * 保存文件
   * @param {() => string} getContent - 获取编辑器内容的函数
   * @returns {Promise<void>}
   * @description 将编辑器内容保存到服务端，包含JSON格式验证和错误处理
   */
  saveFile = async (getContent: () => string): Promise<void> => {
    if (!this.selectedFile.value || !this.isDirty.value) return;
    if (this.hasJsonError.value) {
      this.messagePlugin.error(this.localeStore.t.cache.jsonError);
      return;
    }
    const content = getContent();
    if (!content || !content.trim()) {
      this.messagePlugin.error(this.localeStore.t.cache.emptyError);
      return;
    }
    this.pageLoading.value = true;
    try {
      await this.cacheService.saveCacheFile(this.selectedFile.value, content);
      this.originalContent.value = content;
      this.isDirty.value = false;
      this.messagePlugin.success(this.localeStore.t.common.saveSuccess);
      await this.loadFileList();
    } catch (e: unknown) {
      const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      this.messagePlugin.error(apiMessage || this.localeStore.t.common.saveFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 处理保存操作
   * @returns {Promise<void>}
   * @description 通过编辑器引用获取内容并执行保存操作
   */
  handleSave = async (): Promise<void> => {
    if (!this.fileContentRef.value) {
      this.messagePlugin.error(this.localeStore.t.cache.editorNotReady);
      return;
    }
    await this.saveFile(() => this.fileContentRef.value!.getContent());
  };

  /**
   * 初始化方法
   * @returns {Promise<void>}
   * @description 页面挂载时初始化数据，加载文件列表并根据路由参数选择文件
   */
  init = async (): Promise<void> => {
    await this.loadFileList();
    const fileParam = this.route.query.file as string | undefined;
    if (fileParam && this.files.value.some((f) => f.name === fileParam)) {
      await this.selectFile(fileParam);
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 初始化数据并启动窗口 resize 监听
   */
  mounted = (): void => {
    this.init();
    this.startResizeListener();
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
 * @description 将CacheModel类包装为Composition API可用的函数
 */
export const useCacheModel = () => {
  const model = new CacheModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => { model.mounted(); });

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {
    ...model,
  };
};
