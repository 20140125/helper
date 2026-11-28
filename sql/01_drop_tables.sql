-- ============================================================
-- 01. 删除所有表（按依赖倒序，允许重复执行脚本）
-- ============================================================

-- 子表 / 中间表（在父表之前删除，避免外键约束报错）
DROP TABLE IF EXISTS `hp_user_roles`;
DROP TABLE IF EXISTS `hp_role_permissions`;
DROP TABLE IF EXISTS `hp_rule_webhooks`;
DROP TABLE IF EXISTS `hp_api_items`;

-- 主表
DROP TABLE IF EXISTS `hp_custom_rules`;
DROP TABLE IF EXISTS `hp_webhooks`;
DROP TABLE IF EXISTS `hp_roles`;
DROP TABLE IF EXISTS `hp_permissions`;
DROP TABLE IF EXISTS `hp_users`;
DROP TABLE IF EXISTS `hp_env_config`;
DROP TABLE IF EXISTS `hp_holiday_data`;
DROP TABLE IF EXISTS `hp_month_config`;
DROP TABLE IF EXISTS `hp_daemon_sent_state`;
DROP TABLE IF EXISTS `hp_daily_data`;
DROP TABLE IF EXISTS `hp_cache_files`;
DROP TABLE IF EXISTS `hp_shell_cache_files`;
DROP TABLE IF EXISTS `hp_message_templates`;
DROP TABLE IF EXISTS `hp_template_styles`;
DROP TABLE IF EXISTS `hp_template_names`;
DROP TABLE IF EXISTS `hp_greetings`;
DROP TABLE IF EXISTS `hp_reminder_quotes`;
DROP TABLE IF EXISTS `hp_verification_codes`;
DROP TABLE IF EXISTS `hp_permission_requests`;
DROP TABLE IF EXISTS `hp_api_categories`;
DROP TABLE IF EXISTS `hp_skills`;
DROP TABLE IF EXISTS `hp_skill_categories`;
