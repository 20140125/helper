import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel, Permission } from '@/models/base-model';
import { AiChatService } from '@/services/ai-chat-service';
import skillMapService from '@/services/skill-map-service';
import type {
  AiToolMeta,
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  LlmModelOption,
  UiMessage,
  UiPlan,
  UiPlanStep,
  UiReflection,
  UiToolCall,
} from '@/types/ai-chat';
import { ChatRole } from '@/types/ai-chat';
import {
  buildAiChatRenderItems,
  convertToUiMessages,
  findPrevUserIndex,
  findPrevUserText,
  findToolCallById,
  genId,
  makePlaceholderMessage,
  fileToCompressedDataUrl,
  pickImageFiles,
  MAX_ATTACHED_IMAGES,
  type AiChatRenderItem,
} from '@/utils/ai-chat';
import { formatChatTime } from '@/utils/format';
import { writeClipboard } from '@/utils/clipboard';
import { DEFAULT_CONVERSATION_TITLE, MAX_INPUT_LENGTH } from '@/constants/ai-chat';

export type { AiChatRenderItem };

/**
 * AI 智能助手页面数据模型类
 * @description 管理 AI Chat 页面的全部业务逻辑：会话列表、当前会话消息、流式发送、工具调用展示
 */
export class AiChatModel extends BaseModel {
  // ==============================
  // 依赖注入
  // ==============================

  /**
   * AI Chat 服务实例
   * @type {AiChatService}
   * @description 封装 REST 与 SSE 流式发送
   */
  service: AiChatService = new AiChatService();

  /**
   * 技能地图服务实例
   * @type {SkillMapService}
   * @description 用于拉取技能清单，供输入框的「指定技能」选择器使用
   */
  skillService: typeof skillMapService = skillMapService;

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 后端 LLM 健康状态
   * @type {Ref<{ healthy: boolean; message: string } | null>}
   * @description null 表示尚未检查；用于在配置缺失时友好提示用户
   */
  health: Ref<{ healthy: boolean; message: string } | null> = ref(null);

  /**
   * 会话摘要列表（左侧栏展示）
   * @type {Ref<ChatConversationSummary[]>}
   */
  conversations: Ref<ChatConversationSummary[]> = ref([]);

  /**
   * 当前选中的会话 ID
   * @type {Ref<string>}
   */
  currentConversationId: Ref<string> = ref('');

  /**
   * 当前会话的 UI 消息列表
   * @type {Ref<UiMessage[]>}
   * @description 由后端 ChatMessage 转换而来，剔除了 tool 角色，工具结果合并到 assistant 消息上
   */
  uiMessages: Ref<UiMessage[]> = ref([]);

  /**
   * 输入框内容
   * @type {Ref<string>}
   */
  input: Ref<string> = ref('');

  /**
   * 待发送的图片附件（Data URL 列表）
   * @type {Ref<string[]>}
   * @description 用户在输入区选择图片后先挂起，发送时随消息一起提交并清空
   */
  pendingImages: Ref<string[]> = ref([]);

  /**
   * 抽屉显示状态
   * @type {Ref<boolean>}
   * @description 控制 AI 助手抽屉的展开/收起；由触发按钮和关闭按钮共同维护
   */
  visible: Ref<boolean> = ref(false);

  /**
   * 是否启用工具调用
   * @type {Ref<boolean>}
   */
  enableTools: Ref<boolean> = ref(true);

  /**
   * 是否允许 LLM 按需调用「联网搜索」工具
   * @type {Ref<boolean>}
   * @description 默认关闭；只有用户在输入框工具栏点亮地球图标后，web_search 工具才会被加入本次请求的可用工具列表，
   *              避免默认场景下频繁调用联网接口产生额外费用。
   */
  enableWebSearch: Ref<boolean> = ref(false);

  /**
   * 是否启用 L3「规划 → 执行 → 反思」能力
   * @type {Ref<boolean>}
   * @description 默认关闭：规划 + 反思各多一次 LLM 调用，而免费模型（glm-*-flash）限流概率高，
   *   默认关闭可省掉这两次额外调用、降低 429 风险；用户在输入框工具栏点亮「规划模式」后才开启。
   *   关闭后退化为单循环直跑（L2）。
   */
  enablePlanning: Ref<boolean> = ref(false);

  /**
   * 可选的模型列表（后端 /models 接口返回）
   * @type {Ref<LlmModelOption[]>}
   */
  availableModels: Ref<LlmModelOption[]> = ref([]);

