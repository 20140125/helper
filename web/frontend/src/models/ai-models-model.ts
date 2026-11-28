import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel, Permission } from '@/models/base-model';
import { AiModelConfigService } from '@/services/ai-model-config-service';
import { usePlaygroundStore } from '@/stores/playground';
import { useTemplatesStore } from '@/stores/templates';
import { enhanceFields } from '@/utils/field-enhancer';
import { createConfigHandlers, mergeHandlerRegistries } from '@/utils/handler-registry';
import {
  createAiModelFormDefault,
  isAiModelIdValid,
  parseAiModelPricing,
  stringifyAiModelPricing,
} from '@/utils/ai-model-config';
import type { AutoFormField } from '@/types/auto-form';
import type { AutoFormRef } from '@/types/config';
import type {
  AiModelEntry,
  AiModelEntryTestResult,
  AiModelGroup,
  AiModelGroupPayload,
  RemoteModelOption,
} from '@/types/ai-model-config';

/**
 * AI 模型配置页数据模型类
 * @description 独立维护模型接口、Key、长期记忆与单价表；权限与入口均收拢到超级管理员
 */
export class AiModelsModel extends BaseModel {
  // ==============================
  // 依赖注入（store、service）
  // ==============================

  /**
   * 自定义 AI 模型配置服务实例
   * @type {AiModelConfigService}
   * @description 负责模型配置组的增删改查与连通性探测
   */
  private aiModelService: AiModelConfigService = new AiModelConfigService();

  /**
   * Playground 模板全局存储实例
   * @type {ReturnType<typeof usePlaygroundStore>}
   * @description 复用全局缓存，避免重复请求全量模板
   */
  private playgroundStore: ReturnType<typeof usePlaygroundStore> = usePlaygroundStore();

  /**
   * 消息模板配置全局存储实例
   * @type {ReturnType<typeof useTemplatesStore>}
   * @description 为字段增强器提供 handler 注册表
   */
  private templatesStore: ReturnType<typeof useTemplatesStore> = useTemplatesStore();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 用户新增的模型配置组列表
   * @type {Ref<AiModelGroup[]>}
   * @description 一组接口与 Key 下挂多个模型
   */
  aiModelGroups: Ref<AiModelGroup[]> = ref([]);

  /**
   * 是否处于新增模型配置状态
   * @type {Ref<boolean>}
   * @description 为 true 时在列表底部展开展开行内表单
   */
  isAddingAiModel: Ref<boolean> = ref(false);

  /**
   * 当前编辑的配置组 ID
   * @type {Ref<string | null>}
   * @description 不为 null 时在列表底部展开行内表单
   */
  editingAiModelId: Ref<string | null> = ref(null);

  /**
   * 模型配置行内表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 与 auto-form 模板 config-ai-model 字段对应；models 为结构化模型条目数组
   */
  aiModelInlineForm: Ref<Record<string, unknown>> = ref(createAiModelFormDefault());

  /**
   * 从接口拉取到的候选模型
   * @type {Ref<RemoteModelOption[]>}
   * @description 由「从接口获取模型」按钮填充，勾选后导入到行内表单的 models
   */
  remoteModels: Ref<RemoteModelOption[]> = ref([]);

  /**
   * 是否正在拉取模型列表
   * @type {Ref<boolean>}
   * @description 控制获取按钮的 loading 态
   */
  fetchingRemoteModels: Ref<boolean> = ref(false);

  /**
   * 正在测试可用性的模型 ID（空串表示空闲）
   * @type {Ref<string>}
   * @description 同一时刻只允许一个探测请求，避免并发点按把端点打爆
   */
  testingModelId: Ref<string> = ref('');

  /**
   * 模型配置提交状态
   * @type {Ref<boolean>}
   * @description 控制行内表单保存按钮的 loading
   */
  aiModelInlineSaving: Ref<boolean> = ref(false);

  /**
   * 模型配置行内表单 auto-form 实例引用
   * @type {AutoFormRef}
   * @description 提交前调用 validate() 校验
   */
  private aiModelFormRef: AutoFormRef = null;

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 当前用户是否为超级管理员
   * @type {ComputedRef<boolean>}
   * @description 页面本身仅超管可进入，按钮再做一次身份收口
   */
  isAdmin: ComputedRef<boolean> = computed(() => this.authStore.isAdmin);

  /**
   * 是否可管理模型配置（权限 + 超管身份双重校验）
   * @type {ComputedRef<boolean>}
   * @description 避免通过直接赋权把管理入口开放给非超管角色
   */
  canManage: ComputedRef<boolean> = computed(() =>
    this.canEdit(Permission.AI_MODELS_VIEW) && this.authStore.isAdmin,
  );

  /**
   * 自定义模型表单字段配置
   * @type {ComputedRef<AutoFormField[]>}
   * @description 从 config-ai-model 模板增强得到，模板异步加载完成后自动刷新
   */
  aiModelFields: ComputedRef<AutoFormField[]> = computed(() => {
    const raw = this.playgroundStore.getFieldsById('config-ai-model');
    if (!raw || raw.length === 0) return [];
    const handlers = mergeHandlerRegistries(
      createConfigHandlers(),
      this.templatesStore.createHandlers(),
    );
    return enhanceFields(raw, handlers);
  });

