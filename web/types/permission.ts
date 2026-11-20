// ==============================
// RBAC 权限码定义
// ==============================

/**
 * 系统权限码枚举
 * @description 细粒度权限标识，每个权限码对应一个具体操作
 */
export enum Permission {
  // ── 仪表盘 ──
  /** 查看仪表盘 */
  DASHBOARD_VIEW = 'dashboard:view',

  // ── 服务控制 ──
  /** 查看守护进程状态 */
  DAEMON_VIEW = 'daemon:view',
  /** 启停守护进程 */
  DAEMON_EDIT = 'daemon:edit',
  /** 查看 Web 服务状态 */
  WEB_SERVICE_VIEW = 'web-service:view',
  /** 启停 Web 服务 */
  WEB_SERVICE_EDIT = 'web-service:edit',

  // ── 系统配置 ──
  /** 查看系统配置 */
  CONFIG_VIEW = 'config:view',
  /** 编辑系统配置 */
  CONFIG_EDIT = 'config:edit',

  // ── AI 模型配置（仅超级管理员） ──
  /** 查看 AI 模型配置 */
  AI_MODELS_VIEW = 'ai-models:view',
  /** 管理 AI 模型配置（增删改、拉取模型、连通性测试） */
  AI_MODELS_EDIT = 'ai-models:edit',

  // ── Webhook 管理 ──
  /** 查看 Webhook */
  WEBHOOK_VIEW = 'webhook:view',
  /** 管理 Webhook（增删改） */
  WEBHOOK_EDIT = 'webhook:edit',

  // ── 自定义规则 ──
  /** 查看规则列表 */
  RULES_VIEW = 'rules:view',
  /** 管理规则（增删改、启用/禁用、测试） */
  RULES_EDIT = 'rules:edit',

  // ── 手动触发（页面入口）──
  /** 进入手动触发页面 */
  TRIGGER_VIEW = 'trigger:view',

  // ── 手动触发 · 日常提醒 ──
  /** 查看工作日管理 */
  TRIGGER_WORKDAY_VIEW = 'trigger:workday:view',
  /** 执行工作日管理 */
  TRIGGER_WORKDAY_EDIT = 'trigger:workday:edit',
  /** 查看生日提醒 */
  TRIGGER_BIRTHDAY_VIEW = 'trigger:birthday:view',
  /** 执行生日提醒 */
  TRIGGER_BIRTHDAY_EDIT = 'trigger:birthday:edit',
  /** 查看每周总结 */
  TRIGGER_WEEKLY_VIEW = 'trigger:weekly:view',
  /** 执行每周总结 */
  TRIGGER_WEEKLY_EDIT = 'trigger:weekly:edit',
  /** 查看每月提醒 */
  TRIGGER_MONTHLY_VIEW = 'trigger:monthly:view',
  /** 执行每月提醒 */
  TRIGGER_MONTHLY_EDIT = 'trigger:monthly:edit',
  /** 查看数据预取 */
  TRIGGER_PREFETCH_VIEW = 'trigger:prefetch:view',
  /** 执行数据预取 */
  TRIGGER_PREFETCH_EDIT = 'trigger:prefetch:edit',

  // ── 手动触发 · 节日与节气 ──
  /** 查看节日与节气提醒 */
  TRIGGER_FESTIVAL_VIEW = 'trigger:festival:view',
  /** 执行节日与节气提醒 */
  TRIGGER_FESTIVAL_EDIT = 'trigger:festival:edit',
  /** 查看假期倒计时 */
  TRIGGER_HOLIDAY_COUNTDOWN_VIEW = 'trigger:holiday-countdown:view',
  /** 执行假期倒计时 */
  TRIGGER_HOLIDAY_COUNTDOWN_EDIT = 'trigger:holiday-countdown:edit',

  // ── 手动触发 · 系统与工具 ──
  /** 查看清除所有日志 */
  TRIGGER_CLEAR_LOGS_VIEW = 'trigger:clear-logs:view',
  /** 执行清除所有日志 */
  TRIGGER_CLEAR_LOGS_EDIT = 'trigger:clear-logs:edit',
  /** 查看自定义规则 */
  TRIGGER_CUSTOM_RULES_VIEW = 'trigger:custom-rules:view',
  /** 执行自定义规则 */
  TRIGGER_CUSTOM_RULES_EDIT = 'trigger:custom-rules:edit',
  /** 查看年度数据更新 */
  TRIGGER_ANNUAL_UPDATE_VIEW = 'trigger:annual-update:view',
  /** 执行年度数据更新 */
  TRIGGER_ANNUAL_UPDATE_EDIT = 'trigger:annual-update:edit',

  // ── 运行日志 ──
  /** 查看运行日志 */
  LOGS_VIEW = 'logs:view',
  /** 清空日志 */
  LOGS_EDIT = 'logs:edit',

