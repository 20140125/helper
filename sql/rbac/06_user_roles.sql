
-- ============================================================
-- 6. 用户-角色绑定表 (rbac.json → userRoles)
-- ============================================================
CREATE TABLE `hp_user_roles` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `user_id`     INT UNSIGNED    NOT NULL COMMENT '用户 ID（引用 hp_users.id）',
  `role_id`     INT UNSIGNED    NOT NULL COMMENT '角色 ID（引用 hp_roles.id）',
  `assigned_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  KEY `idx_role` (`role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `hp_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `hp_roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户-角色绑定表';

-- 实际绑定数据（来自 rbac.json → userRoles）
INSERT INTO `hp_user_roles` (`user_id`, `role_id`, `assigned_at`)
SELECT u.id, r.id, '2026-04-21 14:24:10'
FROM `hp_users` u, `hp_roles` r
WHERE u.email = 'redacted2@example.com' AND r.role_key = 'viewer';

-- 示例：若需绑定用户与角色，可通过子查询插入：
-- INSERT INTO `hp_user_roles` (`user_id`, `role_id`)
-- SELECT u.id, r.id FROM `hp_users` u, `hp_roles` r
-- WHERE u.email = 'xxx@example.com' AND r.role_key = 'admin';