  // ==============================
  // 公共方法（箭头函数）
  // ==============================

  /**
   * 加载自定义模型配置组列表
   * @returns {Promise<void>}
   * @description 请求失败时保持原有列表，不阻塞页面
   */
  loadAiModelConfigs = async (): Promise<void> => {
    try {
      const { data } = await this.aiModelService.fetchAiModelConfigs();
      this.aiModelGroups.value = Array.isArray(data?.groups) ? data.groups : [];
    } catch {
      // 请求失败时保持原有列表
    }
  };

  /**
   * 设置模型配置行内表单 ref
   * @param {unknown} el - auto-form 组件实例
   */
  setAiModelFormRef = (el: unknown): void => {
    this.aiModelFormRef = el as AutoFormRef;
  };

  /**
   * 从接口拉取可用模型列表
   * @returns {Promise<void>}
   * @description 用行内表单里的接口地址与 API Key 调用 OpenAI 兼容 /models；
   *   编辑已有配置组时只有脱敏 Key，由后端按 groupId 取回真实 Key
   */
  fetchRemoteModels = async (): Promise<void> => {
    if (this.fetchingRemoteModels.value) return;
    const form = this.aiModelInlineForm.value;
    this.fetchingRemoteModels.value = true;
    try {
      const { data } = await this.aiModelService.fetchRemoteModels({
        baseUrl: String(form.baseUrl ?? '').trim(),
        apiKey: String(form.apiKey ?? ''),
        groupId: this.editingAiModelId.value ?? undefined,
      });
      this.remoteModels.value = Array.isArray(data?.models) ? data.models : [];
      if (this.remoteModels.value.length === 0) {
        MessagePlugin.warning(this.localeStore.t.playground.schema.aiModelFetchEmpty);
      } else {
        MessagePlugin.success(this.localeStore.t.playground.schema.aiModelFetchSuccess);
      }
    } catch (err) {
      MessagePlugin.error(
        err instanceof Error ? err.message : this.localeStore.t.common.operationFailedRetry,
      );
    } finally {
      this.fetchingRemoteModels.value = false;
    }
  };

  /**
   * 测试指定模型能否完成一次真实对话请求
   * @param {string} modelId - 待测试的模型 ID
   * @returns {Promise<void>}
   * @description 用行内表单里的接口地址与 Key 发一次最小请求；结果写入模型条目随保存落盘，
   *   测试失败时自动勾选「隐藏」，默认模型除外（不允许隐藏，提示先更换默认模型）
   */
  testAiModel = async (modelId: string): Promise<void> => {
    if (this.testingModelId.value) return;
    const form = this.aiModelInlineForm.value;
    this.testingModelId.value = modelId;
    try {
      const { data } = await this.aiModelService.testModel({
        modelId,
        baseUrl: String(form.baseUrl ?? '').trim(),
        apiKey: String(form.apiKey ?? ''),
        groupId: this.editingAiModelId.value ?? undefined,
      });
      // 接口异常时 data 可能只是空对象，不能据此把模型判为不可用并自动隐藏
      if (!data || typeof data.ok !== 'boolean') {
        MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
        return;
      }
      const models = Array.isArray(form.models) ? (form.models as AiModelEntry[]) : [];
      const target = models.find((model) => model.id === modelId);
      if (!target) {
        MessagePlugin.error(this.localeStore.t.common.operationFailedRetry);
        return;
      }
      const isDefault = target.isDefault === true;
      const testResult: AiModelEntryTestResult = {
        ok: data.ok,
        latencyMs: Number(data.latencyMs) || 0,
        message: String(data.message ?? ''),
        testedAt: new Date().toISOString(),
        ...(typeof data.reply === 'string' ? { reply: data.reply } : {}),
      };
      // 整表替换，确保 ai-models → ai-model-section → ai-model-form 的 modelValue 一定刷新
      this.aiModelInlineForm.value = {
        ...form,
        models: models.map((model) => (model.id === modelId
          ? {
            ...model,
            testResult,
            ...(data.ok ? { hidden: false } : { hidden: !isDefault }),
          }
          : model)),
      };
      const schema = this.localeStore.t.playground.schema;
      if (data.ok) {
        MessagePlugin.success(`${schema.aiModelTestOk} (${data.latencyMs}ms) · ${schema.aiModelTestSavedHint}`);
      } else if (isDefault) {
        MessagePlugin.warning(schema.aiModelTestDefaultNoHide.replace('{reason}', data.message));
      } else {
        MessagePlugin.warning(schema.aiModelTestAutoHidden.replace('{reason}', data.message));
      }
    } catch (err) {
      const responseMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      MessagePlugin.error(
        responseMessage
          || (err instanceof Error ? err.message : this.localeStore.t.common.operationFailedRetry),
      );
    } finally {
      this.testingModelId.value = '';
    }
  };

