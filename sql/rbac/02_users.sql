
-- ============================================================
-- 2. 用户表 (users.json)
-- ============================================================
CREATE TABLE `hp_users` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `email`          VARCHAR(255)    NOT NULL COMMENT '用户邮箱（唯一登录标识）',
  `is_admin`       TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否为管理员 0=否 1=是',
  `first_login_at` DATETIME        NULL     COMMENT '首次登录时间',
  `last_login_at`  DATETIME        NULL     COMMENT '最近登录时间',
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户表';

INSERT INTO `hp_users` (`email`, `is_admin`, `first_login_at`, `last_login_at`) VALUES
('redacted2@example.com',      0, '2026-03-13 11:35:08', '2026-03-27 16:07:54'),
('redacted1@example.com',        0, '2026-03-17 10:32:59', '2026-03-17 10:32:59'),
('redacted4@example.com', 1, '2026-03-20 10:19:09', '2026-03-27 16:16:35');
