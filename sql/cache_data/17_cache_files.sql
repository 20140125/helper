-- ============================================================
-- 表：hp_cache_files
-- 来源：.cache/holiday_data.json、month_config.json、daemon_sent_state.json、
--       daily_data_*.json、api_responses/*
-- 由 sql/cache_data.sql 统一加载；也可单独执行本文件
-- ============================================================
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `hp_cache_files`;
CREATE TABLE `hp_cache_files` (
  `file_key`   VARCHAR(191) NOT NULL COMMENT '相对 .cache 的文件路径',
  `body`       LONGTEXT      NULL     COMMENT '原始文件全文（JSON 或文本）',
  `updated_at` BIGINT        NOT NULL DEFAULT 0 COMMENT '文件 mtime（毫秒）',
  PRIMARY KEY (`file_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='日历与 API 响应缓存文件的查询镜像';

-- 初始数据为空；由 npm run migrate:cache -- --batch=calendar-cache --apply 或运行时自动同步写入
INSERT INTO `hp_cache_meta` (`meta_key`, `meta_value`) VALUES
  ('calendar_cache_sync_at', '0')
ON DUPLICATE KEY UPDATE `meta_value` = VALUES(`meta_value`);
