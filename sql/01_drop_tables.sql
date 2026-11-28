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
-- 旧库遗留：hp_shell_cache_files 兼容视图 / 镜像表已移除，先删依赖视图再删基表，初始化只清理、不再重建
DROP VIEW IF EXISTS `hp_shell_cache_files`;
DROP TABLE IF EXISTS `hp_shell_cache_files`;
-- 旧库遗留：hp_cache_files / hp_cache_store 汇总表与 hp_cache_meta 元信息表均已下线，初始化时一并清理
DROP TABLE IF EXISTS `hp_cache_files`;
DROP TABLE IF EXISTS `hp_cache_store`;
DROP TABLE IF EXISTS `hp_cache_meta`;
-- 遗留空桶：hp_cache_res_ai_doc（AI 文档响应分类，0 行且无运行时消费者），表定义已移除；
-- 旧库初始化时一并清理；见 sql/cache_data.sql
DROP TABLE IF EXISTS `hp_cache_res_ai_doc`;
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
-- 热搜榜单结构化数据：先删明细再删批次表
DROP TABLE IF EXISTS `hp_hot_search_item`;
DROP TABLE IF EXISTS `hp_hot_search_snapshot`;

-- 例外：hp_i18n_messages 是文案维护真源（管理页可编辑），初始化只补缺失 key、不删除表，
--       避免全库重建把数据库里维护过的文案冲掉；见 sql/i18n/35_i18n_messages.sql
-- 例外：hp_knowledge_docs 是知识库维护真源（用户文档可在管理页编辑），同样不删除表；
--       初始化 / 同步按文件回灌系统文档、只补齐用户文档缺失项；见 sql/knowledge/38_knowledge_docs.sql
-- 例外：hp_nav_groups / hp_nav_items 是导航维护真源（管理页可编辑），同样不删除表；
--       41 号脚本用 CREATE TABLE IF NOT EXISTS + INSERT IGNORE 只补缺失项；见 sql/navigation/41_navigation.sql
DROP TABLE IF EXISTS `hp_ai_chat_skins`;
DROP TABLE IF EXISTS `hp_ai_chat_skin_presets`;
DROP TABLE IF EXISTS `hp_user_appearance`;
DROP TABLE IF EXISTS `hp_app_background`;
