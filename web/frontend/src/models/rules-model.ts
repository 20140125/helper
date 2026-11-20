import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { useRulesStore } from '@/stores/rules';
import { useWebhooksStore } from '@/stores/webhooks';
import { usePlaygroundStore } from '@/stores/playground';
import { useTemplatesStore } from '@/stores/templates';
import type { Rule, RuleFormData } from '@/types/rule';
import type { AutoFormField } from '@/types/auto-form';
import {
  getRuleTypes,
  getRuleTypeLabel,
  RULE_TYPE_ICON,
  RULE_TYPE_THEME,
} from '@/constants/rules';
import { FormMode } from '@/constants/form';
import { formatCondition } from '@/utils/format';
import { enhanceFields } from '@/utils/field-enhancer';
import { createRuleHandlers, mergeHandlerRegistries } from '@/utils/handler-registry';
import {
  createEmptyRuleFormData,
  buildCondition,
  parseRuleToFormData,
  isExecutedToday as checkExecutedToday,
  type RuleFlatFormData,
} from '@/utils/rules';
import { BaseModel } from '@/models/base-model';
import Sortable from 'sortablejs';

/**
 * 规则页面数据模型类
 * @description 管理规则页面的所有业务逻辑，包括规则的增删改查、表单管理、规则测试等
 */
export class RulesModel extends BaseModel {
  // ==============================
  // 依赖注入（store）
  // ==============================

  rulesStore: ReturnType<typeof useRulesStore> = useRulesStore();

  /**
   * Webhooks 状态存储实例
   * @type {ReturnType<typeof useWebhooksStore>}
   * @description 用于读取企业微信机器人列表
   */
  webhooksStore: ReturnType<typeof useWebhooksStore> = useWebhooksStore();

  /**
   * Playground 模板全局存储实例
   * @type {ReturnType<typeof usePlaygroundStore>}
   * @description 缓存全量模板，避免重复请求
   */
  playgroundStore: ReturnType<typeof usePlaygroundStore> = usePlaygroundStore();

  /**
   * 消息模板配置全局存储实例
   * @type {ReturnType<typeof useTemplatesStore>}
   * @description 用于为规则表单提供模板选项
   */
  templatesStore: ReturnType<typeof useTemplatesStore> = useTemplatesStore();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制规则抽屉的展开
   */
  ruleDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前编辑的规则
   * @type {Ref<Rule | null>}
   * @description null 表示新增模式
   */
  editingRule: Ref<Rule | null> = ref(null);

  /**
   * 规则表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 扭平化后的规则表单值，供 auto-form v-model 使用
   */
  ruleFormData: Ref<Record<string, unknown>> = ref(createEmptyRuleFormData());

  /**
   * auto-form 组件实例引用
   * @type {Ref<{ validate: () => Promise<boolean | Record<string, unknown>> } | null>}
   * @description 用于提交前调用 validate() 验证表单
   */
  ruleFormRef: Ref<{ validate: () => Promise<boolean | Record<string, unknown>>; clearValidate?: (fields?: string[]) => void } | null> = ref(null);

  /**
   * playground 加载的原始字段模板
   * @type {Ref<unknown[]>}
   * @description 由 fetchTemplates 调用后填充，供字段模板增强使用
   */
  rawRuleFields: Ref<unknown[]> = ref([]);

  /**
   * 正在测试的规则 ID
   * @type {Ref<string>}
   * @description 空字符串表示无测试中的规则
   */
  testingId: Ref<string> = ref('');

  /**
   * 测试结果映射表
   * @type {Ref<Record<string, { code: number; time: string; stdout: string; stderr: string }>>}
   * @description key 为规则 ID，value 为最近一次测试的运行详情
   */
  testResults: Ref<Record<string, { code: number; time: string; stdout: string; stderr: string }>> = ref({});

  /**
   * 规则卡片网格容器元素
   * @type {Ref<HTMLElement | null>}
   * @description 由 View 通过 :ref 回调注入，作为 Sortable 的挂载容器
   */
  gridEl: Ref<HTMLElement | null> = ref(null);

  /**
   * Sortable 实例
   * @type {Sortable | null}
   * @description 卡片网格的拖拽排序实例；null 表示未初始化（无权限 / 列表未渲染）
   */
  private sortableInstance: Sortable | null = null;

  // ==============================
  // 静态数据
  // ==============================

  /**
   * 规则类型选项
   * @type {ComputedRef<ReturnType<typeof getRuleTypes>>}
   * @description 随语言响应式更新的规则类型选项列表
   */
  ruleTypes: ComputedRef<ReturnType<typeof getRuleTypes>> = computed(() => getRuleTypes());

  /**
   * 规则类型 label 映射
   * @type {ComputedRef<ReturnType<typeof getRuleTypeLabel>>}
   * @description 随语言响应式更新
   */
  typeLabel: ComputedRef<ReturnType<typeof getRuleTypeLabel>> = computed(() => getRuleTypeLabel());