  /**
   * 可选的卡片技能列表（供输入框「指定技能」选择器使用）
   * @type {Ref<{ key: string; label: string; icon: string; desc: string }[]>}
   * @description 由 /api/skill-map 拉取：label / desc 取 i18n 文案（缺失时 label 退化成 key、desc 留空），
   *              icon 直接用后端 SKILL_METAS 的 emoji（缺失时用通用图标兜底）
   */
  availableSkills: Ref<{ key: string; label: string; icon: string; desc: string }[]> = ref([]);

  /**
   * 当前指定的能力（空串 = 不指定，由 AI 自行判断）
   * @type {Ref<string>}
   * @description 两种取值：
   *   - `skill:<key>`（或历史格式的裸 skill key）→ 本轮只跑该卡片技能
   *   - `tool:<name>` → 本轮只保留该工具（新增的 manage_* / query_pages 等都能这样指定）
   */
  pinnedSkill: Ref<string> = ref('');

  /**
   * 当前选中的模型 ID
   * @type {Ref<string>}
   */
  currentModel: Ref<string> = ref('');

  /**
   * 是否正在流式响应中
   * @type {Ref<boolean>}
   */
  streaming: Ref<boolean> = ref(false);

  /**
   * 当前流式请求的终止控制器
   * @type {Ref<AbortController | null>}
   */
  currentAbort: Ref<AbortController | null> = ref(null);

  /**
   * 当前会话可用的工具元数据
   * @type {Ref<AiToolMeta[]>}
   * @description 两个数据来源，取并集语义：
   *   1) 初始化时由 GET /api/ai-chat/tools 预填（这样首次发消息前下拉里就有工具可选）
   *   2) 每次 SSE meta 事件会用当轮实际可用工具刷新（权限变化后自动同步）
   */
  availableTools: Ref<AiToolMeta[]> = ref([]);

  /**
   * 消息容器 ref（用于滚动到底部）
   * @type {Ref<HTMLElement | null>}
   */
  scrollContainer: Ref<HTMLElement | null> = ref(null);

  /**
   * 是否处于「自动跟随底部」模式
   * @type {Ref<boolean>}
   * @description 流式输出时默认 true（滚动条始终贴底）；当用户主动向上滚动后置 false，避免被强行拽回；
   *              当用户再次滚回到接近底部时由 onScrollContainer 重置为 true。
   */
  autoFollow: Ref<boolean> = ref(true);

  /**
   * 已处于「已复制」反馈态的消息 id 集合
   * @type {Ref<Set<string>>}
   * @description 通过 Set 维护可同时多条复制反馈；每个 id 在复制成功 1.5s 后自动移除
   */
  copiedIds: Ref<Set<string>> = ref(new Set());

  /**
   * 当前已挂起的 rAF 句柄，用于合并高频 delta 触发的滚动
   * @type {number}
   * @description 0 表示没有挂起；非 0 时跳过本次调度，避免一帧内重复改 scrollTop
   */
  private scrollRaf: number = 0;

  /**
   * 复制反馈计时器表：消息 id → setTimeout 句柄
   * @description 用于在重复复制同一条消息时取消上一个计时器，避免提前清除反馈状态
   */
  private copiedTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * 监听消息容器内容尺寸变化（Markdown 异步渲染、代码块、工具卡展开等会引起滚动高度跳变）
   * @type {ResizeObserver | null}
   */
  private resizeObserver: ResizeObserver | null = null;

  /**
   * 「贴底判定」阈值（px），距底部小于该值即视为贴底
   * @type {number}
   */
  private static readonly BOTTOM_THRESHOLD: number = 32;

  /**
   * 「已复制」反馈态保留时长（毫秒）
   * @type {number}
   */
  private static readonly COPIED_FEEDBACK_MS: number = 1500;

  // 时间戳分组阈值常量已抽到 utils/ai-chat/render-items.ts (AI_CHAT_TIME_GROUP_GAP_MS)

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 是否可以发送消息
   * @type {ComputedRef<boolean>}
   * @description （输入非空 或 已挂图片）+ 未在流式中 + 输入未超长 + 后端配置就绪
   */
  canSend: ComputedRef<boolean> = computed(() => {
    const hasText = this.input.value.trim().length > 0;
    return (
      !this.streaming.value
      && (hasText || this.pendingImages.value.length > 0)
      && this.input.value.length <= MAX_INPUT_LENGTH
      && this.health.value?.healthy === true
    );
  });

  /**
   * 当前选中会话的摘要（左侧高亮用）
   * @type {ComputedRef<ChatConversationSummary | null>}
   */
  currentSummary: ComputedRef<ChatConversationSummary | null> = computed(() => {
    return this.conversations.value.find((c) => c.id === this.currentConversationId.value) ?? null;
  });

