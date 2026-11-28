-- ============================================================
-- 41. 侧边栏导航与页面注册表 (hp_nav_groups / hp_nav_items)
-- ============================================================
-- 数据库为唯一真源：前端侧边栏菜单、分组顺序与贾维斯 query_pages 都读这两张表。
-- 种子用 INSERT IGNORE，只补缺失项，不覆盖管理页编辑过的显隐 / 图标 / 排序。
-- 存量库由 web/utils/navigation.ts 的 ensureNavigationSchema() 幂等建表；初始种子需执行本脚本（或 helper_database.sql 全库重建）。
-- ============================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `hp_nav_groups` (
  `group_key`   VARCHAR(32)  NOT NULL COMMENT '分组标识（稳定 ID）',
  `label_key`   VARCHAR(64)  NOT NULL COMMENT '分组标题 i18n key',
  `icon`        VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '分组图标',
  `sort_order`  INT          NOT NULL DEFAULT 0 COMMENT '展示顺序',
  `enabled`     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用',
  PRIMARY KEY (`group_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='侧边栏菜单分组';

CREATE TABLE IF NOT EXISTS `hp_nav_items` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `route_name`        VARCHAR(64)  NOT NULL COMMENT 'vue-router 路由名',
  `path`              VARCHAR(128) NOT NULL COMMENT '浏览器直连路径',
  `label_key`         VARCHAR(64)  NOT NULL COMMENT '菜单标题 i18n key',
  `label_zh`          VARCHAR(128) NOT NULL DEFAULT '' COMMENT '中文名（贾维斯入口导航）',
  `icon`              VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '菜单图标',
  `group_key`         VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '所属分组标识',
  `in_menu`           TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否在侧边栏显示',
  `sort_order`        INT          NOT NULL DEFAULT 0 COMMENT '展示顺序',
  `permission_code`   VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '访问所需权限码',
  `super_admin_only`  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否仅超级管理员可见',
  `description`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '页面用途说明',
  `covered_by_tools`  JSON         NULL COMMENT '已覆盖该页能力的贾维斯工具',
  `enabled`           TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_route_name` (`route_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='侧边栏菜单与页面入口注册表';

INSERT IGNORE INTO `hp_nav_groups` (group_key, label_key, icon, sort_order, enabled) VALUES
  ('overview', 'home.groupOverview', 'dashboard', 10, 1),
  ('features', 'home.groupFeatures', 'application', 20, 1),
  ('operations', 'home.groupOps', 'server', 30, 1),
  ('devtools', 'home.groupDev', 'code', 40, 1),
  ('rbac', 'home.groupRbac', 'lock-on', 50, 1);

INSERT IGNORE INTO `hp_nav_items` (route_name, path, label_key, label_zh, icon, group_key, in_menu, sort_order, permission_code, super_admin_only, description, covered_by_tools, enabled) VALUES
  ('dashboard', '/dashboard', 'menu.dashboard', '仪表盘', 'dashboard', 'overview', 1, 10, 'dashboard:view', 0, '守护进程 / Web 服务状态、服务器时间、规则与缓存概览，可启停守护进程', '[\"query_system_status\",\"query_service_status\",\"manage_service\"]', 1),
  ('rules', '/rules', 'menu.rules', '自定义规则', 'filter', 'features', 0, 20, 'rules:view', 0, '自定义提醒规则的增删改与测试触发', '[\"query_rules\",\"create_rule\",\"manage_rule\"]', 1),
  ('logs', '/logs', 'menu.logs', '运行日志', 'file-paste', 'operations', 0, 30, 'logs:view', 0, '运行日志记录表格：分页、筛选，点击单条查看日志详情', '[\"query_logs\",\"manage_logs\"]', 1),
  ('config', '/config', 'menu.config', '系统配置', 'setting', 'features', 0, 40, 'config:view', 0, '编辑 .env 配置项、管理企业微信机器人', '[\"query_config\",\"update_config\",\"query_webhooks\",\"manage_webhook\"]', 1),
  ('message-templates', '/message-templates', 'menu.messageTemplates', '消息模板', 'chat', 'features', 0, 50, 'templates:view', 0, '推送消息模板的增删改与预览', '[\"query_message_templates\"]', 1),
  ('api-management', '/interface-management', 'menu.apiManagement', 'API 管理', 'api', 'features', 0, 60, 'api-management:view', 0, '内部接口条目登记与调试执行', '[\"list_apis\"]', 1),
  ('api-categories', '/interface-categories', 'menu.apiCategories', '接口分类', 'folder', 'features', 0, 70, 'api-category:view', 0, '接口分类管理', '[\"query_api_categories\"]', 1),
  ('greetings', '/greetings', 'menu.greetings', '节日祝福语', 'gift', 'features', 0, 80, 'greetings:view', 0, '节日祝福语文案库维护', '[\"query_greetings\"]', 1),
  ('reminder-quotes', '/reminder-quotes', 'menu.reminderQuotes', '提醒寄语', 'chat', 'features', 0, 90, 'reminder-quotes:view', 0, '早安 / 午餐 / 下班等寄语库维护', '[\"query_reminder_quotes\"]', 1),
  ('trigger', '/trigger', 'menu.trigger', '手动触发', 'play-circle', 'features', 0, 100, 'trigger:view', 0, '页面选脚本执行并实时看输出（年度更新工具也在这一页）', '[\"list_scripts\",\"trigger_script\",\"annual_update\"]', 1),
  ('approvals', '/approvals', 'menu.approvals', 'AI 审批', 'check-circle', 'features', 1, 110, 'ai-approvals:view', 0, '贾维斯增删改审批单：通过并执行 / 驳回，仅超级管理员可决策', '[\"request_approval\"]', 1),
  ('ai-cost', '/ai-cost', 'menu.aiCost', 'AI 成本看板', 'chart-bubble', 'operations', 1, 120, 'ai-chat:view', 0, '按天 / 模型 / 工具三个维度聚合 LLM 调用成本与耗时', '[]', 1),
  ('ai-chat-admin', '/ai-chat-admin', 'menu.aiChatAdmin', 'AI 回话分析', 'chart-bubble', 'operations', 1, 130, 'ai-chat:view', 0, '', '[]', 1),
  ('ai-models', '/ai-models', 'menu.aiModels', 'AI 模型配置', 'robot', 'features', 1, 140, 'ai-models:view', 1, '', '[]', 1),
  ('knowledge', '/knowledge', 'menu.knowledgeBase', '知识库管理', 'book', 'features', 1, 150, 'knowledge-base:view', 0, '', '[]', 1),
  ('database', '/database', 'menu.database', '数据库管理', 'server', 'operations', 1, 160, 'database:view', 1, '查看 MySQL 连接状态、库表结构与数据预览，执行 SQL，并用 helper_database.sql 重建全库（仅超级管理员）', '[]', 1),
  ('i18n-messages', '/i18n-messages', 'menu.i18nMessages', '语言包管理', 'file-code', 'operations', 1, 170, '', 0, '浏览 hp_i18n_messages 中的中英文案（所有登录用户可查看），超管可编辑并让前端语言包立即生效', '[]', 1),
  ('cache-admin', '/cache-admin', 'menu.cacheAdmin', '缓存数据管理', 'folder', 'operations', 1, 180, 'cache:view', 0, '按 13 张 hp_cache_* 表浏览缓存条目，按表 / 时间粒度 / 关键字筛选，可查看、编辑与删除单条缓存数据', '[]', 1),
  ('amap-geocode', '/amap-geocode', 'menu.amapGeocode', '高德地理编码', 'location', 'operations', 1, 190, 'cache:view', 0, '独立管理 hp_cache_amap_geocode 表中的地址与经纬度映射，支持新增、编辑与删除', '[]', 1),
  ('auto-form-playground', '/auto-form-playground', 'menu.playground', '表单配置器', 'form', 'devtools', 0, 200, 'playground:view', 0, 'auto-form 表单配置调试（开发用）', '[]', 1),
  ('rbac-roles', '/rbac/roles', 'menu.rbacRoles', '角色管理', 'user-setting', 'rbac', 0, 210, 'rbac:roles:view', 0, '新建角色、勾选权限码', '[\"query_rbac\",\"manage_rbac\"]', 1),
  ('rbac-users', '/rbac/users', 'menu.rbacUsers', '用户管理', 'user', 'rbac', 0, 220, 'rbac:users:view', 0, '给邮箱绑定角色', '[\"query_rbac\",\"manage_rbac\"]', 1),
  ('rbac-permissions', '/rbac/permissions', 'menu.rbacPermissions', '权限列表', 'lock-on', 'rbac', 0, 230, 'rbac:permissions:view', 0, '查看权限码元数据', '[\"query_rbac\"]', 1),
  ('permission-requests', '/rbac/requests', 'menu.permissionRequests', '权限申请', 'user-add', 'rbac', 0, 240, 'rbac:requests:view', 0, '审批用户提交的权限申请单', '[\"query_permission_requests\"]', 1),
  ('navigation-admin', '/navigation-admin', 'menu.navigationAdmin', '导航数据管理', 'menu', 'operations', 1, 250, 'config:view', 0, '维护侧边栏分组、页面入口与贾维斯页面注册表', '[]', 1);
