import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import Sortable from 'sortablejs';
import { MessagePlugin } from 'tdesign-vue-next';
import { ConfigService } from '@/services/config-service';
import { READONLY_KEYS } from '@/constants/config';
import PROVINCE_CITY_DATA from '@/data/city-data';
import { useWebhooksStore } from '@/stores/webhooks';
import { useTemplatesStore } from '@/stores/templates';
import { useStatusStore } from '@/stores/status';
import { usePlaygroundStore } from '@/stores/playground';
import type { TemplateItem } from '@/types/playground';
import type { AutoFormField } from '@/types/auto-form';
import { enhanceFields, type HandlerRegistry } from '@/utils/field-enhancer';
import { createConfigHandlers, mergeHandlerRegistries } from '@/utils/handler-registry';
import { readSectionColumns, writeSectionColumns } from '@/utils/config-section-order';
import type { AutoFormRef, ConfigWebHook } from '@/types/config';
import type { WebhookPayload } from '@/types/webhook';
import { BaseModel, Permission } from '@/models/base-model';
import { WebhookInlineFormData } from '@/data/initiate-data';

/** 系统配置页单个分区（sections 数组元素） */
interface ConfigSectionItem {
  /** 分区标识（编辑态、表单 ref 注册都以它为键） */
  key: string;
  /** 分区标题（i18n） */
  title: string;
  /** 图标名 */
  icon: string;
  /** 图标颜色 */
  iconColor: string;
  /** 顶部渐变条颜色 */
  barColor: string;
  /** 表单数据；webhook 分区无 auto-form，为 null */
  form: Ref<Record<string, unknown>> | null;
  /** auto-form 字段配置 */
  fields: AutoFormField[];
}

/**
 * 配置页面数据模型类
 * @description 管理配置页面的所有业务逻辑，包括配置加载、保存、编辑状态管理、Webhook 管理等
 */
export class ConfigModel extends BaseModel {
  // ==============================
  // 依赖注入（store、service）
  // ==============================

  /**
   * Webhooks 状态存储实例
   * @type {ReturnType<typeof useWebhooksStore>}
   * @description 用于访问和修改企业微信 Webhook 配置
   */
  webhooksStore: ReturnType<typeof useWebhooksStore> = useWebhooksStore();

  /**
   * 消息模板配置全局存储实例
   * @type {ReturnType<typeof useTemplatesStore>}
   * @description 共享模板类型和风格数据
   */
  private templatesStore: ReturnType<typeof useTemplatesStore> = useTemplatesStore();

  /**
   * 配置服务实例
   * @type {ConfigService}
   * @description 用于加载、保存 .env 配置项
   */
  private configService: ConfigService = new ConfigService();

  /**
   * 系统状态存储实例
   * @type {ReturnType<typeof useStatusStore>}
   * @description 复用全局 store，避免重复请求系统状态
   */
  private statusStore: ReturnType<typeof useStatusStore> = useStatusStore();

  /**
   * Playground 模板全局存储实例
   * @type {ReturnType<typeof usePlaygroundStore>}
   * @description 缓存全量模板，避免重复请求
   */
  private playgroundStore: ReturnType<typeof usePlaygroundStore> = usePlaygroundStore();

  /**
   * 从 JSON 加载的原始字段模板缓存
   * @type {Ref<Record<string, unknown[]>>}
   * @description key 为模板 id，使用 ref 确保响应式更新
   */
  private rawTemplates: Ref<Record<string, unknown[]>> = ref({});

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 当前正在编辑的 section key
   * @type {Ref<string | null>}
   * @description null 表示无编辑中的 section
   */
  editingKey: Ref<string | null> = ref(null);

  /**
   * 原始配置数据
   * @type {Ref<Record<string, string>>}
   * @description 用于取消编辑时恢复原状
   */
  originalConfig: Ref<Record<string, string>> = ref<Record<string, string>>({});

  // ── 分 section 的表单数据 ─────────────────────────────

  /**
   * 天气服务表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 挶求天气接口 key 与选中的省/城市
   */
  weatherForm: Ref<Record<string, unknown>> = ref({
    JUHE_WEATHER_KEY: '',
    _selectedProvince: '',
    WEATHER_CITY_NAME: '',
  });

  /**
   * 老黄历服务表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 挶求老黄历接口 key
   */
  almanacForm: Ref<Record<string, unknown>> = ref({
    JUHE_ALMANAC_KEY: '',
  });

  /**
   * 星座运势服务表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 挶求星座运势接口 key
   */
  horoscopeForm: Ref<Record<string, unknown>> = ref({
    JUHE_HOROSCOPE_KEY: '',
  });

  /**
   * 高德地图服务表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 高德 Web 服务 Key、通勤卡的默认起终点（家 / 公司），
   *              以及地图选点用的 JS API Key 与安全密钥
   */
  amapForm: Ref<Record<string, unknown>> = ref({
    AMAP_KEY: '',
    AMAP_HOME_ADDR: '',
    AMAP_WORK_ADDR: '',
    AMAP_JS_KEY: '',
    AMAP_JS_SECRET: '',
  });

  /**
   * 项目配置表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 项目路径、后端、前端端口等项目级配置
   */
  projectForm: Ref<Record<string, unknown>> = ref({
    PROJECT_DIR: '',
    WEB_PORT: '',
    VITE_PORT: '',
  });

  /**
   * 生日提醒表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 生日名单、提前天数、提醒时间等
   */
  birthdayForm: Ref<Record<string, unknown>> = ref({
    BIRTHDAY_LIST: '',
    BIRTHDAY_ADVANCE_DAYS: '0',
    BIRTHDAY_REMINDER_TIME: '09:00',
    BIRTHDAY_SEND_ON_BIRTHDAY: false,
  });

