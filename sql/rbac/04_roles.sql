
-- ============================================================
-- 4. 角色表 (rbac.json → roles)
-- ============================================================
CREATE TABLE `hp_roles` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `role_key`    VARCHAR(64)     NOT NULL COMMENT '角色唯一标识',
  `name`        VARCHAR(100)    NOT NULL COMMENT '角色显示名称',
  `description` VARCHAR(500)    NULL     COMMENT '角色描述',
  `builtin`     TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否为内置角色 0=否 1=是',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_key` (`role_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RBAC 角色表';

-- 数据以 .cache/rbac.json → roles 为准（自动同步）
INSERT INTO `hp_roles` (`role_key`, `name`, `description`, `builtin`, `created_at`, `updated_at`) VALUES
  ('super_admin', '超级管理员', '拥有系统全部权限，可管理角色和用户', 1, '2026-03-27 16:05:00', '2026-03-27 16:05:00') ,
  ('admin', '管理员', '拥有系统全部功能权限', 1, '2026-03-27 16:05:00', '2026-03-27 16:05:00') ,
  ('viewer', '只读用户', '可查看所有页面，但不能执行任何操作', 1, '2026-03-27 16:05:00', '2026-03-27 16:05:00');
