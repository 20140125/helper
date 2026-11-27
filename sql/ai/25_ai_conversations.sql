-- ============================================================
-- 25. 贾维斯会话表 (ai-conversations/<邮箱>/*.json)
-- ============================================================
DROP TABLE IF EXISTS `hp_ai_conversations`;
CREATE TABLE `hp_ai_conversations` (
  `id`            VARCHAR(64)   NOT NULL COMMENT '会话 ID',
  `user`          VARCHAR(191)  NOT NULL COMMENT '所属用户邮箱',
  `title`         VARCHAR(255)  NOT NULL COMMENT '会话标题',
  `message_count` INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '消息条数',
  `created_at`    BIGINT        NOT NULL COMMENT '创建时间戳(ms)',
  `updated_at`    BIGINT        NOT NULL COMMENT '更新时间戳(ms)',
  PRIMARY KEY (`id`),
  KEY `idx_user_updated` (`user`,`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯会话';