  /**
   * 当前用户是否拥有 AI 助手访问权限
   * @type {ComputedRef<boolean>}
   * @description 用于在视图层决定是否渲染入口按钮和抽屉
   */
  hasPermission: ComputedRef<boolean> = computed(() => {
    return this.permissionStore.hasPermission(Permission.AI_CHAT_VIEW);
  });

  /**
   * 欢迎页示例问题列表
   * @type {ComputedRef<string[]>}
   * @description 跟随 i18n 语言切换；点击后会作为初始 prompt 发送给 LLM
   */
  welcomeExamples: ComputedRef<string[]> = computed(() => this.localeStore.t.aiChat.examples);

  /**
   * 消息列表渲染项（含居中时间分隔条 + 回合 turnStart 标记）
   * @type {ComputedRef<AiChatRenderItem[]>}
   * @description 派生逻辑见 utils/ai-chat/buildAiChatRenderItems
   */
  renderItems: ComputedRef<AiChatRenderItem[]> = computed(() => {
    return buildAiChatRenderItems(this.uiMessages.value, formatChatTime);
  });

  // ==============================
  // 工具方法
  // ==============================

  /**
   * 立即滚动到底部（强制贴底，重置 autoFollow=true）
   * @returns {Promise<void>}
   * @description 用于初始化加载、会话切换等场景
   */
  scrollToBottom = async (): Promise<void> => {
    this.autoFollow.value = true;
    await nextTick();
    const el = this.scrollContainer.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  };

  /**
   * 跟随式滚动：仅当 autoFollow 为 true 时才贴底；用 rAF 合并高频调用
   * @description 用于流式 delta 更新时的平滑滚动，避免跳变。
   */
  scrollToBottomIfFollowing = (): void => {
    if (this.scrollRaf !== 0) return;
    this.scrollRaf = window.requestAnimationFrame(() => {
      this.scrollRaf = 0;
      if (!this.autoFollow.value) return;
      const el = this.scrollContainer.value;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  };

  /**
   * 容器滚动事件回调：根据用户当前位置维护 autoFollow
   * @description 用户向上滚时取消自动跟随；滚回底部时重新启用。
   */
  onScrollContainer = (): void => {
    const el = this.scrollContainer.value;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.autoFollow.value = distance <= AiChatModel.BOTTOM_THRESHOLD;
  };

  /**
   * 绑定消息容器：注册滚动监听 + ResizeObserver
   * @param {HTMLElement | null} el - 模板 ref 拿到的容器节点
   * @description 由 launcher 在 onMounted 中调用
   */
  attachScrollContainer = (el: HTMLElement | null): void => {
    this.scrollContainer.value = el;
    if (!el) return;
    el.addEventListener('scroll', this.onScrollContainer, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.scrollToBottomIfFollowing();
      });
      this.resizeObserver.observe(el);
    }
  };

  /**
   * 解绑消息容器：移除滚动监听 + 取消 ResizeObserver + 取消未触发的 rAF
   * @description 由 launcher 在 onBeforeUnmount 中调用，避免内存泄漏
   */
  detachScrollContainer = (): void => {
    const el = this.scrollContainer.value;
    if (el) {
      el.removeEventListener('scroll', this.onScrollContainer);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.scrollRaf !== 0) {
      window.cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = 0;
    }
  };

  /**
   * 生成临时 UI 消息 ID（委托给 utils/ai-chat/genId）
   * @returns {string} 唯一字符串 ID
   */
  private genId = (): string => genId();

  // parseToolResult / toUiToolCall / toUiMessage / normalizeContent 已全部抽取到
  // utils/ai-chat，由 convertToUiMessages 内部统一处理，model 层不再重复实现。

  /**
   * 把后端的 ChatMessage[] 转换为 UI 展示用的 UiMessage[]
   * @param {ChatMessage[]} messages - 后端返回的完整消息列表
   * @returns {UiMessage[]} 合并 tool 结果后的 UI 消息列表
   * @description 委托给 utils/ai-chat/convertToUiMessages
   */
  private convertToUiMessages = (messages: ChatMessage[]): UiMessage[] => {
    return convertToUiMessages(messages, () => this.genId());
  };
  // ==============================
  // 公共方法（CRUD）
  // ==============================

  /**
   * 加载健康检查
   * @returns {Promise<void>}
   * @description 检查 LLM 是否已配置 API Key
   */
  loadHealth = async (): Promise<void> => {
    try {
      const res = await this.service.fetchHealth();
      this.health.value = res.data;
    } catch {
      this.health.value = { healthy: false, message: '无法连接服务器' };
    }
  };
  