  /**
   * 规则类型图标映射
   * @type {typeof RULE_TYPE_ICON}
   * @description 静态映射表，不随语言变化
   */
  typeIcon: typeof RULE_TYPE_ICON = RULE_TYPE_ICON;

  /**
   * 规则类型主题色映射
   * @type {typeof RULE_TYPE_THEME}
   * @description 静态映射表，不随语言变化
   */
  typeTheme: typeof RULE_TYPE_THEME = RULE_TYPE_THEME;

  /** 模板 ID → 显示名称映射（用于卡片展示模板标签） */
  templateNameMap = computed<Record<string, string>>(() => {
    const names = this.templatesStore.config?.template_names;
    if (!names) return {};
    return { ...names };
  });

  // ==============================
  // 计算属性（get）
  // ==============================

  /**
   * 抽屉标题
   * @type {ComputedRef<string>}
   * @description 随编辑/新增状态动态切换
   */
  ruleDrawerHeader: ComputedRef<string> = computed(() => {
    const r = this.localeStore.t.rules;
    return this.editingRule.value ? r.drawerEdit : r.drawerCreate;
  });

  /**
   * 表单模式
   * @type {ComputedRef<FormMode>}
   * @description editingRule 非空时为 Edit，否则 Create。供 form-drawer 的 mode prop 使用
   */
  ruleFormMode: ComputedRef<FormMode> = computed(() =>
    this.editingRule.value ? FormMode.Edit : FormMode.Create,
  );

  /**
   * 规则表单 handler 注册表
   * @description 合并 rules、messageTemplates 与规则专属 handler 集合
   */
  ruleHandlers = computed(() =>
    mergeHandlerRegistries(
      createRuleHandlers(),
      this.templatesStore.createHandlers(),
    ),
  );

  /**
   * 规则表单字段配置
   * @type {ComputedRef<AutoFormField[]>}
   * @description 根据 rawRuleFields + handlers 动态生成
   */
  ruleFormFields: ComputedRef<AutoFormField[]> = computed(() => {
    if (this.rawRuleFields.value.length === 0) return [];
    return enhanceFields(this.rawRuleFields.value, this.ruleHandlers.value);
  });
  // ==============================
  // 公共方法
  // ==============================

  /**
   * 判断规则今天是否已经执行过
   * @param {Rule} rule - 待判断的规则
   * @returns {boolean} 最后触发时间年月日与今天相同则为 true
   * @description 供卡片展示「今日已执行 / 今日未执行」状态
   */
  isExecutedToday = (rule: Rule): boolean => checkExecutedToday(rule.lastTriggeredAt);

  /**
   * 打开新增规则抽屉
   * @description 重置 editingRule 与表单数据，并打开抽屉
   */
  openCreate = (): void => {
    this.editingRule.value = null;
    this.ruleFormData.value = createEmptyRuleFormData();
    this.ruleDrawerVisible.value = true;
  };

  /**
   * 打开编辑规则抽屉
   * @param {Rule} rule - 待编辑的规则对象
   */
  openEdit = (rule: Rule): void => {
    this.editingRule.value = rule;
    this.ruleFormData.value = parseRuleToFormData(rule as unknown as Record<string, unknown>);
    this.ruleDrawerVisible.value = true;
  };

  /**
   * 关闭抽屉
   * @description 同时重置表单状态与 editingRule
   */
  closeDrawer = (): void => {
    // 先清除校验状态，避免关闭时残留必填错误提示
    this.ruleFormRef.value?.clearValidate?.();
    this.ruleDrawerVisible.value = false;
    this.editingRule.value = null;
    this.ruleFormData.value = createEmptyRuleFormData();
  };

  /**
   * 提交表单（供抽屉 confirm 事件调用）
   * @description 先执行 auto-form 校验，再组合 condition 字段，最后调用 store 新增/编辑
   */
  submitForm = async (): Promise<void> => {
    // 1. auto-form 校验
    if (this.ruleFormRef.value) {
      const result = await this.ruleFormRef.value.validate();
      if (result !== true) return;
    }

    // 2. 组合 condition
    const flat = this.ruleFormData.value as RuleFlatFormData;
    const condition = buildCondition(flat);
    if (condition === null) return;

    // 3. 组装最终 payload
    // 规则统一走模板推送：表单已不再提供「自定义内容」入口，提交时一律 custom_content=false
    // 存量保护：编辑一条原本走自定义内容的规则时，表单里没有 message 字段，
    // 直接提交会把内容静默清空——这种情况保留原 message 与 custom_content 标记
    const editing = this.editingRule.value;
    // 用户一旦选了模板就按模板走；只有未选模板时才保留原自定义内容，避免静默丢数据
    const keepLegacyContent = !!editing?.custom_content && !!editing.message && !flat.template_id;
    const payload: RuleFormData = {
      name: flat.name,
      type: flat.type,
      condition,
      time: flat.time,
      message: keepLegacyContent ? editing!.message : '',
      template_id: keepLegacyContent ? '' : (flat.template_id || ''),
      custom_content: keepLegacyContent,
      enabled: flat.enabled,
      webhookIds: flat.webhookIds,
    };

    // 4. 提交
    await this.saveRule(payload);
  };

