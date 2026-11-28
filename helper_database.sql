-- ============================================================
-- Helper 智能提醒系统 - 数据库初始化 SQL（主入口 / 聚合器）
-- 生成时间: 2026-04-01（2026-04-30 拆分为模块化 SQL）
-- 基于 .cache/ 目录下的 JSON 数据文件
-- 数据库: MySQL 8.0+ / MariaDB 10.5+
-- 字符集: utf8mb4
-- ------------------------------------------------------------
-- 使用方式（必须用 mysql 客户端交互模式或 -e，不能用 < 重定向）：
--   mysql -u <user> -p <db> -e "SOURCE helper_database.sql;"
-- 或进入 mysql 交互模式后执行：
--   USE helper; SOURCE helper_database.sql;
-- ============================================================

-- 0. 初始化
SOURCE sql/00_init.sql;

-- 1. 删除所有表（允许重复初始化）
SOURCE sql/01_drop_tables.sql;

-- ──────────────── RBAC 用户权限模块 ────────────────
SOURCE sql/rbac/02_users.sql;
SOURCE sql/rbac/03_permissions.sql;
SOURCE sql/rbac/04_roles.sql;
SOURCE sql/rbac/05_role_permissions.sql;
SOURCE sql/rbac/06_user_roles.sql;

-- ──────────────── 提醒核心模块 ────────────────
SOURCE sql/reminder/07_webhooks.sql;
SOURCE sql/reminder/08_custom_rules.sql;
SOURCE sql/reminder/09_rule_webhooks.sql;

-- ──────────────── 日历数据模块 ────────────────
SOURCE sql/calendar/10_holiday_data.sql;
SOURCE sql/calendar/11_month_config.sql;
SOURCE sql/calendar/12_daemon_sent_state.sql;
SOURCE sql/calendar/13_daily_data.sql;

-- ──────────────── 消息模板模块 ────────────────
SOURCE sql/templates/14_message_templates.sql;
SOURCE sql/templates/15_template_styles.sql;
SOURCE sql/templates/16_template_names.sql;

-- ──────────────── 内容库模块 ────────────────
SOURCE sql/content/17_greetings.sql;
SOURCE sql/content/18_reminder_quotes.sql;

-- ──────────────── 认证模块 ────────────────
SOURCE sql/auth/19_verification_codes.sql;

-- ──────────────── 权限申请（属于 RBAC，但依赖已就绪） ────────────────
SOURCE sql/rbac/20_permission_requests.sql;

-- ──────────────── 接口管理模块 ────────────────
SOURCE sql/api_management/21_api_categories.sql;
SOURCE sql/api_management/22_api_items.sql;

-- ──────────────── 技能图谱模块 ────────────────
SOURCE sql/skill_map/23_skill_categories.sql;
SOURCE sql/skill_map/24_skills.sql;

-- ──────────────── 贾维斯（AI）运行时数据 ────────────────
SOURCE sql/ai/25_ai_conversations.sql;
SOURCE sql/ai/26_ai_messages.sql;
SOURCE sql/ai/27_ai_run_traces.sql;
SOURCE sql/ai/28_ai_memory_items.sql;
SOURCE sql/ai/29_ai_approvals.sql;
SOURCE sql/ai/30_ai_model_configs.sql;
SOURCE sql/ai/31_ai_inspection_state.sql;

-- ──────────────── 系统环境配置 ────────────────
SOURCE sql/config/32_env_config.sql;

-- ──────────────── 项目运行日志 ────────────────
SOURCE sql/logs/33_run_logs.sql;

-- ──────────────── Playground 表单模板 ────────────────
SOURCE sql/playground/34_playground_templates.sql;

-- ──────────────── 前端 i18n 语言包 ────────────────
SOURCE sql/i18n/35_i18n_messages.sql;

-- ──────────────── 贾维斯 AI 助手皮肤配置 ────────────────
SOURCE sql/ai/36_ai_chat_skins.sql;
SOURCE sql/ai/37_ai_chat_skin_presets.sql;

-- ──────────────── 项目知识库文档（docs/ + knowledge/） ────────────────
SOURCE sql/knowledge/38_knowledge_docs.sql;

-- ──────────────── 热搜榜单结构化数据（多站点共用明细表） ────────────────
SOURCE sql/hot_search/39_hot_search.sql;

-- ──────────────── 按用户外观偏好（背景图遮挡层不透明度） ────────────────
SOURCE sql/config/40_user_appearance.sql;

-- ──────────────── 侧边栏导航与页面注册表 ────────────────
SOURCE sql/navigation/41_navigation.sql;

-- ──────────────── 系统背景图（图片本体入库） ────────────────
SOURCE sql/config/42_app_background.sql;

-- ──────────────── 补充缓存数据（其它 SQL 文件未覆盖的 .cache/ 数据） ────────────────
SOURCE sql/cache_data.sql;

-- ──────────────── 视图（必须在所有表之后） ────────────────
SOURCE sql/99_views.sql;

-- ============================================================
-- 完成
-- ============================================================
SELECT '✅ Helper 数据库初始化完成！' AS message;
SELECT CONCAT('📊 共创建 ', COUNT(*), ' 张表') AS summary
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE';
