
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
-- super_admin (role_id=1): 全部 61 项权限
INSERT INTO `hp_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `hp_roles` r
CROSS JOIN `hp_permissions` p
WHERE r.role_key = 'super_admin';

-- admin (role_id=2): 全部 61 项权限
INSERT INTO `hp_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `hp_roles` r
CROSS JOIN `hp_permissions` p
WHERE r.role_key = 'admin';

-- viewer (role_id=3): 仅 view 类权限（32 项），但排除 ai-web-search:view（联网搜索属于敏感能力，仅管理员可用）
INSERT INTO `hp_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `hp_roles` r
CROSS JOIN `hp_permissions` p
WHERE r.role_key = 'viewer'
  AND p.code LIKE '%:view'
  AND p.code <> 'ai-web-search:view';
