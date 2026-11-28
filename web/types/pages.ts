/**
 * Web 页面路由注册表（贾维斯「入口导航」的唯一数据源）
 * @description Web 正在收敛为 agent 应用：大量页面从侧边栏菜单收起（inMenu=false），
 *   代码与路由都还在，只是没了入口。用户问「XX 功能在哪」时，贾维斯靠这张表给出直连路径，
 *   而不是让用户去菜单里找——找不到入口是收起导致的，不是功能没了。
 *
 * 维护约定（很重要）：
 *   1) 新增 / 删除 / 改名页面时，同步改本表与 `web/frontend/src/router/index.ts`
 *   2) `inMenu` 需与前端路由 meta 保持一致，否则贾维斯会误导用户「菜单里有」
 *   3) `coveredByTools` 指明该页的事是否已经能直接让贾维斯做（有对应工具），
 *      有值时应优先推荐「我来做」而不是「你去页面上点」
 */

/** 单个页面的注册信息 */
export interface PageEntry {
  /** 路由路径（前端地址栏直连用，如 /rbac/users） */
  path: string;
  /** 路由名（vue-router name） */
  name: string;
  /** 中文名 */
  label: string;
  /** 菜单分组：overview / features / operations / rbac / devtools */
  group: string;
  /** 是否在侧边栏菜单可见（false 表示入口已收起，需直连 URL） */
  inMenu: boolean;
  /** 访问所需的权限码（满足任一即可） */
  permissions: string[];
  /** 一句话说明这个页面干什么 */
  desc: string;
  /**
   * 已被哪些贾维斯工具覆盖（可空）
   * @description 有值时贾维斯应优先说「我可以直接帮你做」，再补一句页面入口作为兜底
   */
  coveredByTools: string[];
}

