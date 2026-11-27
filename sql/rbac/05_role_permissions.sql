
-- ============================================================
-- 5. 角色-权限关联表 (rbac.json → roles.permissions)
-- ============================================================
CREATE TABLE `hp_role_permissions` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `role_id`       INT UNSIGNED NOT NULL COMMENT '角色 ID（引用 hp_roles.id）',
  `permission_id` INT UNSIGNED NOT NULL COMMENT '权限 ID（引用 hp_permissions.id）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`, `permission_id`),
  KEY `idx_permission` (`permission_id`),
  CONSTRAINT `fk_rp_role`       FOREIGN KEY (`role_id`)       REFERENCES `hp_roles` (`id`)       ON DELETE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `hp_permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-权限关联表';

-- 通过子查询插入，自动解析 role_key → role_id、permission code → permission_id
-- 权限数量以 .cache/rbac.json 为准：super_admin 70 / admin 63 / viewer 34
-- 数据以 .cache/rbac.json → roles.permissions 为准（自动同步）
INSERT INTO `hp_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `hp_roles` r, `hp_permissions` p
WHERE r.role_key = 'super_admin' AND p.code IN ('ai-models:view', 'ai-models:edit', 'dashboard:view', 'daemon:view', 'daemon:edit', 'web-service:view', 'web-service:edit', 'config:view', 'config:edit', 'webhook:view', 'webhook:edit', 'rules:view', 'rules:edit', 'trigger:view', 'trigger:workday:view', 'trigger:workday:edit', 'trigger:birthday:view', 'trigger:birthday:edit', 'trigger:weekly:view', 'trigger:weekly:edit', 'trigger:monthly:view', 'trigger:monthly:edit', 'trigger:prefetch:view', 'trigger:prefetch:edit', 'trigger:festival:view', 'trigger:festival:edit', 'trigger:holiday-countdown:view', 'trigger:holiday-countdown:edit', 'trigger:clear-logs:view', 'trigger:clear-logs:edit', 'trigger:custom-rules:view', 'trigger:custom-rules:edit', 'trigger:annual-update:view', 'trigger:annual-update:edit', 'logs:view', 'logs:edit', 'cache:view', 'cache:edit', 'playground:view', 'playground:edit', 'templates:view', 'templates:edit', 'upload:edit', 'rbac:roles:view', 'rbac:roles:edit', 'rbac:users:view', 'rbac:users:edit', 'rbac:permissions:view', 'rbac:permissions:edit', 'rbac:requests:view', 'rbac:requests:edit', 'api-management:view', 'api-management:edit', 'api-category:view', 'api-category:edit', 'greetings:view', 'greetings:edit', 'reminder-quotes:view', 'reminder-quotes:edit', 'skill-map:view', 'skill-map:edit', 'ai-chat:view', 'ai-web-search:view', 'ai-approvals:view', 'ai-approvals:edit', 'project:view', 'knowledge-base:view', 'knowledge-base:edit', 'database:view', 'database:edit');

INSERT INTO `hp_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `hp_roles` r, `hp_permissions` p
WHERE r.role_key = 'admin' AND p.code IN ('dashboard:view', 'daemon:view', 'web-service:view', 'config:view', 'config:edit', 'webhook:view', 'webhook:edit', 'rules:view', 'rules:edit', 'trigger:view', 'trigger:workday:view', 'trigger:workday:edit', 'trigger:birthday:view', 'trigger:birthday:edit', 'trigger:weekly:view', 'trigger:weekly:edit', 'trigger:monthly:view', 'trigger:monthly:edit', 'trigger:prefetch:view', 'trigger:prefetch:edit', 'trigger:festival:view', 'trigger:festival:edit', 'trigger:holiday-countdown:view', 'trigger:holiday-countdown:edit', 'trigger:clear-logs:view', 'trigger:clear-logs:edit', 'trigger:custom-rules:view', 'trigger:custom-rules:edit', 'trigger:annual-update:view', 'trigger:annual-update:edit', 'logs:view', 'logs:edit', 'cache:view', 'cache:edit', 'playground:view', 'playground:edit', 'templates:view', 'templates:edit', 'upload:edit', 'rbac:roles:view', 'rbac:roles:edit', 'rbac:users:view', 'rbac:users:edit', 'rbac:permissions:view', 'rbac:permissions:edit', 'rbac:requests:view', 'rbac:requests:edit', 'api-management:view', 'api-management:edit', 'api-category:view', 'api-category:edit', 'greetings:view', 'greetings:edit', 'reminder-quotes:view', 'reminder-quotes:edit', 'skill-map:view', 'skill-map:edit', 'ai-chat:view', 'ai-web-search:view', 'ai-approvals:view', 'project:view', 'knowledge-base:view', 'knowledge-base:edit');

INSERT INTO `hp_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `hp_roles` r, `hp_permissions` p
WHERE r.role_key = 'viewer' AND p.code IN ('dashboard:view', 'config:view', 'rules:view', 'web-service:view', 'trigger:view', 'trigger:workday:view', 'trigger:birthday:view', 'trigger:weekly:view', 'trigger:monthly:view', 'trigger:prefetch:view', 'trigger:festival:view', 'trigger:holiday-countdown:view', 'trigger:clear-logs:view', 'trigger:custom-rules:view', 'trigger:annual-update:view', 'logs:view', 'cache:view', 'playground:view', 'templates:view', 'rbac:roles:view', 'rbac:users:view', 'rbac:permissions:view', 'rbac:requests:view', 'api-management:view', 'api-category:view', 'daemon:view', 'webhook:view', 'skill-map:view', 'reminder-quotes:view', 'greetings:view', 'ai-chat:view', 'ai-approvals:view', 'project:view', 'knowledge-base:view');

