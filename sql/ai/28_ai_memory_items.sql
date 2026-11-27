-- ============================================================
-- 28. 贾维斯长期记忆表 (ai-memory/<邮箱>.json)
-- ============================================================
DROP TABLE IF EXISTS `hp_ai_memory_items`;
CREATE TABLE `hp_ai_memory_items` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `memory_id`   VARCHAR(64)   NOT NULL COMMENT '记忆 ID',
  `user`        VARCHAR(191)  NOT NULL COMMENT '所属用户邮箱',
  `content`     TEXT          NOT NULL COMMENT '记忆正文',
  `source`      VARCHAR(64)   NULL COMMENT '来源会话 ID',
  `created_at`  BIGINT        NOT NULL COMMENT '创建时间戳(ms)',
  `updated_at`  BIGINT        NOT NULL COMMENT '最近命中时间戳(ms)',
  `hits`        INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '累计被注入次数',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_memory` (`user`,`memory_id`),
  KEY `idx_user_updated` (`user`,`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯长期记忆';