  /**
   * 加载可选技能列表
   * @returns {Promise<void>}
   * @description 拉取 /api/skill-map 技能集合，按 i18n 文案映射展示名，供「指定技能」选择器使用；
   *              拉取失败不阻断主流程（退化为不显示选择器）。
   */
  loadSkills = async (): Promise<void> => {
    try {
      const res = await this.skillService.fetchSkills();
      const dict = this.localeStore.t.skillMap?.skills ?? {};
      this.availableSkills.value = (res.data.skills ?? []).map((s) => ({
        key: s.key,
        label: dict[s.key]?.label ?? s.key,
        icon: s.icon || '🔧',
        desc: dict[s.key]?.desc ?? '',
      }));
    } catch {
      // 技能清单拉取失败不阻断主流程
    }
  };

  /**
   * 加载当前用户可用的 AI 工具清单
   * @returns {Promise<void>}
   * @description 供输入框「指定工具」分组使用；拉取失败不阻断主流程（该分组不显示即可）
   */
  loadTools = async (): Promise<void> => {
    try {
      const res = await this.service.fetchTools();
      // 复用 SSE meta 用的同一个 ref，避免两份工具清单各自为政
      this.availableTools.value = (res.data.tools ?? []) as AiToolMeta[];
    } catch {
      // 工具清单拉取失败不阻断主流程
    }
  };

  /**
   * 加载可选模型列表
   * @returns {Promise<void>}
   * @description 拉取后端可选模型并设置默认选中项
   */
  loadModels = async (): Promise<void> => {
    try {
      const res = await this.service.fetchModels();
      this.availableModels.value = res.data.models;
      // 仅在未选中任何模型时采后端默认值，避免覆盖用户主动选择
      if (!this.currentModel.value) {
        this.currentModel.value = res.data.default;
      }
    } catch {
      // 获取模型列表失败不阻断主流程，使用者仍可以发送消息走后端默认
    }
  };

  /**
   * 加载会话列表
   * @returns {Promise<void>}
   */
  loadConversations = async (): Promise<void> => {
    try {
      const res = await this.service.fetchConversations();
      this.conversations.value = res.data.conversations;
    } catch {
      MessagePlugin.error(this.localeStore.t.aiChat.loadConversationsFailed);
    }
  };

  /**
   * 加载指定会话的消息
   * @param {string} id - 会话 ID
   * @returns {Promise<void>}
   */
  loadConversation = async (id: string): Promise<void> => {
    try {
      const res = await this.service.fetchConversation(id);
      const conv: ChatConversation = res.data.conversation;
      this.currentConversationId.value = conv.id;
      this.uiMessages.value = this.convertToUiMessages(conv.messages);
      void this.scrollToBottom();
    } catch {
      MessagePlugin.error(this.localeStore.t.aiChat.loadConversationFailed);
    }
  };

  /**
   * 选中并加载会话
   * @param {string} id - 会话 ID
   * @returns {Promise<void>}
   */
  selectConversation = async (id: string): Promise<void> => {
    if (id === this.currentConversationId.value) return;
    this.stopStreaming();
    await this.loadConversation(id);
  };

  /**
   * 创建新会话并切换到它
   * @returns {Promise<void>}
   */
  createNewConversation = async (): Promise<void> => {
    this.stopStreaming();
    try {
      const res = await this.service.createConversation({});
      const conv = res.data.conversation;
      this.currentConversationId.value = conv.id;
      this.uiMessages.value = [];
      await this.loadConversations();
    } catch {
      MessagePlugin.error(this.localeStore.t.aiChat.createConversationFailed);
    }
  };

  /**
   * 删除会话
   * @param {string} id - 会话 ID
   * @returns {Promise<void>}
   */
  removeConversation = async (id: string): Promise<void> => {
    try {
      await this.service.deleteConversation(id);
      MessagePlugin.success(this.localeStore.t.common.deleteSuccess);
      // 若删除的是当前会话，清空选中
      if (id === this.currentConversationId.value) {
        this.currentConversationId.value = '';
        this.uiMessages.value = [];
      }
      await this.loadConversations();
    } catch {
      MessagePlugin.error(this.localeStore.t.common.deleteFailedRetry);
    }
  };

  // ==============================
  // 流式发送消息
  // ==============================

  /**
   * 终止当前正在进行的流式响应
   * @returns {void}
   */
  stopStreaming = (): void => {
    if (this.currentAbort.value) {
      this.currentAbort.value.abort();
      this.currentAbort.value = null;
    }
    this.streaming.value = false;
    // 把还在 streaming 的 UI 消息标记为完成
    for (const m of this.uiMessages.value) {
      m.streaming = false;
    }
  };