  /**
   * 卡片全局配置表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 面向所有技能卡片生成逻辑生效
   */
  skillsMapForm: Ref<Record<string, unknown>> = ref({
    SKILL_CARD_SEND_ON_WECHAT: false,
    CARD_WATERMARK: '',
    CARD_CURL_TIMEOUT: '10',
    CARD_TIMEZONE: 'Asia/Shanghai',
  });

  /**
   * 邮件配置表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description Web 管理界面登录验证码所依赖的 SMTP 配置
   */
  mailForm: Ref<Record<string, unknown>> = ref({
    MAIL_HOST: '',
    MAIL_PORT: '465',
    MAIL_USERNAME: '',
    MAIL_PASSWORD: '',
    MAIL_ENCRYPTION: 'ssl',
    MAIL_FROM_ADDRESS: '',
    MAIL_FROM_NAME: '',
    DEFAULT_AUTH_CODE: '',
  });

  /**
   * 定时巡检与外部消息入口表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 巡检开关、时间/cron、是否推群、执行身份、补跑窗口与失败上限，以及外部渠道令牌
   */
  inspectorForm: Ref<Record<string, unknown>> = ref({
    AI_INSPECTOR_ENABLED: false,
    AI_INSPECTOR_TIME: '09:30',
    AI_INSPECTOR_SCHEDULE: '',
    AI_INSPECTOR_PUSH: true,
    AI_INSPECTOR_EMAIL: '',
    AI_INSPECTOR_CATCHUP_MINUTES: '60',
    AI_INSPECTOR_MAX_FAILS: '3',
    AI_CHAT_WEBHOOK_TOKEN: '',
    AI_CHAT_WEBHOOK_EMAIL: '',
    AI_CHAT_WEBHOOK_ALLOW_SIDE_EFFECTS: false,
  });

  /**
   * 定时任务调度表单数据
   * @type {Ref<Record<string, unknown>>}
   * @description 提醒守护进程与年度调度器的节拍、触发窗口，以及各任务的时间点与开关。
   *   改完由守护进程下一轮循环自动读取，无需重启
   */
  scheduleForm: Ref<Record<string, unknown>> = ref({
    SCHED_POLL_SECONDS: '30',
    SCHED_WINDOW_MINUTES: '2',
    SCHED_PREFETCH_TIME: '01:00',
    SCHED_PREFETCH_BACKUP_TIME: '07:55',
    SCHED_ANNUAL_POLL_SECONDS: '60',
    SCHED_ANNUAL_UPDATE_DATE: '12-31',
    SCHED_ANNUAL_UPDATE_TIME: '23:59',
    SCHED_LOG_CLEAN_DAYS: ['01', '15'],
    SCHED_LOG_CLEAN_TIME: '00:01',
  });

  // ── auto-form ref（通过 sections 统一管理）────────────────────

  /**
   * 各 section 的 auto-form 组件实例集合
   * @type {Record<string, AutoFormRef>}
   * @description key 为 section key，value 为对应表单的组件实例
   */
  private formRefs: Record<string, AutoFormRef> = {};

  // ── Webhook 行内编辑状态 ────────────────────────────

  /**
   * 当前行内编辑的 Webhook id
   * @type {Ref<string | null>}
   * @description null 表示无编辑中的行
   */
  editingWebhookId: Ref<string | null> = ref(null);

  /**
   * 是否正在展示新增表单
   * @type {Ref<boolean>}
   * @description 控制新增 Webhook 表单的显隐
   */
  isAddingWebhook: Ref<boolean> = ref(false);

  /**
   * 行内编辑表单数据
   * @type {Ref<ConfigWebHook>}
   * @description 编辑/新增共用的行内表单数据；初始值来自 initiate-data 中的 WebhookInlineFormData
   */
  webhookInlineForm: Ref<ConfigWebHook> = ref({ ...WebhookInlineFormData });

  /**
   * 行内表单保存状态
   * @type {Ref<boolean>}
   * @description 是否正在提交保存
   */
  webhookInlineSaving: Ref<boolean> = ref(false);

  /**
   * 行内表单 auto-form 组件实例引用
   * @type {AutoFormRef}
   * @description 用于提交前调用 validate() 验证表单
   */
  private webhookFormRef: AutoFormRef = null;

  // ── 卡片拖拽排序 ───────────────────────────────

  /**
   * 配置分区的双列顺序
   * @type {Ref<string[][]>}
   * @description 每列各自的 section key 列表；跨列拖拽保留卡片实际所在列，写入 localStorage
   */
  sectionColumnKeys: Ref<string[][]> = ref(readSectionColumns());

  /** 瀑布流列容器 DOM 引用（按列索引） */
  private columnEls: Array<HTMLElement | null> = [];

  /** 各列容器的 Sortable 实例 */
  private sortableInstances: Array<Sortable | null> = [];

  /** 稳定的列容器 ref 回调缓存，避免每次渲染重复创建 Sortable */
  private columnRefCallbacks: Array<(el: unknown) => void> = [];

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 是否包含生日配置
   * @type {ComputedRef<boolean>}
   * @description 配置中是否存在生日相关的键
   */
  hasBirthdayConfig: ComputedRef<boolean> = computed(() =>
    ['BIRTHDAY_LIST', 'BIRTHDAY_ADVANCE_DAYS', 'BIRTHDAY_SEND_ON_BIRTHDAY', 'BIRTHDAY_REMINDER_TIME']
      .some((k) => k in this.originalConfig.value),
  );

