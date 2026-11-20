
-- ============================================================
-- 15. 模板风格元数据表 (message_templates.json → styles)
-- ============================================================
CREATE TABLE `hp_template_styles` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `style_key`   VARCHAR(32)     NOT NULL COMMENT '风格标识',
  `name`        VARCHAR(50)     NOT NULL COMMENT '风格显示名称',
  `description` VARCHAR(200)    NULL     COMMENT '风格描述',
  `target`      VARCHAR(200)    NULL     COMMENT '适用场景',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_style_key` (`style_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模板风格元数据表';

INSERT INTO `hp_template_styles` (`style_key`, `name`, `description`, `target`) VALUES
('default', '默认风格', '表情符号 + 结构化信息 + 温馨问候', '日常团队提醒'),
('brief',   '简洁风格', '一句话核心信息，无额外修饰',       '快速通知场景'),
('formal',  '正式风格', '官方通知格式，措辞严谨',           '正式场合、公司公告');