  /**
   * 构造一条空白的 user / assistant 占位消息（委托给 utils/ai-chat/makePlaceholderMessage）
   * @param {ChatRole.User | ChatRole.Assistant} role - 角色
   * @param {string} content - 内容（assistant 占位为空字符串）
   * @param {boolean} streaming - 是否处于流式中
   * @returns {UiMessage} 占位消息
   */
  private makePlaceholder = (
    role: ChatRole.User | ChatRole.Assistant,
    content: string,
    streaming: boolean,
    images?: string[],
  ): UiMessage => makePlaceholderMessage({
    role,
    content,
    streaming,
    idGen: () => this.genId(),
    images,
  });

  /**
   * 启动一轮新的「user → assistant」流式对话
   * @param {string} text - 用户消息文本（已 trim）
   * @returns {void}
   * @description sendMessage 与 regenerateAnswer 的共同后半段：
   *   1) 追加 user + 空白 assistant 占位消息
   *   2) 通过数组取下标方式拿到 reactive proxy 包装后的 assistant 引用，保证模板响应式更新
   *   3) 标记 streaming=true 并立即贴底
   *   4) 调用底层流式接口，绑定事件处理器
   *   抽离动机：消除 sendMessage 与 regenerateAnswer 中重复的占位/启流逻辑，降低函数复杂度
   */
  private startNewTurn = (text: string, images: string[] = []): void => {
    this.uiMessages.value.push(this.makePlaceholder(ChatRole.User, text, false, images));
    this.uiMessages.value.push(this.makePlaceholder(ChatRole.Assistant, '', true));
    // 关键点：直接 push 普通对象后，闭包捕获的 `assistantMsg` 是「原始对象」，
    // Vue 3 reactive 的依赖追踪只在「proxy 对象」上生效——直接修改原始对象的属性
    // 不会触发模板重渲染。push 后必须从数组里再取一次，拿到 reactive proxy 包装后的引用。
    const assistantMsg = this.uiMessages.value[this.uiMessages.value.length - 1];
    this.streaming.value = true;
    void this.scrollToBottom();

    this.currentAbort.value = this.service.sendMessageStream(
      {
        conversation_id: this.currentConversationId.value || undefined,
        message: text,
        enable_tools: this.enableTools.value,
        enable_web_search: this.enableWebSearch.value,
        enable_planning: this.enablePlanning.value,
        pinned_skill: this.pinnedSkill.value || undefined,
        model: this.currentModel.value || undefined,
        images: images.length > 0 ? images : undefined,
      },
      this.buildStreamHandlers(assistantMsg),
    );
  };

  /**
   * 在 UI 消息列表中查找指定 assistant 消息之前最近的一条 user 消息文本
   * @param {string} assistantMsgId - assistant 消息 id
   * @returns {string} 用户消息文本（已 trim）；找不到返回空串
   * @description 委托给 utils/ai-chat/findPrevUserText
   */
  private findPrevUserText = (assistantMsgId: string): string => {
    return findPrevUserText(this.uiMessages.value, assistantMsgId);
  };

  /**
   * 在 assistant 消息中查找指定 id 的 tool_call
   * @param {UiMessage} assistantMsg - 当前 assistant 消息
   * @param {string} id - tool_call_id
   * @returns {UiToolCall | undefined} 匹配的工具调用
   */
  private findToolCall = (assistantMsg: UiMessage, id: string): UiToolCall | undefined => {
    return findToolCallById(assistantMsg, id) as UiToolCall | undefined;
  };

  /**
   * 流式响应正常结束时的清理动作
   * @param {UiMessage} assistantMsg - 当前 assistant 消息
   * @returns {void}
   */
  private finishStreamingSuccess = (assistantMsg: UiMessage): void => {
    assistantMsg.streaming = false;
    this.streaming.value = false;
    this.currentAbort.value = null;
    void this.loadConversations();
    void this.scrollToBottom();
  };

  /**
   * 流式响应出错时的清理动作
   * @param {UiMessage} assistantMsg - 当前 assistant 消息
   * @param {string} errorMessage - 错误描述
   * @returns {void}
   */
  private finishStreamingError = (assistantMsg: UiMessage, errorMessage: string): void => {
    assistantMsg.streaming = false;
    assistantMsg.content += assistantMsg.content
      ? `\n\n❌ ${errorMessage}`
      : `❌ ${errorMessage}`;
    this.streaming.value = false;
    this.currentAbort.value = null;
    MessagePlugin.error(errorMessage);
  };