/** Web 全部页面（顺序与前端路由表一致） */
export const PAGE_REGISTRY: PageEntry[] = [
  {
    path: '/dashboard',
    name: 'dashboard',
    label: '仪表盘',
    group: 'overview',
    inMenu: true,
    permissions: ['dashboard:view'],
    desc: '守护进程 / Web 服务状态、服务器时间、规则与缓存概览，可启停守护进程',
    coveredByTools: ['query_system_status', 'query_service_status', 'manage_service'],
  },
  {
    path: '/approvals',
    name: 'approvals',
    label: 'AI 审批',
    group: 'features',
    inMenu: true,
    permissions: ['ai-approvals:view'],
    desc: '贾维斯增删改审批单：通过并执行 / 驳回，仅超级管理员可决策',
    coveredByTools: ['request_approval'],
  },
  {
    path: '/ai-cost',
    name: 'ai-cost',
    label: 'AI 成本看板',
    group: 'operations',
    inMenu: true,
    permissions: ['ai-chat:view'],
    desc: '按天 / 模型 / 工具三个维度聚合 LLM 调用成本与耗时',
    coveredByTools: [],
  },
  {
    path: '/rules',
    name: 'rules',
    label: '自定义规则',
    group: 'features',
    inMenu: false,
    permissions: ['rules:view'],
    desc: '自定义提醒规则的增删改与测试触发',
    coveredByTools: ['query_rules', 'create_rule', 'manage_rule'],
  },
  {
    path: '/logs',
    name: 'logs',
    label: '运行日志',
    group: 'operations',
    inMenu: false,
    permissions: ['logs:view'],
    desc: '运行日志记录表格：分页、筛选，点击单条查看日志详情',
    coveredByTools: ['query_logs', 'manage_logs'],
  },
  {
    path: '/config',
    name: 'config',
    label: '系统配置',
    group: 'features',
    inMenu: false,
    permissions: ['config:view'],
    desc: '编辑 .env 配置项、管理企业微信机器人',
    coveredByTools: ['query_config', 'update_config', 'query_webhooks', 'manage_webhook'],
  },
  {
    path: '/greetings',
    name: 'greetings',
    label: '节日祝福语',
    group: 'features',
    inMenu: false,
    permissions: ['greetings:view'],
    desc: '节日祝福语文案库维护',
    coveredByTools: ['query_greetings'],
  },
  {
    path: '/reminder-quotes',
    name: 'reminder-quotes',
    label: '提醒寄语',
    group: 'features',
    inMenu: false,
    permissions: ['reminder-quotes:view'],
    desc: '早安 / 午餐 / 下班等寄语库维护',
    coveredByTools: ['query_reminder_quotes'],
  },
  {
    path: '/message-templates',
    name: 'message-templates',
    label: '消息模板',
    group: 'features',
    inMenu: false,
    permissions: ['templates:view'],
    desc: '推送消息模板的增删改与预览',
    coveredByTools: ['query_message_templates'],
  },
  {
    path: '/interface-management',
    name: 'api-management',
    label: 'API 管理',
    group: 'features',
    inMenu: false,
    permissions: ['api-management:view'],
    desc: '内部接口条目登记与调试执行',
    coveredByTools: ['list_apis'],
  },
  {
    path: '/interface-categories',
    name: 'api-categories',
    label: '接口分类',
    group: 'features',
    inMenu: false,
    permissions: ['api-category:view'],
    desc: '接口分类管理',
    coveredByTools: ['query_api_categories'],
  },
  {
    path: '/rbac/roles',
    name: 'rbac-roles',
    label: '角色管理',
    group: 'rbac',
    inMenu: false,
    permissions: ['rbac:roles:view'],
    desc: '新建角色、勾选权限码',
    coveredByTools: ['query_rbac', 'manage_rbac'],
  },
  {
    path: '/rbac/users',
    name: 'rbac-users',
    label: '用户管理',
    group: 'rbac',
    inMenu: false,
    permissions: ['rbac:users:view'],
    desc: '给邮箱绑定角色',
    coveredByTools: ['query_rbac', 'manage_rbac'],
  },
  {
    path: '/rbac/permissions',
    name: 'rbac-permissions',
    label: '权限列表',
    group: 'rbac',
    inMenu: false,
    permissions: ['rbac:permissions:view'],
    desc: '查看权限码元数据',
    coveredByTools: ['query_rbac'],
  },
  {
    path: '/rbac/requests',
    name: 'permission-requests',
    label: '权限申请',
    group: 'rbac',
    inMenu: false,
    permissions: ['rbac:requests:view'],
    desc: '审批用户提交的权限申请单',
    coveredByTools: ['query_permission_requests'],
  },
  {
    path: '/trigger',
    name: 'trigger',
    label: '手动触发',
    group: 'features',
    inMenu: false,
    permissions: ['trigger:view'],
    desc: '页面选脚本执行并实时看输出（年度更新工具也在这一页）',
    coveredByTools: ['list_scripts', 'trigger_script', 'annual_update'],
  },
  {
    path: '/skill-map',
    name: 'skill-map',
    label: '技能地图',
    group: 'features',
    inMenu: false,
    permissions: ['skill-map:view'],
    desc: '卡片技能列表与执行（前端入口已收起，跑卡片请用 card_skill）',
    coveredByTools: ['card_skill'],
  },
  {
    path: '/database',
    name: 'database',
    label: '数据库管理',
    group: 'operations',
    inMenu: true,
    permissions: ['database:view'],
    desc: '查看 MySQL 连接状态、库表结构与数据预览，执行 SQL，并用 helper_database.sql 重建全库（仅超级管理员）',
    coveredByTools: [],
  },
  {
    path: '/i18n-messages',
    name: 'i18n-messages',
    label: '语言包管理',
    group: 'operations',
    inMenu: true,
    permissions: [],
    desc: '浏览 hp_i18n_messages 中的中英文案（所有登录用户可查看），超管可编辑并让前端语言包立即生效',
    coveredByTools: [],
  },
  {
    path: '/auto-form-playground',
    name: 'auto-form-playground',
    label: '表单配置器',
    group: 'devtools',
    inMenu: false,
    permissions: ['playground:view'],
    desc: 'auto-form 表单配置调试（开发用）',
    coveredByTools: [],
  },
];

/**
 * 按关键字或路径过滤页面
 * @param {string} keyword - 关键字（匹配路径 / 路由名 / 中文名 / 说明）
 * @returns {PageEntry[]} 命中的页面
 */
export const searchPages = (keyword: string): PageEntry[] => {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return PAGE_REGISTRY;
  return PAGE_REGISTRY.filter((p) =>
    `${p.path} ${p.name} ${p.label} ${p.desc}`.toLowerCase().includes(kw),
  );
};
