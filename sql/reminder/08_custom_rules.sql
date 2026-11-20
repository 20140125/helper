
-- ============================================================
-- 8. 自定义规则表 (custom_rules.json)
-- ============================================================
CREATE TABLE `hp_custom_rules` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `rule_key`          VARCHAR(64)     NOT NULL COMMENT '规则唯一标识',
  `name`              VARCHAR(200)    NOT NULL COMMENT '规则名称',
  `type`              ENUM('date','weekday','lunar_date','countdown','monthly','daily','workday')
                                      NOT NULL COMMENT '规则类型',
  `condition_value`   VARCHAR(200)    NOT NULL COMMENT '触发条件',
  `time`              VARCHAR(10)     NOT NULL COMMENT '触发时间（HH:mm）',
  `message`           TEXT            NULL     COMMENT '提醒消息内容',
  `template_id`       VARCHAR(64)     NULL     COMMENT '消息模板 ID',
  `enabled`           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_triggered_at` DATETIME        NULL     COMMENT '最近触发时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rule_key` (`rule_key`),
  KEY `idx_type` (`type`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义提醒规则表';

INSERT INTO `hp_custom_rules` (`rule_key`, `name`, `type`, `condition_value`, `time`, `message`, `template_id`, `enabled`, `created_at`, `updated_at`, `last_triggered_at`) VALUES
('rule_1774250224527', '晚餐提醒', 'workday', 'workday', '17:30', '', 'dinner',    1, '2026-03-23 15:17:06', '2026-03-23 15:17:08', '2026-03-31 17:30:23'),
('rule_1774251368442', '早餐提醒', 'workday', 'workday', '09:00', '', 'breakfast', 1, '2026-03-23 15:36:08', '2026-03-23 15:36:08', '2026-04-01 09:00:05');