  // ── 缓存文件 ──
  /** 查看缓存文件 */
  CACHE_VIEW = 'cache:view',
  /** 编辑缓存文件 */
  CACHE_EDIT = 'cache:edit',

  // ── 表单调试 ──
  /** 查看 Playground */
  PLAYGROUND_VIEW = 'playground:view',
  /** 管理 Playground 模板（增删改） */
  PLAYGROUND_EDIT = 'playground:edit',

  // ── 消息模板 ──
  /** 查看消息模板 */
  TEMPLATES_VIEW = 'templates:view',
  /** 编辑消息模板 */
  TEMPLATES_EDIT = 'templates:edit',

  // ── 文件上传 ──
  /** 上传文件 */
  UPLOAD_EDIT = 'upload:edit',

  // ── RBAC 权限管理 ──
  /** 查看角色列表 */
  RBAC_ROLES_VIEW = 'rbac:roles:view',
  /** 管理角色（增删改） */
  RBAC_ROLES_EDIT = 'rbac:roles:edit',
  /** 查看用户列表 */
  RBAC_USERS_VIEW = 'rbac:users:view',
  /** 管理用户角色分配 */
  RBAC_USERS_EDIT = 'rbac:users:edit',
  /** 查看权限列表 */
  RBAC_PERMISSIONS_VIEW = 'rbac:permissions:view',
  /** 管理权限（增删改） */
  RBAC_PERMISSIONS_EDIT = 'rbac:permissions:edit',
  /** 查看权限申请列表 */
  RBAC_REQUESTS_VIEW = 'rbac:requests:view',
  /** 处理权限申请（批准/拒绝） */
  RBAC_REQUESTS_EDIT = 'rbac:requests:edit',

  // ── API 管理 ──
  /** 查看 API 列表 */
  API_MANAGEMENT_VIEW = 'api-management:view',
  /** 管理 API（增删改、启用/禁用） */
  API_MANAGEMENT_EDIT = 'api-management:edit',
  /** 查看接口分类列表 */
  API_CATEGORY_VIEW = 'api-category:view',
  /** 管理接口分类（增删改） */
  API_CATEGORY_EDIT = 'api-category:edit',

  // ── 节日祝福语 ──
  /** 查看节日祝福语列表 */
  GREETINGS_VIEW = 'greetings:view',
  /** 管理节日祝福语（增删改） */
  GREETINGS_EDIT = 'greetings:edit',

  // ── 提醒寄语 ──
  /** 查看提醒寄语列表 */
  REMINDER_QUOTES_VIEW = 'reminder-quotes:view',
  /** 管理提醒寄语（增删改） */
  REMINDER_QUOTES_EDIT = 'reminder-quotes:edit',

  // ── 技能地图 ──
  /** 查看技能地图（skill-map 页面 + 脚本列表） */
  SKILL_MAP_VIEW = 'skill-map:view',
  /** 执行技能地图脚本（生成卡片图片） */
  SKILL_MAP_EDIT = 'skill-map:edit',

  // ── AI 智能助手 ──
  /** 进入 AI 智能助手页面 */
  AI_CHAT_VIEW = 'ai-chat:view',

  // ── AI 审批 ──
  /** 查看 AI 审批单（approvals 页面 + 审批单列表） */
  AI_APPROVALS_VIEW = 'ai-approvals:view',
  /** 操作 AI 审批单（建单 / 通过 / 驳回；通过与驳回还需超级管理员身份） */
  AI_APPROVALS_EDIT = 'ai-approvals:edit',

  // ── 联网搜索 ──
  /** 使用 AI 联网搜索（智谱 search-std / search-pro） */
  AI_WEB_SEARCH_VIEW = 'ai-web-search:view',

  // ── 项目结构 ──
  /** 查看项目目录结构（query_project_map）与源码文件内容（read_project_file，只读） */
  PROJECT_VIEW = 'project:view',
}

/**
 * 路由权限配置项
 * @description 为整个路由模块声明读/写权限，无需在每个 handler 上重复写 requirePermission
 *
 * - read:       GET/HEAD/OPTIONS 请求所需的权限码（不设置则不校验）
 * - write:      POST/PUT/DELETE/PATCH 请求所需的权限码（不设置则不校验）
 * - readPaths:  虽是写方法但视为只读的路径（如 '/preview'），使用 read 权限
 */
export interface RoutePermissionConfig {
  /** GET/HEAD/OPTIONS 需要的权限（可选，不设则不校验读权限） */
  read?: Permission;
  /** POST/PUT/DELETE/PATCH 需要的权限（可选，不设则不校验写权限） */
  write?: Permission;
  /** 虽然使用 POST 等写方法，但应视为只读操作的路径列表（如 '/preview'） */
  readPaths?: string[];
}