  /**
   * 展开新增模型配置的行内表单
   * @description 重置表单数据，不弹抽屉
   */
  startAddAiModel = (): void => {
    this.editingAiModelId.value = null;
    this.aiModelInlineForm.value = createAiModelFormDefault();
    this.remoteModels.value = [];
    this.isAddingAiModel.value = true;
  };

  /**
   * 展开编辑模型配置的行内表单
   * @param {AiModelGroup} group - 待编辑配置组（apiKey 为脱敏值，原样回传可保留原 Key）
   */
  startEditAiModel = (group: AiModelGroup): void => {
    this.isAddingAiModel.value = false;
    this.editingAiModelId.value = group.id;
    this.remoteModels.value = [];
    this.aiModelInlineForm.value = {
      name: group.name,
      baseUrl: group.baseUrl,
      apiKey: group.apiKey,
      maxTokens: group.maxTokens,
      memoryEnabled: group.memoryEnabled ?? true,
      pricingJson: stringifyAiModelPricing(group.pricing),
      models: group.models.map((model) => ({ ...model })),
    };
  };

  /**
   * 取消模型配置的行内新增/编辑
   */
  cancelAiModelInline = (): void => {
    this.isAddingAiModel.value = false;
    this.editingAiModelId.value = null;
    this.aiModelInlineForm.value = createAiModelFormDefault();
    this.remoteModels.value = [];
  };

  /**
   * 提交模型配置行内表单（新增或编辑）
   * @returns {Promise<void>}
   * @description 提交时才校验；结构化模型条目、记忆开关与单价表整组保存
   */
  submitAiModelInline = async (): Promise<void> => {
    if (this.aiModelInlineSaving.value) return;
    const valid = await this.aiModelFormRef?.validate();
    if (valid !== true) return;

    const form = this.aiModelInlineForm.value;
    const models: AiModelEntry[] = Array.isArray(form.models)
      ? (form.models as AiModelEntry[]).map((model) => ({
          ...model,
          id: String(model.id ?? '').trim(),
          label: String(model.label ?? '').trim() || String(model.id ?? '').trim(),
          description: String(model.description ?? ''),
        }))
      : [];
    if (models.length === 0) {
      MessagePlugin.warning(this.localeStore.t.playground.schema.aiModelNamesRequired);
      return;
    }
    if (models.some((model) => !isAiModelIdValid(model.id))) {
      MessagePlugin.warning(this.localeStore.t.playground.schema.aiModelNamesInvalid);
      return;
    }
    const pricing = parseAiModelPricing(String(form.pricingJson ?? ''));
    if (pricing === null) {
      MessagePlugin.warning(this.localeStore.t.playground.schema.aiModelPricingInvalid);
      return;
    }

    const payload: AiModelGroupPayload = {
      name: String(form.name ?? '').trim(),
      baseUrl: String(form.baseUrl ?? '').trim(),
      apiKey: String(form.apiKey ?? ''),
      maxTokens: Number(form.maxTokens) || 4096,
      memoryEnabled: form.memoryEnabled !== false,
      pricing,
      models,
    };
    const editingId = this.editingAiModelId.value;
    this.aiModelInlineSaving.value = true;
    try {
      if (editingId) {
        await this.aiModelService.updateAiModelConfig(editingId, payload);
      } else {
        await this.aiModelService.createAiModelConfig(payload);
      }
      await this.loadAiModelConfigs();
      this.cancelAiModelInline();
      MessagePlugin.success(
        editingId ? this.localeStore.t.config.modelUpdated : this.localeStore.t.config.modelAdded,
      );
    } catch (err) {
      MessagePlugin.error(
        err instanceof Error ? err.message : this.localeStore.t.common.operationFailedRetry,
      );
    } finally {
      this.aiModelInlineSaving.value = false;
    }
  };

  /**
   * 删除模型配置组
   * @param {string} id - 配置组 ID
   * @returns {Promise<void>}
   */
  removeAiModelGroup = async (id: string): Promise<void> => {
    try {
      await this.aiModelService.deleteAiModelConfig(id);
      await this.loadAiModelConfigs();
      MessagePlugin.success(this.localeStore.t.config.modelDeleted);
    } catch (err) {
      MessagePlugin.error(
        err instanceof Error ? err.message : this.localeStore.t.common.deleteFailedRetry,
      );
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 并行加载配置组与表单模板
   */
  mounted = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      await Promise.all([
        this.loadAiModelConfigs(),
        this.playgroundStore.fetchTemplates(),
        this.templatesStore.fetchConfig(),
      ]);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 当前无定时器或事件监听需要清理
   */
  beforeUnmount = (): void => {};
}

/**
 * Composition API 包装函数
 * @returns {object} 页面模板所需的模型状态与方法
 */
export const useAiModelsModel = () => {
  const model = new AiModelsModel();

  onMounted(() => { void model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {
    ...model,
    Permission,
  };
};
