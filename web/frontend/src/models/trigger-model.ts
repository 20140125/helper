import { ref, reactive, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import type { FormInstanceFunctions } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { TriggerService } from '@/services/trigger-service';
import type { ScriptItem, ScriptResultItem, ToolResultItem } from '@/types/trigger';
import type { UpdateToolKey, UpdateToolScript } from '@/types/update-tools';
import { TOOL_ICONS } from '@/constants/trigger';
import { BaseModel, Permission } from '@/models/base-model';

/**
 * 触发器页面数据模型类
 * @description 管理触发器页面的所有业务逻辑，包括脚本触发、更新工具管理、表单验证等
 */
export class TriggerModel extends BaseModel {
  // ==============================
  // 依赖注入（service）
  // ==============================

  /**
   * 触发器服务实例
   * @type {TriggerService}
   * @description 用于触发脚本和更新工具的API调用
   */
  triggerService: TriggerService = new TriggerService();

  // ==============================
  // 静态数据
  // ==============================

  /**
   * 工具图标映射
   * @type {typeof TOOL_ICONS}
   * @description 从 constants 提供的工具 key → 图标名称映射表
   */
  TOOL_ICONS: typeof TOOL_ICONS = TOOL_ICONS;

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 从后端加载的脚本列表（按 view 权限过滤后的）
   * @type {Ref<ScriptItem[]>}
   */
  scripts: Ref<ScriptItem[]> = ref<ScriptItem[]>([]);

  /**
   * 当前正在运行的脚本 key
   * @type {Ref<string>}
   */
  runningKey: Ref<string> = ref('');

  /**
   * 各脚本的执行结果（响应式对象，按 key 存储）
   * @type {Record<string, ScriptResultItem>}
   */
  scriptResults: Record<string, ScriptResultItem> = reactive<Record<string, ScriptResultItem>>({});

  /**
   * 更新工具脚本列表
   * @type {Ref<UpdateToolScript[]>}
   */
  updateTools: Ref<UpdateToolScript[]> = ref<UpdateToolScript[]>([]);

  /**
   * 更新工具面板是否展开
   * @type {Ref<boolean>}
   */
  updateToolsExpanded: Ref<boolean> = ref(false);

  /**
   * 当前展开的工具 key
   * @type {Ref<string>}
   */
  expandedTool: Ref<string> = ref('');

  /**
   * 当前正在运行的工具 key
   * @type {Ref<string>}
   */
  runningToolKey: Ref<string> = ref('');

  /**
   * 各工具的参数值（响应式对象，以字段名为 key）
   * @type {Record<string, Record<string, unknown>>}
   */
  toolArgs: Record<string, Record<string, unknown>> = reactive<Record<string, Record<string, unknown>>>({});

  /**
   * 各工具的执行结果（响应式对象）
   * @type {Record<string, ToolResultItem>}
   */
  toolResults: Record<string, ToolResultItem> = reactive<Record<string, ToolResultItem>>({});

  /**
   * 各工具的表单实例引用（响应式对象）
   * @type {Record<string, FormInstanceFunctions | null>}
   */
  toolFormRefs: Record<string, FormInstanceFunctions | null> = reactive<Record<string, FormInstanceFunctions | null>>({});

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 获取日常类脚本列表（从后端数据按 category 过滤）
   * @type {ComputedRef<ScriptItem[]>}
   */
  dailyScripts: ComputedRef<ScriptItem[]> = computed(
    () => this.scripts.value.filter((s) => s.category === 'daily'),
  );

  /**
   * 获取节日类脚本列表
   * @type {ComputedRef<ScriptItem[]>}
   */
  festivalScripts: ComputedRef<ScriptItem[]> = computed(
    () => this.scripts.value.filter((s) => s.category === 'festival'),
  );

  /**
   * 获取系统类脚本列表（排除 annual_update，它有独立的卡片）
   * @type {ComputedRef<ScriptItem[]>}
   */
  systemScripts: ComputedRef<ScriptItem[]> = computed(
    () => this.scripts.value.filter((s) => s.category === 'system' && s.key !== 'annual_update'),
  );

  /**
   * 年度数据更新脚本（从后端数据中查找）
   * @type {ComputedRef<ScriptItem | undefined>}
   */
  annualUpdateScript: ComputedRef<ScriptItem | undefined> = computed(
    () => this.scripts.value.find((s) => s.key === 'annual_update'),
  );

  /**
   * 是否显示年度数据更新卡片
   * @type {ComputedRef<boolean>}
   */
  showAnnualUpdate: ComputedRef<boolean> = computed(() => !!this.annualUpdateScript.value);

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 从后端加载脚本列表和更新工具列表
   * @returns {Promise<void>}
   */
  loadScripts = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const [scriptsData] = await Promise.all([
        this.triggerService.fetchScripts(),
        this.loadUpdateTools(),
      ]);
      this.scripts.value = scriptsData.data.scripts;
    } catch {
      MessagePlugin.error(this.localeStore.t.trigger.loadFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 触发执行指定脚本
   * @param {string} key - 脚本 key
   * @returns {Promise<void>}
   * @description 执行指定 key 的脚本，并更新最近执行结果
   */
  triggerRun = async (key: string): Promise<void> => {
    const script = this.scripts.value.find((s) => s.key === key);
    if (!script) return;

    const label = this.getScriptLabel(key);
    this.runningKey.value = key;
    this.pageLoading.value = true;
    try {
      const data = await this.triggerService.triggerScript(key);
      this.scriptResults[key] = {
        code: data.code,
        label,
        stdout: data.data.stdout,
        stderr: data.data.stderr,
        time: new Date().toLocaleString('zh-CN'),
      };
      MessagePlugin.success(this.localeStore.t.trigger.runSuccess(label));
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.localeStore.t.trigger.execFailed;
      this.scriptResults[key] = {
        code: -1,
        label,
        stdout: '',
        stderr: msg,
        time: new Date().toLocaleString('zh-CN'),
      };
      MessagePlugin.error(this.localeStore.t.trigger.runFailed(label));
    } finally {
      this.runningKey.value = '';
      this.pageLoading.value = false;
    }
  };

  /**
   * 清除指定脚本的执行结果
   * @param {string} key - 脚本 key
   * @returns {void}
   */
  clearScriptResult = (key: string): void => {
    delete this.scriptResults[key];
  };

  /**
   * 切换更新工具面板展开状态
   * @returns {void}
   */
  toggleUpdateTools = (): void => {
    this.updateToolsExpanded.value = !this.updateToolsExpanded.value;
  };

  /**
   * 执行年度数据更新工具
   * @returns {Promise<void>}
   * @description 触发年度数据更新脚本，并更新最近执行结果
   */
  runAnnualUpdate = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const data = await this.triggerService.triggerScript('annual_update');
      this.scriptResults['annual_update'] = {
        code: data.code,
        label: this.localeStore.t.trigger.annualUpdateLabel,
        stdout: data.data.stdout,
        stderr: data.data.stderr,
        time: new Date().toLocaleString('zh-CN'),
      };
      MessagePlugin.success(this.localeStore.t.trigger.annualUpdateSuccess);
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.localeStore.t.trigger.execFailed;
      this.scriptResults['annual_update'] = {
        code: -1,
        label: this.localeStore.t.trigger.annualUpdateLabel,
        stdout: '',
        stderr: msg,
        time: new Date().toLocaleString('zh-CN'),
      };
      MessagePlugin.error(this.localeStore.t.trigger.annualUpdateFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 切换工具展开状态
   * @param {string} key - 工具 key
   * @returns {void}
   */
  toggleTool = (key: string): void => {
    this.expandedTool.value = this.expandedTool.value === key ? '' : key;
  };

  /**
   * 设置工具表单实例引用
   * @param {string} key - 工具 key
   * @param {FormInstanceFunctions | null} formRef - 表单实例
   * @returns {void}
   */
  setToolFormRef = (key: string, formRef: FormInstanceFunctions | null): void => {
    this.toolFormRefs[key] = formRef;
  };

  /**
   * 执行指定更新工具
   * @param {UpdateToolScript} tool - 更新工具脚本对象
   * @returns {Promise<void>}
   * @description 执行前进行表单验证，自动注入 year 参数，并更新工具执行结果
   */
  toolTriggerRun = async (tool: UpdateToolScript): Promise<void> => {
    const passed = await this.validateToolForm(tool);
    if (!passed) return;

    const fullArgs = this.buildToolArgs(tool);

    this.runningToolKey.value = tool.key;
    this.pageLoading.value = true;
    try {
      const { code, data: { stdout, stderr } } = await this.triggerService.triggerUpdateTool(tool.key as UpdateToolKey, fullArgs);
      this.saveToolResult(tool, code === 0, stdout, stderr);
      MessagePlugin.success(this.localeStore.t.trigger.runSuccess(tool.label));
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.localeStore.t.trigger.execFailed;
      this.saveToolResult(tool, false, '', msg);
      MessagePlugin.error(this.localeStore.t.trigger.runFailed(tool.label));
    } finally {
      this.runningToolKey.value = '';
      this.pageLoading.value = false;
    }
  };

  /**
   * 更新工具参数
   * @param {string} key - 工具 key
   * @param {Record<string, unknown>} val - 新的参数对象
   * @returns {void}
   */
  updateToolArgs = (key: string, val: Record<string, unknown>): void => {
    this.toolArgs[key] = val;
  };

  /**
   * 清除指定工具的执行结果
   * @param {string} key - 工具 key
   * @returns {void}
   */
  clearToolResult = (key: string): void => {
    delete this.toolResults[key];
  };

  /**
   * 加载更新工具列表
   * @returns {Promise<void>}
   * @description 从服务端获取更新工具列表，并初始化各工具的参数
   */
  loadUpdateTools = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const { data: { scripts } } = await this.triggerService.fetchUpdateTools();
      this.updateTools.value = scripts;
      scripts.forEach((tool) => {
        if (!this.toolArgs[tool.key]) {
          // 只为非 year 参数初始化 toolArgs，以字段名为 key
          const visibleParams = tool.params.filter((p) => p.name !== 'year');
          this.toolArgs[tool.key] = Object.fromEntries(
            visibleParams.map((p) => [p.name, p.type === 'date-array' ? [] : '']),
          );
        }
      });
    } catch {
      MessagePlugin.error(this.localeStore.t.trigger.loadToolsFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 获取指定脚本的本地化显示名称
   * @param {string} key - 脚本 key
   * @returns {string} 本地化的脚本 label；locale 中缺失时回退到 key
   */
  private getScriptLabel = (key: string): string => {
    return this.localeStore.t.trigger.scripts[key]?.label ?? key;
  };

  /**
   * 验证工具表单
   * @param {UpdateToolScript} tool - 更新工具脚本对象
   * @returns {Promise<boolean>} 验证通过返回 true，否则返回 false
   */
  private validateToolForm = async (tool: UpdateToolScript): Promise<boolean> => {
    const visibleParams = tool.params.filter((p) => p.name !== 'year');
    if (visibleParams.length === 0) return true;

    const formRef = this.toolFormRefs[tool.key];
    if (!formRef) return true;

    const result = await formRef.validate();
    return result === true;
  };

  /**
   * 构建工具完整参数列表（自动注入 year 到原始位置）
   * @param {UpdateToolScript} tool - 更新工具脚本对象
   * @returns {string[]} 完整参数列表
   */
  private buildToolArgs = (tool: UpdateToolScript): string[] => {
    const currentYear = String(new Date().getFullYear());

    return tool.params.map((p) => {
      if (p.name === 'year') return currentYear;
      const val = this.toolArgs[tool.key]?.[p.name];
      if (p.type === 'date-array') {
        return Array.isArray(val) ? (val as string[]).join(',') : '';
      }
      return (val as string) ?? '';
    });
  };

  /**
   * 保存工具执行结果
   * @param {UpdateToolScript} tool - 更新工具脚本对象
   * @param {boolean} success - 是否执行成功
   * @param {string} stdout - 标准输出
   * @param {string} stderr - 错误输出
   * @returns {void}
   */
  private saveToolResult = (tool: UpdateToolScript, success: boolean, stdout: string, stderr: string): void => {
    this.toolResults[tool.key] = {
      code: success ? 0 : -1,
      stdout,
      stderr,
      time: new Date().toLocaleString('zh-CN'),
    };
  };

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动窗口 resize 监听；已登录时立即加载脚本与工具列表，未登录时监听登录状态后再加载
   */
  mounted = (): void => {
    this.startResizeListener();
    this.loadScripts()
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 移除窗口 resize 监听与登录状态监听，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.stopResizeListener();
  };
}

/**
 * Composition API 包装函数
 * @description 将 TriggerModel 类包装为 Composition API 可用的函数
 */
export const useTriggerModel = () => {
  const model = new TriggerModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => { model.mounted(); });

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {

    ...model,
    // 常量
    Permission,
  };
};
