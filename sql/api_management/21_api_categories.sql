
-- ============================================================
-- 20.1 接口分类表 (api_categories.json)
-- ============================================================

CREATE TABLE `hp_api_categories` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '分类 ID（自增）',
  `category_key` VARCHAR(64) NOT NULL COMMENT '分类业务标识（如 cat_system / cat_rbac）',
  `name` VARCHAR(64) NOT NULL COMMENT '分类名称',
  `description` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '分类描述',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_key` (`category_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='接口管理 - 分类表';

-- 数据以 .cache/api_categories.json 为准（自动同步）
INSERT INTO `hp_api_categories` (`category_key`, `name`, `description`, `created_at`, `updated_at`) VALUES
  ('cat_system', '系统', '系统状态、守护进程、启动器等系统级接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_auth', '认证', '登录、验证码、Token 验证等认证相关接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_config', '配置', '环境变量配置读写接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_trigger', '触发器', '脚本触发、手动执行提醒等触发器接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_rules', '自定义规则', '自定义提醒规则的增删改查接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_webhooks', 'Webhook', '企业微信机器人 Webhook 的增删改查接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_templates', '消息模板', '消息模板读写、类型查询、占位符查询等接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_playground', '表单调试', 'Playground 模板的增删改查接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_cache', '缓存', '缓存文件读写接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_logs', '日志', 'Access Log 读取接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_upload', '上传', '文件上传接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_web_service', 'Web 服务', 'Web 服务与 Launcher 的启停状态管理接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_update_tools', '更新工具', '工具脚本更新相关接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_rbac', '权限管理', 'RBAC 角色、用户、权限元信息及权限申请相关接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_api_management', '接口管理', '接口分类与 API 条目的增删改查及代理执行接口', '2026-04-17 02:47:00', '2026-04-17 02:47:00') ,
  ('cat_greetings', '节日祝福语', '节日祝福语条目的增删改查接口', '2026-04-21 16:32:00', '2026-04-21 16:32:00') ,
  ('cat_reminder_quotes', '提醒寄语', '提醒寄语条目的增删改查接口', '2026-04-21 16:32:00', '2026-04-21 16:32:00') ,
  ('cat_skill_map', '技能地图', 'scripts/tools 下技能脚本的列表与执行接口', '2026-04-27 10:33:26', '2026-04-27 10:33:26') ,
  ('cat_ai_chat', 'AI聊天', 'AI工具贾维斯的相关接口', '2026-5-29 10:01:41', '2026-5-29 10:01:41') ,
  ('cat_knowledge_base', '知识库管理', '知识库文档维护与检索相关接口', '2026-11-21 00:41:59', '2026-11-21 00:41:59') ,
  ('cat_database', '数据库管理', '数据库连接状态、库表结构、SQL 执行与建表脚本初始化接口', '2026-11-28 00:37:16', '2026-11-28 00:37:16');