  // ==============================
  // Handler 注册表（供 field-enhancer 替换 $handler:xxx）
  // ==============================

  /**
   * 获取 config 页面的 handler 注册表
   * @description 合并 config + messageTemplates handler，使 Webhook 表单的推送风格字段能正确解析
   */
  private get configHandlers(): HandlerRegistry {
    return mergeHandlerRegistries(
      createConfigHandlers({
        editingWebhookId: this.editingWebhookId.value,
      }),
      this.templatesStore.createHandlers(),
    );
  }

  // ==============================
  // Section 配置（auto-form fields）—— 从 JSON 模板增强
  // ==============================

  /**
   * 去掉值首尾成对的引号
   * @param {string} value - 原始值
   * @returns {string} 去引号后的值
   * @description .env 里按约定「值含特殊字符时带引号写入」（写入侧保存时会自动补回），
   *   回显给用户看/编辑时应是裸值
   */
  private stripQuotes(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
      const head = trimmed[0];
      if ((head === '"' || head === "'") && trimmed.endsWith(head)) {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }

  /**
   * 从缓存获取指定模板并增强
   * @param {string} id - 模板 id
   * @returns {AutoFormField[]} 增强后的字段配置
   */
  private getEnhancedFields(id: string): AutoFormField[] {
    const raw = this.rawTemplates.value[id];
    if (!raw || raw.length === 0) return [];
    return enhanceFields(raw, this.configHandlers);
  }

  /**
   * 天气服务字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get weatherFields(): AutoFormField[] {
    return this.getEnhancedFields('config-weather');
  }

  /**
   * 老黄历服务字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get almanacFields(): AutoFormField[] {
    return this.getEnhancedFields('config-almanac');
  }

  /**
   * 星座运势服务字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get horoscopeFields(): AutoFormField[] {
    return this.getEnhancedFields('config-horoscope');
  }

  /**
   * 高德地图服务字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get amapFields(): AutoFormField[] {
    return this.getEnhancedFields('config-amap');
  }

  /**
   * 项目配置字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get projectFields(): AutoFormField[] {
    return this.getEnhancedFields('config-project');
  }

  /**
   * 生日提醒字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get birthdayFields(): AutoFormField[] {
    return this.getEnhancedFields('config-birthday');
  }

  /**
   * 卡片全局配置字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get skillsMapFields(): AutoFormField[] {
    return this.getEnhancedFields('config-skills-map');
  }

  /**
   * 邮件配置字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get mailFields(): AutoFormField[] {
    const fields = this.getEnhancedFields('config-mail');
    // 运行时模板可能尚未同步新字段，兜底注入，保证默认验证码始终可配置
    if (fields.some((field) => field.name === 'DEFAULT_AUTH_CODE')) return fields;
    const fallback = enhanceFields([{
      name: 'DEFAULT_AUTH_CODE',
      label: '$t:playground.schema.defaultAuthCodeLabel',
      type: 'input',
      placeholder: '$t:playground.schema.defaultAuthCodePlaceholder',
      help: '$t:playground.schema.defaultAuthCodeHelp',
      clearable: true,
      maxlength: 6,
      rules: [{ pattern: '^[0-9]{0,6}$', message: '$t:playground.schema.defaultAuthCodePattern', trigger: 'blur' }],
    }], this.configHandlers);
    return [...fields, ...fallback];
  }

  /**
   * 定时巡检与外部消息入口字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get inspectorFields(): AutoFormField[] {
    return this.getEnhancedFields('config-inspector');
  }

  /**
   * 定时任务调度字段配置
   * @returns {AutoFormField[]} 从 JSON 模板增强后的字段配置
   */
  private get scheduleFields(): AutoFormField[] {
    return this.getEnhancedFields('config-schedule');
  }

  // ==============================
  // Sections 数组（供模板 v-for 使用）
  // ==============================

  /**
   * 所有表单 section 的配置列表（不含企业微信 Webhook）
   * @type {ComputedRef<ConfigSectionItem[]>}
   * @description 每项包含 key、标题、图标、颜色、表单数据、字段配置。
   *   必须显式标注返回类型：computed 内部引用了 this 上的多个 Ref，
   *   不标注会与实例类型互相依赖形成推断环，导致 view 层解构 t 时报 ts(7022)。
   */
  sections: ComputedRef<ConfigSectionItem[]> = computed(() => {
    const list: ConfigSectionItem[] = [
      {
        key: 'webhook',
        title: this.localeStore.t.config.sectionWebhook,
        icon: 'chat',
        iconColor: '#07c160',
        barColor: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
        form: null,
        fields: this.getEnhancedFields('config-webhook'),
      },
      {
        key: 'weather',
        title: this.localeStore.t.config.sectionWeather,
        icon: 'cloud',
        iconColor: '#10b981',
        barColor: 'linear-gradient(180deg, #10b981, #34d399)',
        form: this.weatherForm,
        fields: this.weatherFields,
      },
      {
        key: 'almanac',
        title: this.localeStore.t.config.sectionAlmanac,
        icon: 'calendar',
        iconColor: '#f59e0b',
        barColor: 'linear-gradient(180deg, #f59e0b, #fbbf24)',
        form: this.almanacForm,
        fields: this.almanacFields,
      },
      {
        key: 'horoscope',
        title: this.localeStore.t.config.sectionHoroscope,
        icon: 'star',
        iconColor: '#8b5cf6',
        barColor: 'linear-gradient(180deg, #8b5cf6, #a78bfa)',
        form: this.horoscopeForm,
        fields: this.horoscopeFields,
      },
      {
        key: 'amap',
        title: this.localeStore.t.config.sectionAmap,
        icon: 'location',
        iconColor: '#0ea5e9',
        barColor: 'linear-gradient(180deg, #0284c7, #38bdf8)',
        form: this.amapForm,
        fields: this.amapFields,
      },
      {
        key: 'project',
        title: this.localeStore.t.config.sectionProject,
        icon: 'folder',
        iconColor: '#a78bfa',
        barColor: 'linear-gradient(180deg, #a78bfa, #c4b5fd)',
        form: this.projectForm,
        fields: this.projectFields,
      },
      {
        key: 'birthday',
        title: this.localeStore.t.config.sectionBirthday,
        icon: 'gift',
        iconColor: '#f43f5e',
        barColor: 'linear-gradient(180deg, #f43f5e, #fb7185)',
        form: this.birthdayForm,
        fields: this.birthdayFields,
      },
      {
        key: 'skillsMap',
        title: this.localeStore.t.config.sectionSkillsMap,
        icon: 'palette',
        iconColor: '#0ea5e9',
        barColor: 'linear-gradient(180deg, #0ea5e9, #38bdf8)',
        form: this.skillsMapForm,
        fields: this.skillsMapFields,
      },
      {
        key: 'mail',
        title: this.localeStore.t.config.sectionMail,
        icon: 'mail',
        iconColor: '#f97316',
        barColor: 'linear-gradient(180deg, #f97316, #fb923c)',
        form: this.mailForm,
        fields: this.mailFields,
      },
      {
        key: 'inspector',
        title: this.localeStore.t.config.sectionInspector,
        icon: 'time',
        iconColor: '#0ea5e9',
        barColor: 'linear-gradient(180deg, #0ea5e9, #38bdf8)',
        form: this.inspectorForm,
        fields: this.inspectorFields,
      },
      {
        key: 'schedule',
        title: this.localeStore.t.config.sectionSchedule,
        icon: 'setting',
        iconColor: '#14b8a6',
        barColor: 'linear-gradient(180deg, #14b8a6, #2dd4bf)',
        form: this.scheduleForm,
        fields: this.scheduleFields,
      },
    ];
    const columns = this.sectionColumnKeys.value;
    const order = columns.length === 2 ? this.interleaveColumns(columns) : [];
    const rank = new Map(order.map((key, index) => [key, index] as const));
    return [...list].sort((a, b) =>
      (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER),
    );
  });

  /**
   * 瀑布流分列后的配置分区
   * @type {ComputedRef<ConfigSectionItem[][]>}
   * @description 桌面按已保存的列归属渲染两列，移动端合并为单列；每列独立纵向堆叠，
   *   卡片保持内容高度不被拉齐，跨列拖拽后也不会被重新弹回原列
   */
  sectionColumns: ComputedRef<ConfigSectionItem[][]> = computed(() => {
    const list = this.sections.value;
    if (this.isMobile.value) return [list];
    const saved = this.sectionColumnKeys.value;
    const keys = saved.length === 2 ? saved : this.splitByParity(list.map((section) => section.key));
    const byKey = new Map(list.map((section) => [section.key, section] as const));
    const columns: ConfigSectionItem[][] = keys.map((column) =>
      column.map((key) => byKey.get(key)).filter((section): section is ConfigSectionItem => !!section),
    );
    // 新增的分区补进两列，避免因旧缓存缺 key 而漏渲染
    const included = new Set(keys.flat());
    list.filter((section) => !included.has(section.key))
      .forEach((section, index) => columns[index % 2].push(section));
    return columns;
  });

  // ==============================
  // 私有方法
  // ==============================

  /**
   * 根据城市名查找所属省份
   * @param {string} cityName - 城市名称
   * @returns {string} 省份 value，未找到时返回空字符串
   */
  private findProvinceByCity = (cityName: string): string => {
    const province = PROVINCE_CITY_DATA.find((p) =>
      p.cities.some((c) => c.value === cityName),
    );
    return province?.value ?? '';
  };

  /**
   * 将原始配置数据填充到各 section 表单
   * @param {Record<string, string>} config - 原始配置键值对
   * @param {string} projectDir - 项目目录（来自 status 接口）
   */
  private fillForms = (config: Record<string, string>, projectDir?: string): void => {
    const selectedProvince = config.WEATHER_CITY_NAME
      ? this.findProvinceByCity(config.WEATHER_CITY_NAME)
      : '';

    this.weatherForm.value = {
      JUHE_WEATHER_KEY: config.JUHE_WEATHER_KEY ?? '',
      _selectedProvince: selectedProvince,
      WEATHER_CITY_NAME: config.WEATHER_CITY_NAME ?? '',
      _isEditing: false,
    };

    this.almanacForm.value = {
      JUHE_ALMANAC_KEY: config.JUHE_ALMANAC_KEY ?? '',
      _isEditing: false,
    };

    this.horoscopeForm.value = {
      JUHE_HOROSCOPE_KEY: config.JUHE_HOROSCOPE_KEY ?? '',
      _isEditing: false,
    };

    this.amapForm.value = {
      AMAP_KEY: config.AMAP_KEY ?? '',
      // 地址值按约定以引号写入 .env（防 shell 特殊字符），回显时剥掉，避免概览/编辑态看到引号
      AMAP_HOME_ADDR: this.stripQuotes(config.AMAP_HOME_ADDR ?? ''),
      AMAP_WORK_ADDR: this.stripQuotes(config.AMAP_WORK_ADDR ?? ''),
      AMAP_JS_KEY: config.AMAP_JS_KEY ?? '',
      AMAP_JS_SECRET: config.AMAP_JS_SECRET ?? '',
      _isEditing: false,
    };

    this.projectForm.value = {
      PROJECT_DIR: projectDir ?? config.PROJECT_DIR ?? '',
      WEB_PORT: config.WEB_PORT ?? '',
      VITE_PORT: config.VITE_PORT ?? '',
    };

    // 生日相关字段（带格式转换）
    const birthdayList = (config.BIRTHDAY_LIST ?? '').replace(/^"|"$/g, '');
    const reminderTime = (config.BIRTHDAY_REMINDER_TIME ?? '09:00').replace(/^"|"$/g, '');
    this.birthdayForm.value = {
      BIRTHDAY_LIST: birthdayList,
      BIRTHDAY_ADVANCE_DAYS: config.BIRTHDAY_ADVANCE_DAYS ?? '0',
      BIRTHDAY_REMINDER_TIME: reminderTime,
      BIRTHDAY_SEND_ON_BIRTHDAY: config.BIRTHDAY_SEND_ON_BIRTHDAY === 'true',
    };

    // 卡片全局配置（SKILL_CARD_SEND_ON_WECHAT 为 switch 需转成 boolean）
    this.skillsMapForm.value = {
      SKILL_CARD_SEND_ON_WECHAT: config.SKILL_CARD_SEND_ON_WECHAT === 'true',
      CARD_WATERMARK: config.CARD_WATERMARK ?? '龙哥',
      CARD_CURL_TIMEOUT: config.CARD_CURL_TIMEOUT ?? '10',
      CARD_TIMEZONE: config.CARD_TIMEZONE ?? 'Asia/Shanghai',
    };

    // 邮件配置（登录验证码）
    this.mailForm.value = {
      MAIL_HOST: config.MAIL_HOST ?? '',
      MAIL_PORT: config.MAIL_PORT ?? '465',
      MAIL_USERNAME: config.MAIL_USERNAME ?? '',
      MAIL_PASSWORD: config.MAIL_PASSWORD ?? '',
      MAIL_ENCRYPTION: config.MAIL_ENCRYPTION ?? 'ssl',
      MAIL_FROM_ADDRESS: config.MAIL_FROM_ADDRESS ?? '',
      MAIL_FROM_NAME: config.MAIL_FROM_NAME ?? '',
      DEFAULT_AUTH_CODE: config.DEFAULT_AUTH_CODE ?? '',
    };

    // 长期记忆与单价表已下沉到每个模型配置组，由 /api/ai-model-configs 单独加载

    // 定时巡检与外部消息入口
    this.inspectorForm.value = {
      AI_INSPECTOR_ENABLED: config.AI_INSPECTOR_ENABLED === 'true',
      AI_INSPECTOR_TIME: (config.AI_INSPECTOR_TIME ?? '09:30').replace(/^"|"$/g, ''),
      AI_INSPECTOR_SCHEDULE: config.AI_INSPECTOR_SCHEDULE ?? '',
      AI_INSPECTOR_PUSH: config.AI_INSPECTOR_PUSH !== 'false',
      AI_INSPECTOR_EMAIL: config.AI_INSPECTOR_EMAIL ?? '',
      AI_INSPECTOR_CATCHUP_MINUTES: config.AI_INSPECTOR_CATCHUP_MINUTES ?? '60',
      AI_INSPECTOR_MAX_FAILS: config.AI_INSPECTOR_MAX_FAILS ?? '3',
      AI_CHAT_WEBHOOK_TOKEN: config.AI_CHAT_WEBHOOK_TOKEN ?? '',
      AI_CHAT_WEBHOOK_EMAIL: config.AI_CHAT_WEBHOOK_EMAIL ?? '',
      AI_CHAT_WEBHOOK_ALLOW_SIDE_EFFECTS: config.AI_CHAT_WEBHOOK_ALLOW_SIDE_EFFECTS === 'true',
    };

    // 定时任务调度（时间留空即停用该任务；清理日期是逗号分隔字符串，回填成多选数组）
    const asText = (v: unknown, fallback: string): string => String(v ?? fallback).replace(/^"|"$/g, '');
    const asDays = (v: unknown, fallback: string): string[] => {
      const raw = String(v ?? fallback).replace(/^"|"$/g, '').trim();
      return raw ? raw.split(',').map((d) => d.trim()).filter(Boolean) : [];
    };
    this.scheduleForm.value = {
      SCHED_POLL_SECONDS: asText(config.SCHED_POLL_SECONDS, '30'),
      SCHED_WINDOW_MINUTES: asText(config.SCHED_WINDOW_MINUTES, '2'),
      SCHED_PREFETCH_TIME: asText(config.SCHED_PREFETCH_TIME, '01:00'),
      SCHED_PREFETCH_BACKUP_TIME: asText(config.SCHED_PREFETCH_BACKUP_TIME, '07:55'),
      SCHED_ANNUAL_POLL_SECONDS: asText(config.SCHED_ANNUAL_POLL_SECONDS, '60'),
      SCHED_ANNUAL_UPDATE_DATE: asText(config.SCHED_ANNUAL_UPDATE_DATE, '12-31'),
      SCHED_ANNUAL_UPDATE_TIME: asText(config.SCHED_ANNUAL_UPDATE_TIME, '23:59'),
      SCHED_LOG_CLEAN_DAYS: asDays(config.SCHED_LOG_CLEAN_DAYS, '01,15'),
      SCHED_LOG_CLEAN_TIME: asText(config.SCHED_LOG_CLEAN_TIME, '00:01'),
    };
  };

  /**
   * 将各 section 表单数据合并为配置键值对
   * @returns {Record<string, string>} 合并后的配置键值对
   */
  private collectForms = (): Record<string, string> => {
    const weather = this.weatherForm.value;
    const almanac = this.almanacForm.value;
    const horoscope = this.horoscopeForm.value;
    const amap = this.amapForm.value;
    const project = this.projectForm.value;
    const birthday = this.birthdayForm.value;
    const skillsMap = this.skillsMapForm.value;
    const inspector = this.inspectorForm.value;
    const schedule = this.scheduleForm.value;
    const mail = this.mailForm.value;

    const result: Record<string, string> = {
      JUHE_WEATHER_KEY: String(weather.JUHE_WEATHER_KEY ?? ''),
      WEATHER_CITY_NAME: String(weather.WEATHER_CITY_NAME ?? ''),
      JUHE_ALMANAC_KEY: String(almanac.JUHE_ALMANAC_KEY ?? ''),
      JUHE_HOROSCOPE_KEY: String(horoscope.JUHE_HOROSCOPE_KEY ?? ''),
      AMAP_KEY: String(amap.AMAP_KEY ?? ''),
      AMAP_HOME_ADDR: String(amap.AMAP_HOME_ADDR ?? ''),
      AMAP_WORK_ADDR: String(amap.AMAP_WORK_ADDR ?? ''),
      AMAP_JS_KEY: String(amap.AMAP_JS_KEY ?? ''),
      AMAP_JS_SECRET: String(amap.AMAP_JS_SECRET ?? ''),
      WEB_PORT: String(project.WEB_PORT ?? ''),
      VITE_PORT: String(project.VITE_PORT ?? ''),
      SKILL_CARD_SEND_ON_WECHAT: skillsMap.SKILL_CARD_SEND_ON_WECHAT ? 'true' : 'false',
      CARD_WATERMARK: String(skillsMap.CARD_WATERMARK ?? ''),
      CARD_CURL_TIMEOUT: String(skillsMap.CARD_CURL_TIMEOUT ?? ''),
      CARD_TIMEZONE: String(skillsMap.CARD_TIMEZONE ?? ''),
      MAIL_HOST: String(mail.MAIL_HOST ?? ''),
      MAIL_PORT: String(mail.MAIL_PORT ?? ''),
      MAIL_USERNAME: String(mail.MAIL_USERNAME ?? ''),
      MAIL_PASSWORD: String(mail.MAIL_PASSWORD ?? ''),
      MAIL_ENCRYPTION: String(mail.MAIL_ENCRYPTION ?? ''),
      MAIL_FROM_ADDRESS: String(mail.MAIL_FROM_ADDRESS ?? ''),
      MAIL_FROM_NAME: String(mail.MAIL_FROM_NAME ?? ''),
      DEFAULT_AUTH_CODE: String(mail.DEFAULT_AUTH_CODE ?? ''),
      AI_INSPECTOR_ENABLED: inspector.AI_INSPECTOR_ENABLED ? 'true' : 'false',
      AI_INSPECTOR_TIME: String(inspector.AI_INSPECTOR_TIME ?? ''),
      AI_INSPECTOR_SCHEDULE: String(inspector.AI_INSPECTOR_SCHEDULE ?? ''),
      AI_INSPECTOR_PUSH: inspector.AI_INSPECTOR_PUSH ? 'true' : 'false',
      AI_INSPECTOR_EMAIL: String(inspector.AI_INSPECTOR_EMAIL ?? ''),
      AI_INSPECTOR_CATCHUP_MINUTES: String(inspector.AI_INSPECTOR_CATCHUP_MINUTES ?? ''),
      AI_INSPECTOR_MAX_FAILS: String(inspector.AI_INSPECTOR_MAX_FAILS ?? ''),
      AI_CHAT_WEBHOOK_TOKEN: String(inspector.AI_CHAT_WEBHOOK_TOKEN ?? ''),
      AI_CHAT_WEBHOOK_EMAIL: String(inspector.AI_CHAT_WEBHOOK_EMAIL ?? ''),
      AI_CHAT_WEBHOOK_ALLOW_SIDE_EFFECTS: inspector.AI_CHAT_WEBHOOK_ALLOW_SIDE_EFFECTS ? 'true' : 'false',
      SCHED_POLL_SECONDS: String(schedule.SCHED_POLL_SECONDS ?? ''),
      SCHED_WINDOW_MINUTES: String(schedule.SCHED_WINDOW_MINUTES ?? ''),
      SCHED_PREFETCH_TIME: `"${String(schedule.SCHED_PREFETCH_TIME ?? '')}"`,
      SCHED_PREFETCH_BACKUP_TIME: `"${String(schedule.SCHED_PREFETCH_BACKUP_TIME ?? '')}"`,
      SCHED_ANNUAL_POLL_SECONDS: String(schedule.SCHED_ANNUAL_POLL_SECONDS ?? ''),
      SCHED_ANNUAL_UPDATE_DATE: String(schedule.SCHED_ANNUAL_UPDATE_DATE ?? ''),
      SCHED_ANNUAL_UPDATE_TIME: `"${String(schedule.SCHED_ANNUAL_UPDATE_TIME ?? '')}"`,
      SCHED_LOG_CLEAN_DAYS: Array.isArray(schedule.SCHED_LOG_CLEAN_DAYS)
        ? (schedule.SCHED_LOG_CLEAN_DAYS as string[]).join(',')
        : String(schedule.SCHED_LOG_CLEAN_DAYS ?? ''),
      SCHED_LOG_CLEAN_TIME: `"${String(schedule.SCHED_LOG_CLEAN_TIME ?? '')}"`,
    };

    // 生日字段（带格式转换）
    if (this.hasBirthdayConfig.value) {
      const list = String(birthday.BIRTHDAY_LIST ?? '');
      result.BIRTHDAY_LIST = list ? `"${list}"` : '';
      result.BIRTHDAY_ADVANCE_DAYS = String(birthday.BIRTHDAY_ADVANCE_DAYS ?? '0');
      const time = String(birthday.BIRTHDAY_REMINDER_TIME ?? '09:00');
      result.BIRTHDAY_REMINDER_TIME = time ? `"${time}"` : '';
      result.BIRTHDAY_SEND_ON_BIRTHDAY = birthday.BIRTHDAY_SEND_ON_BIRTHDAY ? 'true' : 'false';
    }

    return result;
  };

  /**
   * 同步 _isEditing 标志到指定 section 表单（用于 inputType 动态切换）
   * @param {string} key - section key
   * @param {boolean} editing - 是否编辑中
   */
  private syncEditingFlag = (key: string, editing: boolean): void => {
    if (key === 'weather') {
      this.weatherForm.value = { ...this.weatherForm.value, _isEditing: editing };
    } else if (key === 'almanac') {
      this.almanacForm.value = { ...this.almanacForm.value, _isEditing: editing };
    } else if (key === 'horoscope') {
      this.horoscopeForm.value = { ...this.horoscopeForm.value, _isEditing: editing };
    }
  };

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 设置指定 section 的 auto-form ref
   * @param {string} key - section key
   * @param {unknown} el - 组件实例
   */
  setSectionFormRef = (key: string, el: unknown): void => {
    this.formRefs[key] = el as AutoFormRef;
  };

  /**
   * 进入指定 section 的编辑模式
   * @param {string} key - section key
   */
  toggleEdit = (key: string): void => {
    this.editingKey.value = key;
    this.syncEditingFlag(key, true);
  };

  /**
   * 取消指定 section 的编辑，恢复原始配置
   * @param {string} key - section key
   */
  cancelEdit = (key: string): void => {
    this.fillForms(this.originalConfig.value);
    this.editingKey.value = null;
    this.syncEditingFlag(key, false);
  };

  /**
   * 加载配置数据（同时从 JSON 加载 fields 模板）
   */
  loadConfig = async (): Promise<void> => {
    this.pageLoading.value = true;
    this.editingKey.value = null;
    try {
      const [{ data: { config } }] = await Promise.all([
        this.configService.fetchConfig(),
        this.statusStore.fetchStatus(false, false),
        this.webhooksStore.fetchWebhooks(),
        this.templatesStore.fetchConfig(),
        this.playgroundStore.fetchTemplates(),
      ]);

      // 从全局 playground store 缓存中提取全部 config-* 模板 fields
      // 不维护白名单：每加一个 section 都要同步登记容易漏（config-amap 就漏过，导致该组字段全空）
      // pinia 会自动解包 ref，这里直接用数组（不再 .value）
      this.playgroundStore.templates
        .filter((t: TemplateItem) => t.id.startsWith('config-'))
        .forEach((t) => {
          const fields = t.fields ?? [];
          if (fields.length > 0) this.rawTemplates.value[t.id] = fields;
        });

      this.originalConfig.value = { ...config };
      this.fillForms(config, this.statusStore.projectDir);
    } catch {
      // 请求失败时保持表单为空，不阻塞页面
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 保存指定 section 的配置（仅提交有变更的配置项）
   * @param {string} key - section key
   */
  handleSave = async (key: string): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const current = this.collectForms();
      const updates: Record<string, string> = {};

      Object.entries(current).forEach(([k, value]) => {
        if (READONLY_KEYS.includes(k)) return;
        if (value !== this.originalConfig.value[k]) {
          updates[k] = value;
        }
      });

      if (Object.keys(updates).length === 0) {
        this.editingKey.value = null;
        this.syncEditingFlag(key, false);
        return;
      }

      await this.configService.saveConfig(updates);
      this.originalConfig.value = { ...this.originalConfig.value, ...updates };
      this.editingKey.value = null;
      this.syncEditingFlag(key, false);
      MessagePlugin.success(this.localeStore.t.common.saveSuccess);
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.localeStore.t.common.saveFailed;
      MessagePlugin.error(msg);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 校验指定 section 表单后保存配置
   * @param {string} key - section key
   */
  handleSaveWithValidate = async (key: string): Promise<void> => {
    const formRef = this.formRefs[key];
    const result = await (formRef ? formRef.validate() : Promise.resolve(true));

    if (result === true) {
      await this.handleSave(key);
    }
  };

  /**
   * 设置 webhook 行内表单 ref
   */
  setWebhookFormRef = (el: unknown): void => {
    this.webhookFormRef = el as AutoFormRef;
  };

  /**
   * 展开新增 Webhook 表单
   */
  startAddWebhook = (): void => {
    this.editingWebhookId.value = null;
    this.webhookInlineForm.value = { ...WebhookInlineFormData };
    this.isAddingWebhook.value = true;
  };

  /**
   * 展开行内编辑 Webhook 表单
   */
  startEditWebhook = (webhook: ConfigWebHook): void => {
    this.isAddingWebhook.value = false;
    this.editingWebhookId.value = webhook.id ?? null;
    this.webhookInlineForm.value = { ...WebhookInlineFormData, name: webhook.name, style: webhook.style ?? '' };
  };

  /**
   * 取消行内编辑/新增
   */
  cancelWebhookInline = (): void => {
    this.editingWebhookId.value = null;
    this.isAddingWebhook.value = false;
    this.webhookInlineForm.value = { ...WebhookInlineFormData };
  };

  /**
   * 提交行内 Webhook 表单（新建或编辑）
   */
  submitWebhookInline = async (): Promise<void> => {
    const valid = await this.webhookFormRef?.validate();
    if (valid !== true) return;

    const { name, url, style } = this.webhookInlineForm.value as ConfigWebHook;
    this.webhookInlineSaving.value = true;
    try {
      if (this.editingWebhookId.value) {
        const payload: Partial<WebhookPayload> = { name, style };
        if (url.trim()) {
          payload.url = url;
        }
        await this.webhooksStore.editWebhook(this.editingWebhookId.value, payload);
      } else {
        await this.webhooksStore.addWebhook({ name, url, style });
      }
      this.cancelWebhookInline();
    } finally {
      this.webhookInlineSaving.value = false;
    }
  };

  /**
   * 获取瀑布流列容器的稳定 ref 回调
   * @param {number} index - 列索引
   * @returns {(el: unknown) => void} ref 回调
   * @description 同一列始终返回同一函数，避免 Vue 每次渲染重复销毁/创建 Sortable
   */
  getColumnRef = (index: number): ((el: unknown) => void) => {
    if (!this.columnRefCallbacks[index]) {
      this.columnRefCallbacks[index] = (el: unknown) => this.setColumnRef(index, el);
    }
    return this.columnRefCallbacks[index];
  };

  /**
   * 注册列容器并初始化该列的 Sortable
   * @param {number} index - 列索引
   * @param {unknown} el - 列容器 DOM（卸载时为 null）
   * @returns {void}
   * @description group 相同使卡片可跨列拖拽；移动端只有一列时等价于单列排序
   */
  private setColumnRef = (index: number, el: unknown): void => {
    const node = (el as HTMLElement | null) ?? null;
    if (this.columnEls[index] === node && (this.sortableInstances[index] || !node)) return;
    this.sortableInstances[index]?.destroy();
    this.sortableInstances[index] = null;
    this.columnEls[index] = node;
    if (!node) return;

    this.sortableInstances[index] = Sortable.create(node, {
      group: 'config-sections',
      animation: 150,
      handle: '.config-card__drag-handle',
      ghostClass: 'config-card--drag-ghost',
      onEnd: (evt) => {
        const { oldIndex, newIndex, item, from, to } = evt;
        if (oldIndex === undefined || newIndex === undefined) return;
        if (from === to && oldIndex === newIndex) return;

        const dragged = this.collectSectionColumns();
        // Sortable 已改动真实 DOM，先还原，再由 sectionColumns 数据驱动重排
        to.removeChild(item);
        from.insertBefore(item, from.children[oldIndex] ?? null);

        // 移动端只有一列，拖拽后按奇偶还原桌面默认双列
        const columns = this.isMobile.value || dragged.length !== 2
          ? this.splitByParity(this.interleaveColumns(dragged))
          : dragged;
        const included = new Set(columns.flat());
        this.sections.value
          .filter((section) => !included.has(section.key))
          .forEach((section, i) => columns[i % 2].push(section.key));
        this.sectionColumnKeys.value = columns;
        writeSectionColumns(columns);
      },
    });
  };

  /**
   * 从各列 DOM 收集卡片 key
   * @returns {string[][]} 每列的 section key 列表
   * @description 只统计仍在文档中的列容器，排除视口切换后残留的旧节点
   */
  private collectSectionColumns = (): string[][] =>
    this.columnEls
      .filter((el): el is HTMLElement => !!el && el.isConnected)
      .map((el) =>
        Array.from(el.children)
          .map((child) => child.getAttribute('data-section-key') ?? '')
          .filter(Boolean),
      );

  /**
   * 双列交错成线性顺序
   * @param {string[][]} columns - 两列 key 列表
   * @returns {string[]} 线性顺序（用于 sections 排序与移动端单列展示）
   */
  private interleaveColumns = (columns: string[][]): string[] => {
    const order: string[] = [];
    const maxLen = Math.max(0, ...columns.map((column) => column.length));
    for (let i = 0; i < maxLen; i += 1) {
      columns.forEach((column) => {
        if (column[i]) order.push(column[i]);
      });
    }
    return order;
  };

  /**
   * 按索引奇偶把线性 key 拆成默认双列
   * @param {string[]} keys - 线性 key 列表
   * @returns {string[][]} 两列 key 列表
   */
  private splitByParity = (keys: string[]): string[][] => {
    const columns: string[][] = [[], []];
    keys.forEach((key, index) => columns[index % 2].push(key));
    return columns;
  };

  /**
   * 销毁所有 Sortable 实例
   * @description 组件卸载时调用，避免残留事件监听
   */
  private destroySortable = (): void => {
    this.sortableInstances.forEach((instance) => instance?.destroy());
    this.sortableInstances = [];
    this.columnEls = [];
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载配置并启动窗口 resize 监听
   */
  mounted = (): void => {
    this.loadConfig();
    this.startResizeListener();
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 移除窗口 resize 监听，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.stopResizeListener();
    this.destroySortable();
  };
}

/**
 * Composition API 包装函数
 */
export const useConfigModel = () => {
  const model = new ConfigModel();

  onMounted(() => { model.mounted(); });
  onBeforeUnmount(() => { model.beforeUnmount(); });

  return {

    ...model,
    // 权限
    Permission,
  };
};