  /**
   * 构造 sendMessageStream 的事件处理器集合
   * @param {UiMessage} assistantMsg - 与流绑定的 assistant 消息（reactive proxy 引用）
   * @returns {object} 完整的事件回调对象
   */
  private buildStreamHandlers = (assistantMsg: UiMessage): object => ({
    onMeta: (p: { conversation_id: string; available_tools: AiToolMeta[] }) => {
      // 第一次发送时后端返回新建的 conversation_id
      if (!this.currentConversationId.value) {
        this.currentConversationId.value = p.conversation_id;
      }
      this.availableTools.value = p.available_tools;
    },
    onDelta: (p: { delta: string }) => {
      // 防御性检查：确保 delta 是字符串
      const delta = typeof p.delta === 'string' ? p.delta : String(p.delta ?? '');
      assistantMsg.content += delta;
      // 流式 delta 频率极高（每秒数十次），用 rAF 合并 + 尊重 autoFollow，避免抖动与打断用户回看
      this.scrollToBottomIfFollowing();
    },
    onReasoning: (p: { delta: string }) => {
      const delta = typeof p.delta === 'string' ? p.delta : String(p.delta ?? '');
      assistantMsg.reasoning = (assistantMsg.reasoning ?? '') + delta;
      this.scrollToBottomIfFollowing();
    },
    onToolStart: (p: { id: string; name: string }) => {
      assistantMsg.tool_calls.push({ id: p.id, name: p.name, arguments: '', status: 'pending' });
    },
    onToolArgs: (p: { id: string; delta: string }) => {
      const tc = this.findToolCall(assistantMsg, p.id);
      if (tc) tc.arguments += p.delta;
    },
    onToolExecuting: (p: { id: string; arguments: string }) => {
      const tc = this.findToolCall(assistantMsg, p.id);
      if (!tc) return;
      tc.status = 'executing';
      tc.arguments = p.arguments;
    },
    onToolResult: (p: { id: string; ok: boolean; data: unknown; summary?: string }) => {
      const tc = this.findToolCall(assistantMsg, p.id);
      if (!tc) return;
      tc.status = p.ok ? 'success' : 'failed';
      tc.result = p.data;
      tc.summary = p.summary;
    },
    onIterationEnd: () => {
      // 工具调用一轮结束（一般会插入工具卡片，高度跳变较大）→ 用跟随模式贴底，不打扰用户上滚
      this.scrollToBottomIfFollowing();
    },
    onPlanStart: (p: { goal: string; steps: Array<{ id: string; title: string; tool?: string }> }) => {
      const plan: UiPlan = {
        goal: p.goal,
        steps: p.steps.map((s): UiPlanStep => ({ id: s.id, title: s.title, tool: s.tool, status: 'pending' })),
      };
      assistantMsg.plan = plan;
      this.scrollToBottomIfFollowing();
    },
    onPlanStep: (p: { step_id: string; status: UiPlanStep['status'] }) => {
      const step = assistantMsg.plan?.steps.find((s) => s.id === p.step_id);
      if (step) step.status = p.status;
      this.scrollToBottomIfFollowing();
    },
    onReflection: (p: { round: number; complete: boolean; missing: string; hint: string }) => {
      const reflection: UiReflection = {
        round: p.round,
        complete: p.complete,
        missing: p.missing ?? '',
        hint: p.hint ?? '',
      };
      if (!assistantMsg.reflections) assistantMsg.reflections = [];
      assistantMsg.reflections.push(reflection);
      this.scrollToBottomIfFollowing();
    },
    onIterationUsage: (p: { iteration: number; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }) => {
      // 多轮工具调用场景下，每轮 usage 累加显示
      const prev = assistantMsg.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      assistantMsg.usage = {
        prompt_tokens: prev.prompt_tokens + (p.usage.prompt_tokens ?? 0),
        completion_tokens: prev.completion_tokens + (p.usage.completion_tokens ?? 0),
        total_tokens: prev.total_tokens + (p.usage.total_tokens ?? 0),
      };
    },
    onNotice: (p: { message: string }) => {
      if (!assistantMsg.notices) assistantMsg.notices = [];
      assistantMsg.notices.push(p.message);
      this.scrollToBottomIfFollowing();
    },
    onDone: () => this.finishStreamingSuccess(assistantMsg),
    onError: (p: { message: string }) => this.finishStreamingError(assistantMsg, p.message),
  });

  /**
   * 发送一条用户消息（流式）
   * @returns {Promise<void>}
   * @description 仅做：守卫校验 → 取/清输入框 → 委托 startNewTurn 启流
   */
  sendMessage = async (): Promise<void> => {
    if (!this.canSend.value) return;
    const text = this.input.value.trim();
    const images = [...this.pendingImages.value];
    this.input.value = '';
    this.pendingImages.value = [];
    this.startNewTurn(text, images);
  };

