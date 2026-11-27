
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

-- 数据以 .cache/custom_rules.json 为准（自动同步）
INSERT INTO `hp_custom_rules` (`rule_key`, `name`, `type`, `condition_value`, `time`, `message`, `template_id`, `enabled`, `created_at`, `updated_at`, `last_triggered_at`) VALUES
  ('rule_1792640377101', '假期倒计时', 'daily', 'daily', '08:00', '', 'holiday_countdown', 1, '2026-10-22 11:39:37', '2026-11-20 22:10:53', '2026-11-21 08:00:22') ,
  ('rule_1792641150907', '特殊节日提醒', 'daily', 'daily', '08:00', '', 'special_day', 1, '2026-10-22 11:52:30', '2026-10-22 11:52:30', '2026-11-21 08:00:22') ,
  ('rule_1792641150906', '农历节日提醒', 'daily', 'daily', '08:00', '', 'lunar_festival', 1, '2026-10-22 11:52:30', '2026-10-22 11:52:30', '2026-11-21 08:00:22') ,
  ('rule_1792641150905', '节假日祝福', 'daily', 'daily', '08:00', '', 'holiday', 1, '2026-10-22 11:52:30', '2026-10-22 11:52:30', '2026-11-21 08:00:22') ,
  ('rule_1792640377098', '早安提醒', 'workday', 'workday', '08:00', '', 'morning', 1, '2026-10-22 11:39:37', '2026-10-22 11:39:37', '2026-11-21 08:00:22') ,
  ('rule_1792641150908', '二十四节气', 'daily', 'daily', '08:00', '', 'solar_term', 1, '2026-10-22 11:52:30', '2026-10-22 11:52:30', '2026-11-21 08:00:22') ,
  ('rule_1792640377100', '月度提醒', 'daily', 'daily', '08:00', '', 'monthly_start', 1, '2026-10-22 11:39:37', '2026-10-22 11:39:37', '2026-11-21 08:00:22') ,
  ('rule_1792640377102', '生日祝福', 'daily', 'daily', '09:00', '', 'birthday', 1, '2026-10-22 11:39:37', '2026-10-22 11:39:37', '2026-11-21 09:01:47') ,
  ('rule_1774251368442', '早餐提醒', 'workday', 'workday', '09:00', '', 'breakfast', 1, '2026-03-23 15:36:08', '2026-03-23 15:36:08', '2026-11-21 09:01:47') ,
  ('rule_1792977192558', '早间A股大盘推送', 'workday', 'workday', '09:30', '', 'stock_market', 1, '2026-10-26 09:13:12', '2026-10-26 09:13:55', '2026-11-20 09:30:26') ,
  ('rule_1792639706450', '午餐提醒', 'workday', 'workday', '12:00', '', 'lunch', 1, '2026-10-22 11:28:26', '2026-10-22 11:28:26', '2026-11-21 12:00:27') ,
  ('rule_1786097068248', '工作周报', 'weekday', '5', '14:30', '', 'weekly_reminder', 1, '2026-08-07 18:04:28', '2026-08-12 16:48:26', '2026-11-21 14:30:05') ,
  ('rule_1792977189473', '午间A股大盘推送', 'workday', 'workday', '15:00', '', 'stock_market', 1, '2026-10-26 09:13:09', '2026-10-28 15:37:32', '2026-11-21 15:00:13') ,
  ('rule_1774250224527', '晚餐提醒', 'workday', 'workday', '17:30', '', 'dinner', 1, '2026-03-23 15:17:06', '2026-03-23 15:17:08', '2026-11-20 17:30:18') ,
  ('rule_1792639706451', '下班提醒', 'workday', 'workday', '18:00', '', 'evening', 1, '2026-10-22 11:28:26', '2026-10-22 11:28:26', '2026-11-19 18:00:18') ,
  ('rule_1792640377103', '明日调休预告', 'daily', 'daily', '18:00', '', 'adjustment', 1, '2026-10-22 11:39:37', '2026-10-22 11:39:37', '2026-11-19 18:00:18') ,
  ('rule_1792640377104', '每周总结', 'daily', 'daily', '18:30', '', 'weekend', 1, '2026-10-22 11:39:37', '2026-10-22 11:39:37', '2026-11-19 18:30:22');
