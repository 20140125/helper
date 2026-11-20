
-- ============================================================
-- 16. 模板名称映射表 (message_templates.json → template_names)
-- ============================================================
CREATE TABLE `hp_template_names` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `template_key`  VARCHAR(64)     NOT NULL COMMENT '模板类型标识',
  `display_name`  VARCHAR(100)    NOT NULL COMMENT '显示名称',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_template_key` (`template_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板名称映射表';

INSERT INTO `hp_template_names` (`template_key`, `display_name`) VALUES
('morning',            '🌅 早安问候'),
('breakfast',          '🍜 早餐提醒'),
('lunch',              '🍽️ 午餐提醒'),
('dinner',             '🍽️ 晚餐提醒'),
('evening',            '🌆 晚间问候'),
('birthday',           '🎂 生日祝福'),
('birthday_countdown', '🎂 生日倒计时'),
('holiday',            '🎉 节日祝福'),
('weekend',            '📊 周末问候'),
('adjustment',         '⚠️ 调休提醒'),
('monthly_start',      '🎊 月初提醒'),
('monthly_end',        '📊 月底总结'),
('solar_term',         '🌸 节气提醒'),
('lunar_festival',     '🎉 农历节日'),
('holiday_countdown',  '⏰ 假期倒计时'),
('holiday_progress',   '🏖️ 假期进行中'),
('holiday_end',        '⚠️ 假期最后一天'),
('custom_rule',        '📌 自定义规则'),
('special_day',        '🎉 特殊日期'),
('update_report',      '🎊 年度更新报告');