  /**
   * 添加待发送的图片附件
   * @param {File[]} files - 用户选择的文件列表
   * @returns {Promise<void>}
   * @description 先过滤出真正的图片文件，再逐张压缩为 Data URL 挂起；
   *   超过数量上限的部分丢弃并提示，压缩失败的单张跳过（不阻断其它图片）
   */
  attachImages = async (files: File[]): Promise<void> => {
    const tt = this.localeStore.t.aiChat;
    const images = pickImageFiles(files);
    if (images.length === 0) {
      MessagePlugin.warning(tt.imageInvalid);
      return;
    }
    const room = MAX_ATTACHED_IMAGES - this.pendingImages.value.length;
    if (room <= 0) {
      MessagePlugin.warning(tt.imageMaxCount.replace('{n}', String(MAX_ATTACHED_IMAGES)));
      return;
    }
    if (images.length > room) {
      MessagePlugin.warning(tt.imageMaxCount.replace('{n}', String(MAX_ATTACHED_IMAGES)));
    }
    for (const file of images.slice(0, room)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        this.pendingImages.value = [...this.pendingImages.value, dataUrl];
      } catch {
        MessagePlugin.warning(tt.imageProcessFailed);
      }
    }
  };

  /**
   * 移除指定下标的待发送图片
   * @param {number} index - 待移除图片的下标
   * @returns {void}
   */
  removePendingImage = (index: number): void => {
    this.pendingImages.value = this.pendingImages.value.filter((_, i) => i !== index);
  };

  /**
   * 重新回答：重发指定 assistant 消息之前的上一条用户消息
   * @param {string} assistantMsgId - 被点击「重新回答」的 assistant 消息 id
   * @returns {Promise<void>}
   * @description 仅做：守卫校验 → 查找上一条用户消息 → 委托 startNewTurn 启流
   */
  regenerateAnswer = async (assistantMsgId: string): Promise<void> => {
    if (this.streaming.value) return;
    const userText = this.findPrevUserText(assistantMsgId);
    if (!userText) {
      MessagePlugin.warning(this.localeStore.t.aiChat.regenerateNoUserMsg);
      return;
    }
    // 裁剪：定位该 assistant 之前的最近一条 user，并从该位置截断后续所有 UI 消息
    const list = this.uiMessages.value;
    const userIdx = findPrevUserIndex(list, assistantMsgId);
    if (userIdx >= 0) list.splice(userIdx);
    this.startNewTurn(userText);
  };

  /**
   * 从指定消息处分支出新会话
   * @param {string} msgId - 被点击「从此处分支」的消息 id
   * @returns {Promise<void>}
   * @description 复制该条及其之前的对话到新会话并切换过去，用于「换个问法重试」：
   *   保留上文、丢掉后续走向。会话还没落盘（新建后尚未发过消息）时无法分支。
   */
  forkConversation = async (msgId: string): Promise<void> => {
    const conversationId = this.currentConversationId.value;
    if (!conversationId) {
      MessagePlugin.warning(this.localeStore.t.aiChat.forkNoConversation);
      return;
    }
    if (this.streaming.value) return;
    const index = this.uiMessages.value.findIndex((m) => m.id === msgId);
    if (index < 0) return;
    try {
      const res = await this.service.forkConversation(conversationId, index + 1);
      const conv: ChatConversation = res.data.conversation;
      this.currentConversationId.value = conv.id;
      this.uiMessages.value = this.convertToUiMessages(conv.messages);
      MessagePlugin.success(this.localeStore.t.aiChat.forkSuccess);
      await this.loadConversations();
      void this.scrollToBottom();
    } catch {
      MessagePlugin.error(this.localeStore.t.aiChat.forkFailed);
    }
  };

  // ==============================
  // 复制消息
  // ==============================

  /**
   * 当前消息是否处于「已复制」反馈态
   * @param {string} id - UI 消息 id
   * @returns {boolean}
   */
  isCopied = (id: string): boolean => this.copiedIds.value.has(id);

  // writeClipboard 已抽到 utils/clipboard.ts，下方 copyMessage 直接复用

  /**
   * 复制 UI 消息原始文本到剪贴板，并触发 1.5s「已复制」反馈
   * @param {UiMessage} m - 要复制的 UI 消息
   * @returns {Promise<void>}
   */
  copyMessage = async (m: UiMessage): Promise<void> => {
    const text = m.content ?? '';
    if (!text) return;
    const ok = await writeClipboard(text);
    if (!ok) {
      MessagePlugin.error(this.localeStore.t.aiChat.copyFailed);
      return;
    }
    try {
      // 触发响应式更新：Set 需要替换引用才能让 isCopied 计算属性重算
      const next = new Set(this.copiedIds.value);
      next.add(m.id);
      this.copiedIds.value = next;
      const prev = this.copiedTimers.get(m.id);
      if (prev) clearTimeout(prev);
      const timer = setTimeout(() => {
        const after = new Set(this.copiedIds.value);
        after.delete(m.id);
        this.copiedIds.value = after;
        this.copiedTimers.delete(m.id);
      }, AiChatModel.COPIED_FEEDBACK_MS);
      this.copiedTimers.set(m.id, timer);
      MessagePlugin.success(this.localeStore.t.aiChat.copySuccess);
    } catch {
      MessagePlugin.error(this.localeStore.t.aiChat.copyFailed);
    }
  };

  // ==============================
  // 抽屉与视图事件
  // ==============================

  /**
   * 打开 AI 助手抽屉
   * @returns {void}
   */
  openDrawer = (): void => {
    this.visible.value = true;
  };

  /**
   * 关闭 AI 助手抽屉
   * @returns {void}
   * @description form-drawer @close 与头部关闭按钮共用此方法
   */
  closeDrawer = (): void => {
    this.visible.value = false;
  };

  /**
   * 抽屉显隐切换的统一处理（由视图层 watch(visible) 在打开后下一帧调用一次）
   * @param {boolean} open - 抽屉是否已打开
   * @param {HTMLElement | null} container - 模板 ref 拿到的消息滚动容器节点（仅 open=true 时使用）
   * @returns {Promise<void>}
   * @description 打开时 attach 滚动容器，关闭时 detach
   */
  onDrawerVisibleChange = async (open: boolean, container: HTMLElement | null): Promise<void> => {
    if (open) {
      document.body.dataset.aiChatOpen = '1';
      // 视图层调用前已 await nextTick 拿到容器节点，这里直接 attach
      if (container) {
        this.attachScrollContainer(container);
        // 打开抽屉后强制贴底，防止 autoFollow 被上一次会话残留为 false
        void this.scrollToBottom();
      }
    } else {
      delete document.body.dataset.aiChatOpen;
      this.detachScrollContainer();
    }
  };

  /**
   * 点击欢迎页示例问题：填入输入框并立即发送
   * @param {string} ex - 示例问题文本
   * @returns {Promise<void>}
   */
  sendExample = async (ex: string): Promise<void> => {
    this.input.value = ex;
    await this.sendMessage();
  };

  /**
   * 分享当前会话（预留入口）
   * @returns {void}
   * @description 后续接入分享能力，目前仅作占位提示
   */
  share = (): void => {
    // TODO: 分享能力接入
    MessagePlugin.info('分享功能正在开发中，敬请期待');
    console.info('[ai-chat] share clicked');
  };

  /**
   * 根据消息 id 复制对应消息内容到剪贴板
   * @param {string} msgId - 被复制的消息 id
   * @returns {Promise<void>}
   * @description 视图层 chat-message-bubble 仅向上抛 id，由 model 集中查找消息并写入剪贴板
   */
  copyMessageById = async (msgId: string): Promise<void> => {
    const target = this.uiMessages.value.find((m) => m.id === msgId);
    if (target) await this.copyMessage(target);
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动 resize 监听 + 拉取健康状态 + 加载会话列表
   */
  mounted = async (): Promise<void> => {
    this.startResizeListener();
    await this.loadHealth();
    await this.loadModels();
    await this.loadSkills();
    await this.loadTools();
    await this.loadConversations();
    // 默认选中第一个会话；没有会话则保持空白等用户首次发消息时自动创建
    if (this.conversations.value.length > 0) {
      await this.loadConversation(this.conversations.value[0].id);
    }
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 终止流式请求、移除 resize 监听、清理复制反馈计时器、
   */
  beforeUnmount = (): void => {
    this.stopStreaming();
    this.stopResizeListener();
    this.detachScrollContainer();
    for (const timer of this.copiedTimers.values()) {
      clearTimeout(timer);
    }
    this.copiedTimers.clear();
    delete document.body.dataset.aiChatOpen;
  };
}

/**
 * Composition API 包装函数
 * @description 将 AiChatModel 类包装为 Composition API 可用的函数
 */
export const useAiChatModel = () => {
  const model = new AiChatModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => {
    void model.mounted();
  });

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => {
    model.beforeUnmount();
  });

  return {
    ...model,
    // 权限
    Permission,
    // 常量
    DEFAULT_CONVERSATION_TITLE,
  };
};