  /**
   * 切换规则启用状态
   * @param {string} id - 规则 ID
   * @param {boolean} enabled - 目标启用状态
   */
  toggleRule = async (id: string, enabled: boolean): Promise<void> => {
    await this.rulesStore.editRule(id, { enabled });
  };

  /**
   * 清除指定规则的测试结果
   * @param {string} id - 规则 ID
   */
  clearTestResult = (id: string): void => {
    const results = { ...this.testResults.value };
    delete results[id];
    this.testResults.value = results;
  };

  /**
   * 执行规则测试
   * @param {string} id - 规则 ID
   * @description 调用后端运行测试接口并保存运行输出
   */
  testRuleRun = async (id: string): Promise<void> => {
    this.testingId.value = id;
    try {
      const { code, data: { stdout, stderr } } = await this.rulesStore.runTest(id);
      this.testResults.value = {
        ...this.testResults.value,
        [id]: {
          code,
          time: new Date().toLocaleTimeString(),
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.localeStore.t.rules.testFailed;
      this.testResults.value = {
        ...this.testResults.value,
        [id]: {
          code: -1,
          time: new Date().toLocaleTimeString(),
          stdout: '',
          stderr: msg,
        },
      };
    } finally {
      this.testingId.value = '';
    }
  };

  /**
   * 设置 auto-form 组件实例引用
   * @param {unknown} el - Vue :ref 回调传入的元素或组件实例
   */
  setRuleFormRef = (el: unknown): void => {
    this.ruleFormRef.value = el as { validate: () => Promise<boolean | Record<string, unknown>> } | null;
  };

  /**
   * 设置规则网格容器引用并初始化拖拽排序
   * @param {unknown} el - Vue :ref 回调传入的元素
   * @description 列表由空变有时网格才渲染、回调才会触发，恰好覆盖初始化时机；
   *              仅有编辑权限时才启用 Sortable，拖拽把手限定为卡片标题左侧图标
   */
  setGridRef = (el: unknown): void => {
    this.gridEl.value = (el as HTMLElement) ?? null;
    if (!this.gridEl.value || this.sortableInstance || !this.canEdit()) return;
    this.sortableInstance = Sortable.create(this.gridEl.value, {
      animation: 150,
      handle: '.rule-card__drag-handle',
      ghostClass: 'rule-card--drag-ghost',
      onEnd: (evt) => {
        const { oldIndex, newIndex, item, from } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        // Sortable 已直接改动真实 DOM：先还原，再由 store 重排触发 v-for 重渲染，
        // 避免 DOM 与虚拟 DOM 失配导致后续增删改时卡片错位
        from.removeChild(item);
        from.insertBefore(item, from.children[oldIndex] ?? null);
        this.rulesStore.reorderRules(oldIndex, newIndex);
      },
    });
  };

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 保存规则
   * @param {RuleFormData} formData - 最终提交给后端的表单数据
   * @description 根据是否存在 editingRule 决定调用 editRule 还是 addRule
   */
  private saveRule = async (formData: RuleFormData): Promise<void> => {
    this.pageLoading.value = true;
    try {
      if (this.editingRule.value) {
        await this.rulesStore.editRule(
          this.editingRule.value.id,
          formData as Parameters<typeof this.rulesStore.editRule>[1],
        );
      } else {
        await this.rulesStore.addRule(
          formData as Parameters<typeof this.rulesStore.addRule>[0],
        );
      }
      this.closeDrawer();
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 加载字段模板
   * @description 并行拉取 playground 模板与 templates 配置，填充 rawRuleFields
   */
  private loadFieldsTemplate = async (): Promise<void> => {
    try {
      await Promise.all([
        this.playgroundStore.fetchTemplates(),
        this.templatesStore.fetchConfig(),
      ]);
      const fields = this.playgroundStore.getFieldsById('rule-form');
      if (fields.length > 0) {
        this.rawRuleFields.value = fields;
      }
    } catch {
      // 静默失败，降级使用空 fields
    }
  };

  /**
   * 销毁拖拽排序实例
   * @description 组件卸载前调用，防止残留全局事件监听
   */
  private destroySortable = (): void => {
    this.sortableInstance?.destroy();
    this.sortableInstance = null;
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 拉取规则与机器人列表、加载字段模板并启动窗口 resize 监听
   */
  mounted = (): void => {
    this.rulesStore.fetchRules();
    this.webhooksStore.fetchWebhooks();
    this.loadFieldsTemplate();
    this.startResizeListener();
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 移除窗口 resize 监听与拖拽排序实例，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.stopResizeListener();
    this.destroySortable();
  };
}

/**
 * Composition API 包装函数
 * @description 将 RulesModel 类包装为 Composition API 可用的函数
 */
export const useRulesModel = () => {
  const model = new RulesModel();

  onMounted(() => { model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {

    ...model,
    // 常量
    formatCondition,
  };
};
