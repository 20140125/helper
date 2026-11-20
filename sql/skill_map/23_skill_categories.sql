
-- ============================================================
-- 20.3 技能图谱分组表 (skill-map.ts → SKILL_CATEGORIES)
-- ============================================================

CREATE TABLE `hp_skill_categories` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT                                          COMMENT '自增主键',
  `name`       VARCHAR(32)  NOT NULL                                                         COMMENT '分组名（天气/日历/财经/新闻/影视/科技/生活）',
  `dot_color`  VARCHAR(16)  NOT NULL DEFAULT ''                                              COMMENT '分组圆点颜色（CSS 颜色值，如 #5DADE2）',
  `sort_order` INT          NOT NULL DEFAULT 0                                               COMMENT '分组展示顺序，升序',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                               COMMENT '生成时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP   COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能图谱 - 分组元信息';

INSERT INTO `hp_skill_categories` (`name`, `dot_color`, `sort_order`) VALUES
('天气', '#5DADE2', 1),
('日历', '#FFD700', 2),
('财经', '#FF6B35', 3),
('新闻', '#9B59B6', 4),
('影视', '#00A1D6', 5),
('科技', '#1ABC9C', 6),
('生活', '#E74C3C', 7);
