
-- ============================================================
-- 20.2 API 条目表 (api_items.json)
-- ============================================================

CREATE TABLE `hp_api_items` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'API 条目 ID（自增）',
  `item_key` VARCHAR(96) NOT NULL COMMENT 'API 业务标识（如 api_system_get）',
  `category_id` INT NOT NULL COMMENT '所属分类 ID（关联 hp_api_categories.id）',
  `name` VARCHAR(128) NOT NULL COMMENT 'API 名称',
  `method` VARCHAR(16) NOT NULL COMMENT 'HTTP 方法：GET/POST/PUT/DELETE 等',
  `path` VARCHAR(255) NOT NULL COMMENT '请求路径（支持 :param 占位符）',
  `description` VARCHAR(512) NOT NULL DEFAULT '' COMMENT 'API 描述',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：0-否 1-是',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_item_key` (`item_key`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_method_path` (`method`, `path`),
  CONSTRAINT `fk_api_items_category` FOREIGN KEY (`category_id`) REFERENCES `hp_api_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='接口管理 - API 条目表';

-- 通过子查询关联 category_id，避免硬编码自增主键值
-- 数据以 .cache/api_items.json 为准（自动同步）
INSERT INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT v.item_key, c.id, v.name, v.method, v.path, v.description, v.enabled, v.created_at, v.updated_at
FROM (
  SELECT 'api_system_get' AS item_key, 'cat_system' AS cat_key, '获取系统状态' AS name, 'GET' AS method, '/api/system' AS path, '获取守护进程状态、缓存文件数量、服务器时间及基础硬件信息' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_daemon_start' AS item_key, 'cat_system' AS cat_key, '启动守护进程' AS name, 'POST' AS method, '/api/daemon/start' AS path, '启动 reminder_daemon 守护进程' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_daemon_stop' AS item_key, 'cat_system' AS cat_key, '停止守护进程' AS name, 'POST' AS method, '/api/daemon/stop' AS path, '停止 reminder_daemon 守护进程' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_daemon_restart' AS item_key, 'cat_system' AS cat_key, '重启守护进程' AS name, 'POST' AS method, '/api/daemon/restart' AS path, '重启 reminder_daemon 守护进程' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_launcher_status' AS item_key, 'cat_system' AS cat_key, '获取 Launcher 状态' AS name, 'GET' AS method, '/api/launcher/status' AS path, '获取 Web 服务 Launcher 的运行状态及 Pitem_key' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_launcher_start' AS item_key, 'cat_system' AS cat_key, '启动 Launcher' AS name, 'POST' AS method, '/api/launcher/start' AS path, '启动 Web 服务 Launcher 进程' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_launcher_stop' AS item_key, 'cat_system' AS cat_key, '停止 Launcher' AS name, 'POST' AS method, '/api/launcher/stop' AS path, '停止 Web 服务 Launcher 进程' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_auth_send_code' AS item_key, 'cat_auth' AS cat_key, '发送验证码' AS name, 'POST' AS method, '/api/auth/send-code' AS path, '生成6位验证码写入 hp_verification_codes 并通过 SMTP 发送，5分钟内有效；配置默认验证码的超管跳过邮件' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_auth_login' AS item_key, 'cat_auth' AS cat_key, '邮箱验证码登录' AS name, 'POST' AS method, '/api/auth/verify-code' AS path, '校验 hp_verification_codes 中的验证码（或系统默认验证码），通过后签发 JWT 并把用户写入 hp_users' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_auth_verify_token' AS item_key, 'cat_auth' AS cat_key, '验证 Token' AS name, 'POST' AS method, '/api/auth/verify-token' AS path, '验证客户端携带的 JWT Token 是否有效，用于页面初始化时恢复登录状态' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_auth_admin_contact' AS item_key, 'cat_auth' AS cat_key, '获取管理员联系邮箱' AS name, 'GET' AS method, '/api/auth/admin-contact' AS path, '返回超级管理员邮箱（开发模式附带默认验证码），供无权限页面展示联系方式（公开接口，无需鉴权）' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_config_get' AS item_key, 'cat_config' AS cat_key, '获取配置' AS name, 'GET' AS method, '/api/config' AS path, '读取 web/.env 与 hp_env_config 合并后的配置项，并附加 PROJECT_DIR' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_config_update' AS item_key, 'cat_config' AS cat_key, '更新配置' AS name, 'POST' AS method, '/api/config' AS path, '更新配置：hp_env_config 登记项写库立即生效，其余写 web/.env，禁止修改系统环境变量' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_trigger_list' AS item_key, 'cat_trigger' AS cat_key, '获取脚本列表' AS name, 'GET' AS method, '/api/trigger' AS path, '获取可触发的脚本列表，按 trigger:view 权限过滤' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_trigger_run' AS item_key, 'cat_trigger' AS cat_key, '执行脚本' AS name, 'POST' AS method, '/api/trigger' AS path, '手动触发指定脚本执行，按 trigger:edit 权限校验' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_update_tools_list' AS item_key, 'cat_trigger' AS cat_key, '获取更新工具列表' AS name, 'GET' AS method, '/api/update-tools' AS path, '获取可更新的工具脚本列表' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_update_tools_run' AS item_key, 'cat_trigger' AS cat_key, '执行工具更新' AS name, 'POST' AS method, '/api/update-tools' AS path, '执行指定工具脚本的更新操作' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rules_list' AS item_key, 'cat_rules' AS cat_key, '获取规则列表' AS name, 'GET' AS method, '/api/rules' AS path, '获取所有自定义提醒规则列表' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rules_create' AS item_key, 'cat_rules' AS cat_key, '创建规则' AS name, 'POST' AS method, '/api/rules' AS path, '创建新的自定义提醒规则' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rules_update' AS item_key, 'cat_rules' AS cat_key, '更新规则' AS name, 'PUT' AS method, '/api/rules/:item_key' AS path, '更新指定 item_key 的自定义规则' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rules_delete' AS item_key, 'cat_rules' AS cat_key, '删除规则' AS name, 'DELETE' AS method, '/api/rules/:item_key' AS path, '删除指定 item_key 的自定义规则' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_webhooks_list' AS item_key, 'cat_webhooks' AS cat_key, '获取 Webhook 列表' AS name, 'GET' AS method, '/api/webhooks' AS path, '获取所有 Webhook 列表（URL 中的 key 脱敏处理）' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_webhooks_create' AS item_key, 'cat_webhooks' AS cat_key, '创建 Webhook' AS name, 'POST' AS method, '/api/webhooks' AS path, '创建新的企业微信机器人 Webhook' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_webhooks_update' AS item_key, 'cat_webhooks' AS cat_key, '更新 Webhook' AS name, 'PUT' AS method, '/api/webhooks/:item_key' AS path, '更新指定 item_key 的 Webhook' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_webhooks_delete' AS item_key, 'cat_webhooks' AS cat_key, '删除 Webhook' AS name, 'DELETE' AS method, '/api/webhooks/:item_key' AS path, '删除指定 item_key 的 Webhook' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_templates_get' AS item_key, 'cat_templates' AS cat_key, '获取模板配置' AS name, 'GET' AS method, '/api/templates' AS path, '获取所有消息模板配置对象' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_templates_raw_get' AS item_key, 'cat_templates' AS cat_key, '获取模板原始 JSON' AS name, 'GET' AS method, '/api/templates/raw' AS path, '读取 message_templates.json 文件的完整原始字符串，供前端 JSON 编辑器展示' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_templates_raw_put' AS item_key, 'cat_templates' AS cat_key, '保存模板原始 JSON' AS name, 'PUT' AS method, '/api/templates/raw' AS path, '将前端编辑器中的完整 JSON 字符串写回 message_templates.json 文件' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_templates_types' AS item_key, 'cat_templates' AS cat_key, '获取消息类型列表' AS name, 'GET' AS method, '/api/templates/types' AS path, '获取所有消息类型列表' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_templates_placeholders' AS item_key, 'cat_templates' AS cat_key, '获取占位符列表' AS name, 'GET' AS method, '/api/templates/meta/placeholders' AS path, '获取所有支持的模板占位符及其描述' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_templates_preview' AS item_key, 'cat_templates' AS cat_key, '预览模板渲染结果' AS name, 'POST' AS method, '/api/templates/preview' AS path, '渲染指定消息类型的模板，返回预览内容' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_playground_list' AS item_key, 'cat_playground' AS cat_key, '获取模板列表' AS name, 'GET' AS method, '/api/playground' AS path, '获取 hp_playground_templates 中的全部模板列表' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_playground_create' AS item_key, 'cat_playground' AS cat_key, '创建模板' AS name, 'POST' AS method, '/api/playground' AS path, '向模板列表末尾追加一个新模板' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_playground_update' AS item_key, 'cat_playground' AS cat_key, '更新模板' AS name, 'PUT' AS method, '/api/playground/:item_key' AS path, '更新指定 item_key 的模板' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_playground_delete' AS item_key, 'cat_playground' AS cat_key, '删除模板' AS name, 'DELETE' AS method, '/api/playground/:item_key' AS path, '删除指定 item_key 的模板' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_cache_read' AS item_key, 'cat_cache' AS cat_key, '读取缓存文件' AS name, 'GET' AS method, '/api/cache' AS path, '读取指定缓存文件内容' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_cache_write' AS item_key, 'cat_cache' AS cat_key, '写入缓存文件' AS name, 'POST' AS method, '/api/cache' AS path, '写入指定缓存文件内容' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_logs_get' AS item_key, 'cat_logs' AS cat_key, '获取 Access Log' AS name, 'GET' AS method, '/api/logs' AS path, '读取 Web 服务的 Access Log 内容' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_logs_rows' AS item_key, 'cat_logs' AS cat_key, '获取运行日志记录' AS name, 'GET' AS method, '/api/logs/rows' AS path, '运行日志表格分页查询：按来源/级别/关键词筛选，默认每页 15 条' AS description, 1 AS enabled, '2026-11-28 15:00:00' AS created_at, '2026-11-28 15:00:00' AS updated_at UNION ALL
  SELECT 'api_logs_row_detail' AS item_key, 'cat_logs' AS cat_key, '获取日志详情' AS name, 'GET' AS method, '/api/logs/rows/:id' AS path, '按 ID 读取单条运行日志详情（含上下文、链路 ID、关联用户）' AS description, 1 AS enabled, '2026-11-28 15:00:00' AS created_at, '2026-11-28 15:00:00' AS updated_at UNION ALL
  SELECT 'api_upload_file' AS item_key, 'cat_upload' AS cat_key, '上传文件' AS name, 'POST' AS method, '/api/upload/file' AS path, '上传单个文件，保存到 public/uploads 目录，返回可访问的文件 URL' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_web_service_status' AS item_key, 'cat_web_service' AS cat_key, '获取 Web 服务状态' AS name, 'GET' AS method, '/api/web-service/status' AS path, '获取 Web 服务的运行状态及 Pitem_key' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_web_service_start' AS item_key, 'cat_web_service' AS cat_key, '启动 Web 服务' AS name, 'POST' AS method, '/api/web-service/start' AS path, '启动 Web 服务进程' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_web_service_stop' AS item_key, 'cat_web_service' AS cat_key, '停止 Web 服务' AS name, 'POST' AS method, '/api/web-service/stop' AS path, '停止 Web 服务进程' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_roles_list' AS item_key, 'cat_rbac' AS cat_key, '获取角色列表' AS name, 'GET' AS method, '/api/rbac/roles' AS path, '获取角色列表、用户列表、权限元信息及全量权限码' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_roles_create' AS item_key, 'cat_rbac' AS cat_key, '新增角色' AS name, 'POST' AS method, '/api/rbac/roles' AS path, '新增 RBAC 角色' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_roles_update' AS item_key, 'cat_rbac' AS cat_key, '更新角色' AS name, 'PUT' AS method, '/api/rbac/roles/:item_key' AS path, '更新指定角色的名称、描述或权限列表' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_roles_delete' AS item_key, 'cat_rbac' AS cat_key, '删除角色' AS name, 'DELETE' AS method, '/api/rbac/roles/:item_key' AS path, '删除指定角色' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_users_list' AS item_key, 'cat_rbac' AS cat_key, '获取用户列表' AS name, 'GET' AS method, '/api/rbac/users' AS path, '获取用户列表及其角色信息' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_users_update_role' AS item_key, 'cat_rbac' AS cat_key, '修改用户角色' AS name, 'PUT' AS method, '/api/rbac/users/:email/role' AS path, '修改指定用户的角色' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_permissions_list' AS item_key, 'cat_rbac' AS cat_key, '获取权限元信息列表' AS name, 'GET' AS method, '/api/rbac/permissions' AS path, '获取所有权限元信息列表' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_permissions_create' AS item_key, 'cat_rbac' AS cat_key, '新增权限元信息' AS name, 'POST' AS method, '/api/rbac/permissions' AS path, '新增一条权限元信息' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_rbac_permissions_update' AS item_key, 'cat_rbac' AS cat_key, '更新权限元信息' AS name, 'PUT' AS method, '/api/rbac/permissions/:code' AS path, '更新指定权限码的元信息' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_permission_apply' AS item_key, 'cat_rbac' AS cat_key, '申请权限' AS name, 'POST' AS method, '/api/permission-apply/apply' AS path, '用户提交权限申请，发送审批邮件给管理员' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_permission_approve_get' AS item_key, 'cat_rbac' AS cat_key, '获取审批信息' AS name, 'GET' AS method, '/api/permission-apply/approve' AS path, '通过 token 获取待审批的权限申请信息（无需登录）' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_permission_approve_post' AS item_key, 'cat_rbac' AS cat_key, '审批通过' AS name, 'POST' AS method, '/api/permission-apply/approve' AS path, '管理员审批通过权限申请' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_permission_reject' AS item_key, 'cat_rbac' AS cat_key, '拒绝申请' AS name, 'POST' AS method, '/api/permission-apply/reject' AS path, '管理员拒绝权限申请' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_permission_list' AS item_key, 'cat_rbac' AS cat_key, '获取申请列表' AS name, 'GET' AS method, '/api/permission-apply/list' AS path, '获取所有权限申请记录列表（需管理员权限）' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_categories_list' AS item_key, 'cat_api_management' AS cat_key, '获取接口分类列表' AS name, 'GET' AS method, '/api/api-management/categories' AS path, '获取所有接口分类' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_categories_create' AS item_key, 'cat_api_management' AS cat_key, '创建接口分类' AS name, 'POST' AS method, '/api/api-management/categories' AS path, '创建新的接口分类' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_categories_update' AS item_key, 'cat_api_management' AS cat_key, '更新接口分类' AS name, 'PUT' AS method, '/api/api-management/categories/:item_key' AS path, '更新指定 item_key 的接口分类' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_categories_delete' AS item_key, 'cat_api_management' AS cat_key, '删除接口分类' AS name, 'DELETE' AS method, '/api/api-management/categories/:item_key' AS path, '删除指定 item_key 的接口分类，同步删除该分类下所有 API 条目' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_items_list' AS item_key, 'cat_api_management' AS cat_key, '获取 API 条目列表' AS name, 'GET' AS method, '/api/api-management/items' AS path, '获取所有 API 条目，可按 category_id 过滤' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_items_create' AS item_key, 'cat_api_management' AS cat_key, '创建 API 条目' AS name, 'POST' AS method, '/api/api-management/items' AS path, '创建新的 API 条目' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_items_update' AS item_key, 'cat_api_management' AS cat_key, '更新 API 条目' AS name, 'PUT' AS method, '/api/api-management/items/:item_key' AS path, '更新指定 item_key 的 API 条目' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_items_delete' AS item_key, 'cat_api_management' AS cat_key, '删除 API 条目' AS name, 'DELETE' AS method, '/api/api-management/items/:item_key' AS path, '删除指定 item_key 的 API 条目' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_api_items_execute' AS item_key, 'cat_api_management' AS cat_key, '执行 API 请求' AS name, 'POST' AS method, '/api/api-management/items/execute' AS path, '服务端代理执行用户指定的 HTTP 请求，返回响应状态码、响应头和响应体' AS description, 1 AS enabled, '2026-04-17 02:47:00' AS created_at, '2026-04-17 02:47:00' AS updated_at UNION ALL
  SELECT 'api_greetings_list' AS item_key, 'cat_greetings' AS cat_key, '获取节日祝福语列表' AS name, 'GET' AS method, '/api/greetings' AS path, '获取所有节日祝福语条目（扁平化，按分组展开）' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_greetings_create' AS item_key, 'cat_greetings' AS cat_key, '创建节日祝福语' AS name, 'POST' AS method, '/api/greetings' AS path, '创建新的节日祝福语条目，支持 solar_terms/holitem_keyays/lunar_festivals/special_days/birthday 五个分组' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_greetings_update' AS item_key, 'cat_greetings' AS cat_key, '更新节日祝福语' AS name, 'PUT' AS method, '/api/greetings/:item_key' AS path, '更新指定 item_key 的节日祝福语条目' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_greetings_delete' AS item_key, 'cat_greetings' AS cat_key, '删除节日祝福语' AS name, 'DELETE' AS method, '/api/greetings/:item_key' AS path, '删除指定 item_key 的节日祝福语条目' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_reminder_quotes_list' AS item_key, 'cat_reminder_quotes' AS cat_key, '获取提醒寄语列表' AS name, 'GET' AS method, '/api/reminder-quotes' AS path, '获取所有提醒寄语条目（扁平化，按 bucket 展开）' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_reminder_quotes_create' AS item_key, 'cat_reminder_quotes' AS cat_key, '创建提醒寄语' AS name, 'POST' AS method, '/api/reminder-quotes' AS path, '向指定 bucket 添加新的提醒寄语条目' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_reminder_quotes_update' AS item_key, 'cat_reminder_quotes' AS cat_key, '更新提醒寄语' AS name, 'PUT' AS method, '/api/reminder-quotes/:item_key' AS path, '更新指定 item_key 的提醒寄语条目' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_reminder_quotes_delete' AS item_key, 'cat_reminder_quotes' AS cat_key, '删除提醒寄语' AS name, 'DELETE' AS method, '/api/reminder-quotes/:item_key' AS path, '删除指定 item_key 的提醒寄语条目' AS description, 1 AS enabled, '2026-04-21 16:32:00' AS created_at, '2026-04-21 16:32:00' AS updated_at UNION ALL
  SELECT 'api_skill_map_list' AS item_key, 'cat_skill_map' AS cat_key, '获取技能列表' AS name, 'GET' AS method, '/api/skill-map' AS path, '获取 scripts/tools 下全部可执行技能脚本及其分组元信息' AS description, 1 AS enabled, '2026-04-27 10:33:48' AS created_at, '2026-04-27 10:33:48' AS updated_at UNION ALL
  SELECT 'api_skill_map_run' AS item_key, 'cat_skill_map' AS cat_key, '执行技能脚本' AS name, 'POST' AS method, '/api/skill-map/:key' AS path, '执行指定 key 的技能脚本（白名单校验），返回 stdout/stderr/imageUrl，需 SKILL_MAP_EDIT 权限' AS description, 1 AS enabled, '2026-04-27 10:33:48' AS created_at, '2026-04-27 10:33:48' AS updated_at UNION ALL
  SELECT 'api_ai_chat_conversations_list' AS item_key, 'cat_ai_chat' AS cat_key, '获取会话列表' AS name, 'GET' AS method, '/api/ai-chat/conversations' AS path, '获取当前用户的全部 AI 聊天会话摘要（id/标题/消息数/时间戳）' AS description, 1 AS enabled, '2026-05-29 10:01:41' AS created_at, '2026-05-29 10:01:41' AS updated_at UNION ALL
  SELECT 'api_ai_chat_conversation_detail' AS item_key, 'cat_ai_chat' AS cat_key, '获取会话详情' AS name, 'GET' AS method, '/api/ai-chat/conversations/:id' AS path, '获取指定会话的完整消息列表（含 user/assistant/tool 消息）' AS description, 1 AS enabled, '2026-05-29 10:01:41' AS created_at, '2026-05-29 10:01:41' AS updated_at UNION ALL
  SELECT 'api_ai_chat_conversation_create' AS item_key, 'cat_ai_chat' AS cat_key, '创建会话' AS name, 'POST' AS method, '/api/ai-chat/conversations' AS path, '为当前用户创建一个新的空会话，可选传入初始标题' AS description, 1 AS enabled, '2026-05-29 10:01:41' AS created_at, '2026-05-29 10:01:41' AS updated_at UNION ALL
  SELECT 'api_ai_chat_conversation_delete' AS item_key, 'cat_ai_chat' AS cat_key, '删除会话' AS name, 'DELETE' AS method, '/api/ai-chat/conversations/:id' AS path, '删除当前用户的指定会话及其全部消息记录' AS description, 1 AS enabled, '2026-05-29 10:01:41' AS created_at, '2026-05-29 10:01:41' AS updated_at UNION ALL
  SELECT 'api_ai_chat_health' AS item_key, 'cat_ai_chat' AS cat_key, 'AI 配置健康检查' AS name, 'GET' AS method, '/api/ai-chat/health' AS path, '检查 LLM_API_KEY 等大模型相关配置是否正常，前端用于决定是否禁用 AI 入口' AS description, 1 AS enabled, '2026-05-29 10:01:41' AS created_at, '2026-05-29 10:01:41' AS updated_at UNION ALL
  SELECT 'api_ai_chat_models' AS item_key, 'cat_ai_chat' AS cat_key, '获取可用模型列表' AS name, 'GET' AS method, '/api/ai-chat/models' AS path, '获取前端模型选择器使用的可选模型列表及默认模型标识' AS description, 1 AS enabled, '2026-05-29 10:01:41' AS created_at, '2026-05-29 10:01:41' AS updated_at UNION ALL
  SELECT 'api_ai_chat_send' AS item_key, 'cat_ai_chat' AS cat_key, '流式发送消息' AS name, 'POST' AS method, '/api/ai-chat/send' AS path, '以 Server-Sent Events 流式输出大模型回复，支持工具调用、联网搜索（需 AI_WEB_SEARCH_VIEW）及文生图/视频生成模型' AS description, 1 AS enabled, '2026-05-29 10:01:41' AS created_at, '2026-05-29 10:01:41' AS updated_at UNION ALL
  SELECT 'api_ai_chat_stats' AS item_key, 'cat_ai_chat' AS cat_key, '获取AI运行统计' AS name, 'GET' AS method, '/api/ai-chat/stats' AS path, '按天/模型/工具聚合统计 AI 运行次数、Token 成本、响应延迟与工具失败率' AS description, 1 AS enabled, '2026-10-20 17:51:03' AS created_at, '2026-10-20 17:51:03' AS updated_at UNION ALL
  SELECT 'api_ai_chat_inspect' AS item_key, 'cat_ai_chat' AS cat_key, '触发系统巡检' AS name, 'POST' AS method, '/api/ai-chat/inspect' AS path, '手动触发一次 AI 系统健康巡检（只读工具），可选把简报推送到企微群' AS description, 1 AS enabled, '2026-10-20 17:54:25' AS created_at, '2026-10-20 17:54:25' AS updated_at UNION ALL
  SELECT 'api_ai_chat_webhook' AS item_key, 'cat_ai_chat' AS cat_key, '外部渠道消息入口' AS name, 'POST' AS method, '/api/ai-chat/webhook' AS path, '外部渠道（群机器人回调转发）消息入口：跑一次 Agent 并把回答推回群，需 X-AI-Webhook-Token' AS description, 1 AS enabled, '2026-10-20 17:56:18' AS created_at, '2026-10-20 17:56:18' AS updated_at UNION ALL
  SELECT 'api_ai_chat_conversation_fork' AS item_key, 'cat_ai_chat' AS cat_key, '分支会话' AS name, 'POST' AS method, '/api/ai-chat/conversations/:id/fork' AS path, '从指定消息位置 fork 出新会话（保留上文、丢弃后续走向）' AS description, 1 AS enabled, '2026-10-20 18:08:35' AS created_at, '2026-10-20 18:08:35' AS updated_at UNION ALL
  SELECT 'api_ai_chat_approvals_list' AS item_key, 'cat_ai_chat' AS cat_key, '审批单列表' AS name, 'GET' AS method, '/api/ai-chat/approvals' AS path, '查看副作用操作审批单（可按 status=pending 过滤）' AS description, 1 AS enabled, '2026-10-20 18:08:35' AS created_at, '2026-10-20 18:08:35' AS updated_at UNION ALL
  SELECT 'api_ai_chat_approval_approve' AS item_key, 'cat_ai_chat' AS cat_key, '通过并执行审批单' AS name, 'POST' AS method, '/api/ai-chat/approvals/:id/approve' AS path, '以审批人身份执行审批单中的副作用工具' AS description, 1 AS enabled, '2026-10-20 18:08:35' AS created_at, '2026-10-20 18:08:35' AS updated_at UNION ALL
  SELECT 'api_ai_chat_approval_reject' AS item_key, 'cat_ai_chat' AS cat_key, '驳回审批单' AS name, 'POST' AS method, '/api/ai-chat/approvals/:id/reject' AS path, '驳回一张待审批的副作用操作单' AS description, 1 AS enabled, '2026-10-20 18:08:35' AS created_at, '2026-10-20 18:08:35' AS updated_at UNION ALL
  SELECT 'api_ai_chat_memory_get' AS item_key, 'cat_ai_chat' AS cat_key, '查看长期记忆' AS name, 'GET' AS method, '/api/ai-chat/memory' AS path, '查看 AI 沉淀的当前用户长期记忆' AS description, 1 AS enabled, '2026-10-20 18:08:35' AS created_at, '2026-10-20 18:08:35' AS updated_at UNION ALL
  SELECT 'api_ai_chat_memory_delete' AS item_key, 'cat_ai_chat' AS cat_key, '清空长期记忆' AS name, 'DELETE' AS method, '/api/ai-chat/memory' AS path, '清空当前用户的 AI 长期记忆' AS description, 1 AS enabled, '2026-10-20 18:08:35' AS created_at, '2026-10-20 18:08:35' AS updated_at UNION ALL
  SELECT 'api_amap_static_map' AS item_key, 'cat_ai_chat' AS cat_key, '生成高德静态地图图片' AS name, 'GET' AS method, '/api/amap-static-map' AS path, '服务端代理高德静态地图：由服务端补 AMAP_KEY，返回带标注的地图 PNG，供 AI 对话出图（不暴露密钥）' AS description, 1 AS enabled, '2026-10-28 10:00:00' AS created_at, '2026-10-28 10:00:00' AS updated_at UNION ALL
  SELECT 'api_rules_order' AS item_key, 'cat_rules' AS cat_key, '规则排序' AS name, 'PUT' AS method, '/api/rules/order' AS path, '批量更新自定义规则的显示顺序（拖拽排序）' AS description, 1 AS enabled, '2026-11-06 15:44:34' AS created_at, '2026-11-06 15:44:34' AS updated_at UNION ALL
  SELECT 'api_ai_model_configs_list' AS item_key, 'cat_config' AS cat_key, '获取自定义模型配置' AS name, 'GET' AS method, '/api/ai-model-configs' AS path, '读取自定义 AI 模型配置组列表（同一接口与 Key 下多个模型，API Key 已脱敏）' AS description, 1 AS enabled, '2026-11-19 10:30:00' AS created_at, '2026-11-19 10:30:00' AS updated_at UNION ALL
  SELECT 'api_ai_model_configs_create' AS item_key, 'cat_config' AS cat_key, '新增自定义模型配置' AS name, 'POST' AS method, '/api/ai-model-configs' AS path, '新增一组自定义 AI 模型配置（配置名称、端点、API Key 与多个模型名称），保存后立即可在 AI 对话中选择' AS description, 1 AS enabled, '2026-11-19 10:30:00' AS created_at, '2026-11-19 10:30:00' AS updated_at UNION ALL
  SELECT 'api_ai_model_configs_update' AS item_key, 'cat_config' AS cat_key, '更新自定义模型配置' AS name, 'PUT' AS method, '/api/ai-model-configs/:id' AS path, '更新指定模型配置组；API Key 传脱敏串或留空时保持原值' AS description, 1 AS enabled, '2026-11-19 10:30:00' AS created_at, '2026-11-19 10:30:00' AS updated_at UNION ALL
  SELECT 'api_ai_model_configs_delete' AS item_key, 'cat_config' AS cat_key, '删除自定义模型配置' AS name, 'DELETE' AS method, '/api/ai-model-configs/:id' AS path, '删除指定模型配置组' AS description, 1 AS enabled, '2026-11-19 10:30:00' AS created_at, '2026-11-19 10:30:00' AS updated_at UNION ALL
  SELECT 'api_ai_model_configs_fetch_models' AS item_key, 'cat_config' AS cat_key, '拉取接口可用模型' AS name, 'POST' AS method, '/api/ai-model-configs/fetch-models' AS path, '按接口地址与 API Key 调用 OpenAI 兼容的 /models 接口，返回可勾选导入的模型列表' AS description, 1 AS enabled, '2026-11-20 14:29:21' AS created_at, '2026-11-20 14:29:21' AS updated_at UNION ALL
  SELECT 'api_ai_model_configs_test_model' AS item_key, 'cat_config' AS cat_key, '测试模型可用性' AS name, 'POST' AS method, '/api/ai-model-configs/test-model' AS path, '对指定模型发一次最小 chat/completions 探测，返回是否可用、耗时与失败原因；不修改配置' AS description, 1 AS enabled, '2026-11-20 16:00:00' AS created_at, '2026-11-20 16:00:00' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_overview' AS item_key, 'cat_knowledge_base' AS cat_key, '知识库概览' AS name, 'GET' AS method, '/api/knowledge' AS path, '获取知识文档列表与索引目录配置' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_get_doc' AS item_key, 'cat_knowledge_base' AS cat_key, '读取文档正文' AS name, 'GET' AS method, '/api/knowledge/docs/:name' AS path, '读取指定知识文档的 Markdown 正文' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_create_doc' AS item_key, 'cat_knowledge_base' AS cat_key, '新建文档' AS name, 'POST' AS method, '/api/knowledge/docs' AS path, '在 knowledge 目录新建知识文档并触发索引失效' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_update_doc' AS item_key, 'cat_knowledge_base' AS cat_key, '更新文档' AS name, 'PUT' AS method, '/api/knowledge/docs/:name' AS path, '覆盖更新指定知识文档并触发索引失效' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_delete_doc' AS item_key, 'cat_knowledge_base' AS cat_key, '删除文档' AS name, 'DELETE' AS method, '/api/knowledge/docs/:name' AS path, '删除指定知识文档并触发索引失效' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_reindex' AS item_key, 'cat_knowledge_base' AS cat_key, '重建索引' AS name, 'POST' AS method, '/api/knowledge/reindex' AS path, '清空索引缓存并立即重新扫描所有索引目录' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_search' AS item_key, 'cat_knowledge_base' AS cat_key, '检索测试' AS name, 'POST' AS method, '/api/knowledge/search' AS path, '用与贾维斯相同的检索函数验证知识召回效果' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_update_dirs' AS item_key, 'cat_knowledge_base' AS cat_key, '更新索引目录' AS name, 'PUT' AS method, '/api/knowledge/dirs' AS path, '更新参与检索的目录列表并重建索引' AS description, 1 AS enabled, '2026-11-21 00:41:59' AS created_at, '2026-11-21 00:41:59' AS updated_at UNION ALL
  SELECT 'api_knowledge_base_import_doc' AS item_key, 'cat_knowledge_base' AS cat_key, '导入系统文档' AS name, 'POST' AS method, '/api/knowledge/docs/:docPath/import' AS path, '把系统文档复制为 knowledge/ 下的用户文档，原文档保持不变' AS description, 1 AS enabled, '2026-11-21 00:48:45' AS created_at, '2026-11-21 00:48:45' AS updated_at UNION ALL
  SELECT 'api_database_status' AS item_key, 'cat_database' AS cat_key, '连接状态' AS name, 'GET' AS method, '/api/database/status' AS path, '探测 MySQL 连接配置、连通性与版本信息' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_tables' AS item_key, 'cat_database' AS cat_key, '库表清单' AS name, 'GET' AS method, '/api/database/tables' AS path, '列出当前库的表与视图及其行数、引擎、注释' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_table_schema' AS item_key, 'cat_database' AS cat_key, '表结构' AS name, 'GET' AS method, '/api/database/tables/:name' AS path, '读取字段、索引与建表语句' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_table_rows' AS item_key, 'cat_database' AS cat_key, '数据预览' AS name, 'GET' AS method, '/api/database/tables/:name/rows' AS path, '按 LIMIT/OFFSET 分页预览表数据' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_scripts' AS item_key, 'cat_database' AS cat_key, '建表脚本清单' AS name, 'GET' AS method, '/api/database/scripts' AS path, '列出 helper_database.sql 与 sql/ 下的脚本' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_script' AS item_key, 'cat_database' AS cat_key, '读取建表脚本' AS name, 'GET' AS method, '/api/database/script' AS path, '读取白名单内单个 SQL 脚本正文' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_query' AS item_key, 'cat_database' AS cat_key, '只读查询' AS name, 'POST' AS method, '/api/database/query' AS path, '执行 SELECT/SHOW/DESCRIBE/EXPLAIN/WITH 查询' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_execute' AS item_key, 'cat_database' AS cat_key, '执行 SQL' AS name, 'POST' AS method, '/api/database/execute' AS path, '执行单条 DDL/DML，仅超级管理员可用' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at UNION ALL
  SELECT 'api_database_init' AS item_key, 'cat_database' AS cat_key, '初始化数据库' AS name, 'POST' AS method, '/api/database/init' AS path, '按 helper_database.sql 重建全库，需输入库名二次确认' AS description, 1 AS enabled, '2026-11-28 00:37:16' AS created_at, '2026-11-28 00:37:16' AS updated_at
) v JOIN `hp_api_categories` c ON c.category_key = v.cat_key;

-- 运行期新增的首屏聚合接口（迁移批次 2 补齐；INSERT IGNORE 保证重复初始化幂等）
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_bootstrap_get', c.id, '获取首页首屏聚合数据', 'GET', '/api/bootstrap',
       '合并系统状态、Web 服务状态、规则列表与日志来源列表的首屏数据，按权限逐块裁剪',
       1, '2026-11-28 11:09:57', '2026-11-28 11:09:57'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_system';

-- 贾维斯 AI 助手皮肤配置（按用户读写 + 自定义背景图上传）
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_ai_chat_skin_get', c.id, '读取皮肤配置', 'GET', '/api/ai-chat/skin',
       '读取当前登录用户的贾维斯皮肤配置（预设 ID 与自定义背景图本体 data URL）',
       1, '2026-11-28 13:45:00', '2026-11-28 13:45:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_ai_chat';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_ai_chat_skin_save', c.id, '保存皮肤配置', 'PUT', '/api/ai-chat/skin',
       '按当前登录用户 UPSERT 皮肤配置；预设 ID 查库校验，背景图本体直接存 LONGTEXT',
       1, '2026-11-28 13:45:00', '2026-11-28 13:45:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_ai_chat';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_ai_chat_skin_background_upload', c.id, '上传皮肤背景图', 'POST', '/api/ai-chat/skin/background',
       '上传自定义皮肤背景图（JPG/PNG/WEBP/GIF，最大 5MB），返回图片本体 data URL 以便随配置入库',
       1, '2026-11-28 13:45:00', '2026-11-28 13:45:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_ai_chat';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_ai_chat_skin_presets_list', c.id, '读取皮肤预设', 'GET', '/api/ai-chat/skin/presets',
       '列出数据库中已启用的贾维斯皮肤预设定义（名称、缩略图、背景与 CSS 变量）',
       1, '2026-11-28 14:30:00', '2026-11-28 14:30:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_ai_chat';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_ai_chat_skin_preset_save', c.id, '新增/更新皮肤预设', 'PUT', '/api/ai-chat/skin/presets/:key',
       '按 skin_key UPSERT 一条皮肤预设定义，enabled=0 可作软删除；CSS 值与变量字典均做安全校验',
       1, '2026-11-28 14:30:00', '2026-11-28 14:30:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_ai_chat';

-- 前端 i18n 语言包：运行时读文案（公开）+ 管理页列表/编辑
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_i18n_translations_get', c.id, '读取语言包', 'GET', '/api/i18n/translations',
       '一次读取全部语言（zh / en）的完整文案（公开接口，登录页与首屏使用）',
       1, '2026-11-28 14:05:00', '2026-11-28 14:05:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_database';

-- 已有库把旧的按语言分拆接口同步为合并后的单一路径（INSERT IGNORE 不会更新旧记录）
UPDATE `hp_api_items` SET `path` = '/api/i18n/translations',
       `description` = '一次读取全部语言（zh / en）的完整文案（公开接口，登录页与首屏使用）'
WHERE `item_key` = 'api_i18n_translations_get';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_i18n_messages_list', c.id, '语言条目列表', 'GET', '/api/i18n/messages',
       '按语言、命名空间、关键字分页查询语言包条目（登录用户均可查看）',
       1, '2026-11-28 14:05:00', '2026-11-28 14:05:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_database';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_i18n_messages_update', c.id, '更新语言文案', 'PUT', '/api/i18n/messages/:id',
       '更新单条静态文案；函数型条目只读，请在语言包源码中维护（database:edit）',
       1, '2026-11-28 14:05:00', '2026-11-28 14:05:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_database';

-- ── 缓存数据管理页（13 张 hp_cache_* 表）────────────────────────────
-- 旧库里 api_cache_read / api_cache_write 的方法与路径已过时，先同步修正
UPDATE `hp_api_items` SET `method` = 'GET', `path` = '/api/cache/:filename(*)',
       `description` = '读取指定缓存键的内容（键可含子目录，如 api_responses/foo.json）'
WHERE `item_key` = 'api_cache_read';
UPDATE `hp_api_items` SET `method` = 'PUT', `path` = '/api/cache/:filename(*)',
       `description` = '保存指定缓存键的内容（仅接受合法 JSON 字符串）'
WHERE `item_key` = 'api_cache_write';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_cache_list', c.id, '缓存条目列表', 'GET', '/api/cache',
       '列出数据库中的缓存条目（缓存键）', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_cache_admin_tables', c.id, '缓存表清单', 'GET', '/api/cache-admin/tables',
       '列出 13 张可管理的 hp_cache_* 表及其存储形态与粒度约定', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_cache_admin_entries', c.id, '缓存条目分页列表', 'GET', '/api/cache-admin/entries',
       '按表 / 时间粒度 / 关键字分页检索缓存行，返回正文预览与总数', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_cache_admin_entry_get', c.id, '读取缓存行全文', 'GET', '/api/cache-admin/entry',
       '按表名 / section / 缓存键读取单条缓存行全文', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_cache_admin_entry_put', c.id, '写入缓存行', 'PUT', '/api/cache-admin/entry',
       '新增或更新一条缓存行；分类表按路由声明重算 period_type / period_key', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_cache_admin_entry_delete', c.id, '删除缓存行', 'DELETE', '/api/cache-admin/entry',
       '按表名 / section / 缓存键删除一条缓存行', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

-- ── 高德地理编码缓存独立页（hp_cache_amap_geocode）────────────────────
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_amap_geocode_list', c.id, '地址坐标列表', 'GET', '/api/amap-geocode',
       '按地址关键字列出 hp_cache_amap_geocode 的扁平行', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_amap_geocode_put', c.id, '新增或更新地址坐标', 'PUT', '/api/amap-geocode',
       '写入一条地址坐标；地址变更时在事务内删除旧行，避免主键残留', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_amap_geocode_delete', c.id, '删除地址坐标', 'DELETE', '/api/amap-geocode',
       '按地址删除一条地理编码缓存记录', 1, '2026-11-28 18:00:00', '2026-11-28 18:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_cache';

-- ── 系统背景图（上传 / 读取 / 设置 / 清除）────────────────────────
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_app_background_get', c.id, '读取系统背景', 'GET', '/api/app-background',
       '读取当前系统背景图的站内短地址 /uploads/appbg-<md5>（登录页与首屏公开）', 1, '2026-11-28 19:00:00', '2026-11-28 19:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_app_background_upload', c.id, '上传系统背景图', 'POST', '/api/app-background/upload',
       '上传 JPG / PNG / WEBP / GIF 图片（最大 5MB），返回图片本体 data URL（不落磁盘）', 1, '2026-11-28 19:00:00', '2026-11-28 19:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_app_background_set', c.id, '设置系统背景', 'PUT', '/api/app-background',
       '把上传得到的图片本体写入 hp_app_background，返回站内短地址（config:edit）', 1, '2026-11-28 19:00:00', '2026-11-28 19:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_app_background_clear', c.id, '清除系统背景', 'DELETE', '/api/app-background',
       '删除库内背景图记录，恢复默认主题（config:edit）', 1, '2026-11-28 19:00:00', '2026-11-28 19:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

-- ── 按用户外观偏好（背景图遮挡层不透明度）────────────────────────
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_user_appearance_get', c.id, '读取个人外观偏好', 'GET', '/api/user-appearance',
       '读取当前登录用户的背景图遮挡层不透明度（按 JWT 用户隔离）', 1, '2026-11-28 19:20:00', '2026-11-28 19:20:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_user_appearance_set', c.id, '保存个人外观偏好', 'PUT', '/api/user-appearance',
       '保存当前登录用户的背景图遮挡层不透明度（20–100 整数，无需额外权限）', 1, '2026-11-28 19:20:00', '2026-11-28 19:20:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

-- ── AI 回话分析（运行列表 / 单次运行详情，只读）──────────────────────
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_ai_chat_admin_runs_get', c.id, '查询 AI 运行列表', 'GET', '/api/ai-chat-admin/runs',
       '分页查询 AI 运行记录（用量、耗时、工具调用数、失败数与成本），管理员可看全量', 1, '2026-11-28 20:30:00', '2026-11-28 20:30:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_ai_chat';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_ai_chat_admin_run_detail_get', c.id, '查询 AI 运行详情', 'GET', '/api/ai-chat-admin/runs/:runId',
       '读取单次运行的逐轮 token 用量、工具调用明细与会话消息正文', 1, '2026-11-28 20:30:00', '2026-11-28 20:30:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_ai_chat';

-- ── 侧边栏导航与页面注册表（数据库唯一真源）──────────────────────
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_navigation_get', c.id, '读取导航分组与页面', 'GET', '/api/navigation',
       '前端侧边栏菜单与贾维斯 query_pages 共用的分组 / 页面注册表，含停用项由前端过滤', 1, '2026-11-28 20:40:00', '2026-11-28 20:40:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_navigation_items_post', c.id, '新增 / 更新页面入口', 'POST', '/api/navigation/items',
       '维护页面注册表的路径、中文名、分组、显隐、图标、排序与权限码，写操作需 CONFIG_EDIT', 1, '2026-11-28 20:40:00', '2026-11-28 20:40:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_navigation_groups_put', c.id, '新增 / 更新菜单分组', 'PUT', '/api/navigation/groups/:groupKey',
       '维护侧边栏分组的 i18n key、图标、顺序与启用状态，写操作需 CONFIG_EDIT', 1, '2026-11-28 20:40:00', '2026-11-28 20:40:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_config';

-- ── 语言包中英对照（所有文案一次保存写 zh / en 两条）──────────────────────
INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_i18n_pairs_get', c.id, '读取中英对照文案', 'GET', '/api/i18n/pairs',
       '按 key 把 zh / en 合并成一行，支持命名空间 / 关键字筛选与分页', 1, '2026-11-28 21:00:00', '2026-11-28 21:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_database';

INSERT IGNORE INTO `hp_api_items` (`item_key`, `category_id`, `name`, `method`, `path`, `description`, `enabled`, `created_at`, `updated_at`)
SELECT 'api_i18n_pairs_put', c.id, '一次保存中英文文案', 'PUT', '/api/i18n/pairs/:keyPath',
       '一次写 zh / en 两条记录，缺失语言自动补齐；写操作需 DATABASE_EDIT', 1, '2026-11-28 21:00:00', '2026-11-28 21:00:00'
FROM `hp_api_categories` c WHERE c.category_key = 'cat_database';
