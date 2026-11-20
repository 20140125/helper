
-- ============================================================
-- 19. 验证码记录表 (auth.ts → CodeRecord，运行时内存数据)
-- ============================================================
CREATE TABLE `hp_verification_codes` (
  `id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `email`      VARCHAR(255)    NOT NULL COMMENT '用户邮箱',
  `code`       VARCHAR(10)     NOT NULL COMMENT '验证码',
  `expires_at` DATETIME        NOT NULL COMMENT '过期时间',
  `used`       TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否已使用',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证码记录表';

