
-- ============================================================
-- 11. 月份配置表 (month_config.json)
-- ============================================================
CREATE TABLE `hp_month_config` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `month`         CHAR(2)         NOT NULL COMMENT '月份（01-12）',
  `name`          VARCHAR(20)     NOT NULL COMMENT '英文名',
  `name_cn`       VARCHAR(10)     NOT NULL COMMENT '中文名',
  `days`          TINYINT         NOT NULL COMMENT '天数',
  `description`   VARCHAR(200)    NULL     COMMENT '月份描述',
  `is_leap_year`  TINYINT(1)      NULL     COMMENT '是否闰年（仅2月有效）',
  `year`          SMALLINT        NOT NULL DEFAULT 2026 COMMENT '所属年份',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_year_month` (`year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='月份配置表';

-- 数据以 .cache/month_config.json 为准（自动同步）
INSERT INTO `hp_month_config` (`month`, `name`, `name_cn`, `days`, `description`, `is_leap_year`) VALUES
  ('01', 'January', '一月', 31, '新年伊始，充满希望', NULL) ,
  ('02', 'February', '二月', '28', '春回大地，万物复苏', 0) ,
  ('03', 'March', '三月', 31, '春暖花开，生机勃勃', NULL) ,
  ('04', 'April', '四月', 30, '清明时节，雨纷纷', NULL) ,
  ('05', 'May', '五月', 31, '劳动光荣，青春飞扬', NULL) ,
  ('06', 'June', '六月', 30, '仲夏时节，热情似火', NULL) ,
  ('07', 'July', '七月', 31, '盛夏酷暑，砥砺前行', NULL) ,
  ('08', 'August', '八月', 31, '秋高气爽，收获在望', NULL) ,
  ('09', 'September', '九月', 30, '金秋时节，硕果累累', NULL) ,
  ('10', 'October', '十月', 31, '国庆佳节，举国欢庆', NULL) ,
  ('11', 'November', '十一月', 30, '冬日将至，蓄势待发', NULL) ,
  ('12', 'December', '十二月', 31, '岁末年终，总结展望', NULL);
