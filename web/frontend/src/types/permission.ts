/**
 * 系统权限码枚举（与后端 Permission 保持一致）
 * @description 细粒度权限标识，每个权限码对应一个具体操作
 */
export enum Permission {
  // ── 仪表盘 ──
  DASHBOARD_VIEW = 'dashboard:view',

  // ── 服务控制 ──
  DAEMON_VIEW = 'daemon:view',
  DAEMON_EDIT = 'daemon:edit',
  WEB_SERVICE_VIEW = 'web-service:view',
  WEB_SERVICE_EDIT = 'web-service:edit',

  // ── 系统配置 ──
  CONFIG_VIEW = 'config:view',
  CONFIG_EDIT = 'config:edit',

  // ── AI 模型配置（仅超级管理员） ──
  AI_MODELS_VIEW = 'ai-models:view',
  AI_MODELS_EDIT = 'ai-models:edit',

  // ── Webhook 管理 ──
  WEBHOOK_VIEW = 'webhook:view',
  WEBHOOK_EDIT = 'webhook:edit',

  // ── 自定义规则 ──
  RULES_VIEW = 'rules:view',
  RULES_EDIT = 'rules:edit',

  // ── 手动触发（页面入口）──
  TRIGGER_VIEW = 'trigger:view',

  // ── 手动触发 · 日常提醒 ──
  TRIGGER_WORKDAY_VIEW = 'trigger:workday:view',
  TRIGGER_WORKDAY_EDIT = 'trigger:workday:edit',
  TRIGGER_BIRTHDAY_VIEW = 'trigger:birthday:view',
  TRIGGER_BIRTHDAY_EDIT = 'trigger:birthday:edit',
  TRIGGER_WEEKLY_VIEW = 'trigger:weekly:view',
  TRIGGER_WEEKLY_EDIT = 'trigger:weekly:edit',
  TRIGGER_MONTHLY_VIEW = 'trigger:monthly:view',
  TRIGGER_MONTHLY_EDIT = 'trigger:monthly:edit',
  TRIGGER_PREFETCH_VIEW = 'trigger:prefetch:view',
  TRIGGER_PREFETCH_EDIT = 'trigger:prefetch:edit',

  // ── 手动触发 · 节日与节气 ──
  TRIGGER_FESTIVAL_VIEW = 'trigger:festival:view',
  TRIGGER_FESTIVAL_EDIT = 'trigger:festival:edit',
  TRIGGER_HOLIDAY_COUNTDOWN_VIEW = 'trigger:holiday-countdown:view',
  TRIGGER_HOLIDAY_COUNTDOWN_EDIT = 'trigger:holiday-countdown:edit',

  // ── 手动触发 · 系统与工具 ──
  TRIGGER_CLEAR_LOGS_VIEW = 'trigger:clear-logs:view',
  TRIGGER_CLEAR_LOGS_EDIT = 'trigger:clear-logs:edit',
  TRIGGER_CUSTOM_RULES_VIEW = 'trigger:custom-rules:view',
  TRIGGER_CUSTOM_RULES_EDIT = 'trigger:custom-rules:edit',
  TRIGGER_ANNUAL_UPDATE_VIEW = 'trigger:annual-update:view',
  TRIGGER_ANNUAL_UPDATE_EDIT = 'trigger:annual-update:edit',

  // ── 运行日志 ──
  LOGS_VIEW = 'logs:view',
  LOGS_EDIT = 'logs:edit',

  // ── 缓存文件 ──
  CACHE_VIEW = 'cache:view',
  CACHE_EDIT = 'cache:edit',

  // ── 表单调试 ──
  PLAYGROUND_VIEW = 'playground:view',
  PLAYGROUND_EDIT = 'playground:edit',

  // ── 消息模板 ──
  TEMPLATES_VIEW = 'templates:view',
  TEMPLATES_EDIT = 'templates:edit',

  // ── 文件上传 ──
  UPLOAD_EDIT = 'upload:edit',

  // ── RBAC 权限管理 ──
  RBAC_ROLES_VIEW = 'rbac:roles:view',
  RBAC_ROLES_EDIT = 'rbac:roles:edit',
  RBAC_USERS_VIEW = 'rbac:users:view',
  RBAC_USERS_EDIT = 'rbac:users:edit',
  RBAC_PERMISSIONS_VIEW = 'rbac:permissions:view',
  RBAC_PERMISSIONS_EDIT = 'rbac:permissions:edit',
  RBAC_REQUESTS_VIEW = 'rbac:requests:view',
  RBAC_REQUESTS_EDIT = 'rbac:requests:edit',

  // ── API 管理 ──
  API_MANAGEMENT_VIEW = 'api-management:view',
  API_MANAGEMENT_EDIT = 'api-management:edit',

  // ── 接口分类管理 ──
  API_CATEGORY_VIEW = 'api-category:view',
  API_CATEGORY_EDIT = 'api-category:edit',

  // ── 节日祝福语 ──
  GREETINGS_VIEW = 'greetings:view',
  GREETINGS_EDIT = 'greetings:edit',

  // ── 提醒寄语 ──
  REMINDER_QUOTES_VIEW = 'reminder-quotes:view',
  REMINDER_QUOTES_EDIT = 'reminder-quotes:edit',

  // ── 技能地图 ──
  SKILL_MAP_VIEW = 'skill-map:view',
  SKILL_MAP_EDIT = 'skill-map:edit',

  // ── AI 聊天 ──
  AI_CHAT_VIEW = 'ai-chat:view',

  // ── AI 审批 ──
  AI_APPROVALS_VIEW = 'ai-approvals:view',
  AI_APPROVALS_EDIT = 'ai-approvals:edit',

  // ── 联网搜索 ──
  AI_WEB_SEARCH_VIEW = 'ai-web-search:view',
}
